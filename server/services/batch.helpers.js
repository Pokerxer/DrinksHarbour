// server/services/batch.helpers.js
// Pure, dependency-free helpers for batch/expiry tracking. No DB or Mongoose here.

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Resolve a product's effective tracksBatch value.
 * Batch tracking defaults ON for every product (alcoholic included) — alcoholic
 * drinks carry lot/batch numbers too, they just leave expiry optional. The
 * per-product `current` flag overrides the default either way.
 * @param {boolean} _isAlcoholic  retained for signature compatibility; no longer gates the default
 * @param {boolean|undefined|null} current  explicit per-product override
 * @returns {boolean}
 */
function defaultTracksBatch(_isAlcoholic, current) {
  if (current === true || current === false) return current;
  return true;
}

/**
 * Order batches FEFO: soonest expiry first; null-expiry batches go last,
 * tie-broken by receivedDate ascending (oldest received first).
 * Does not mutate the input.
 */
function orderBatchesFefo(batches) {
  const time = (d) => (d ? new Date(d).getTime() : null);
  return [...batches].sort((a, b) => {
    const ea = time(a.expiryDate);
    const eb = time(b.expiryDate);
    if (ea !== null && eb !== null && ea !== eb) return ea - eb;
    if (ea === null && eb !== null) return 1;
    if (ea !== null && eb === null) return -1;
    return (time(a.receivedDate) || 0) - (time(b.receivedDate) || 0);
  });
}

/**
 * Order batches FIFO: oldest received first (then createdAt), ignoring expiry.
 * Used when the tenant disables fefoPicking.
 */
function orderBatchesFifo(batches) {
  const time = (d) => (d ? new Date(d).getTime() : 0);
  return [...batches].sort(
    (a, b) =>
      (time(a.receivedDate) || time(a.createdAt)) -
      (time(b.receivedDate) || time(b.createdAt))
  );
}

/** True when a batch carries an expiry date that is on/before `now`. */
function isExpired(batch, now = new Date()) {
  if (!batch || !batch.expiryDate) return false;
  return new Date(batch.expiryDate).getTime() <= new Date(now).getTime();
}

/**
 * Allocate `quantity` across batches without mutating them.
 * @param {object} [opts]
 * @param {'fefo'|'fifo'} [opts.order='fefo']  picking order
 * @param {boolean} [opts.excludeExpired=false]  skip already-expired batches
 * @param {Date} [opts.now]
 * @returns {{ allocations: Array<{batch, batchNumber, quantity, expiryDate}>, remainder: number }}
 *   remainder > 0 means batches could not fully cover the quantity (drawn from
 *   untracked slack by the caller).
 */
function allocateFefo(batches, quantity, opts = {}) {
  const { order = 'fefo', excludeExpired = false, now = new Date() } = opts;
  let pool = batches;
  if (excludeExpired) pool = pool.filter((b) => !isExpired(b, now));
  const ordered = order === 'fifo' ? orderBatchesFifo(pool) : orderBatchesFefo(pool);

  let need = quantity;
  const allocations = [];
  for (const b of ordered) {
    if (need <= 0) break;
    const take = Math.min(need, b.quantity || 0);
    if (take <= 0) continue;
    allocations.push({
      batch: b._id,
      batchNumber: b.batchNumber,
      quantity: take,
      expiryDate: b.expiryDate || null,
    });
    need -= take;
  }
  return { allocations, remainder: Math.max(0, need) };
}

/**
 * Pure: per-unit cost basis for a line's on-hand batches under a valuation method.
 *  - 'average' → quantity-weighted average of lot unit costs
 *  - 'fifo'    → unit cost of the oldest-received remaining lot (next to issue)
 *  - anything else (standard) → fallbackCost
 * Falls back to fallbackCost whenever no lot carries a usable (>0) unit cost.
 * @param {Array<{quantity?:number, unitCost?:number, receivedDate?:any}>} batches
 */
function valuationCost(batches, method, fallbackCost = 0) {
  const lots = (batches || []).filter((b) => (b.quantity || 0) > 0 && (b.unitCost || 0) > 0);
  if (lots.length === 0) return fallbackCost;

  if (method === 'average') {
    let totalQty = 0;
    let totalVal = 0;
    for (const b of lots) {
      totalQty += b.quantity;
      totalVal += b.quantity * b.unitCost;
    }
    return totalQty > 0 ? totalVal / totalQty : fallbackCost;
  }
  if (method === 'fifo') {
    const time = (d) => (d ? new Date(d).getTime() : 0);
    const oldest = lots.reduce((a, b) => (time(a.receivedDate) <= time(b.receivedDate) ? a : b));
    return oldest.unitCost;
  }
  return fallbackCost;
}

/** YYYYMMDD in UTC. */
function formatBatchDate(date) {
  const d = new Date(date);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

/**
 * Given existing batch numbers and a `${SKU}-${YYYYMMDD}` prefix, return the next
 * sequence integer (max existing for that prefix + 1, else 1).
 */
function nextBatchSeq(existingNumbers, prefix) {
  let max = 0;
  for (const n of existingNumbers) {
    if (typeof n !== 'string' || !n.startsWith(`${prefix}-`)) continue;
    const seq = parseInt(n.slice(prefix.length + 1), 10);
    if (Number.isFinite(seq) && seq > max) max = seq;
  }
  return max + 1;
}

/** Compose `${SKU}-${YYYYMMDD}-${seq}` with a 3-digit zero-padded sequence. */
function buildBatchNumber(sku, date, seq) {
  return `${sku}-${formatBatchDate(date)}-${String(seq).padStart(3, '0')}`;
}

/** Whole days from `now` to `expiryDate` (floored; negative if already past). */
function daysUntil(expiryDate, now = new Date()) {
  return Math.floor((new Date(expiryDate).getTime() - new Date(now).getTime()) / MS_PER_DAY);
}

/** True when expiryDate is set and within `windowDays` from now (past counts as within). */
function isWithinExpiryWindow(expiryDate, now, windowDays) {
  if (!expiryDate) return false;
  return daysUntil(expiryDate, now) <= windowDays;
}

/** Map days-to-expiry to a Notification priority. */
function expiryAlertPriority(expiryDate, now = new Date()) {
  const d = daysUntil(expiryDate, now);
  if (d < 30) return 'urgent';
  if (d < 60) return 'high';
  return 'normal';
}

module.exports = {
  defaultTracksBatch,
  orderBatchesFefo,
  orderBatchesFifo,
  isExpired,
  allocateFefo,
  valuationCost,
  formatBatchDate,
  nextBatchSeq,
  buildBatchNumber,
  daysUntil,
  isWithinExpiryWindow,
  expiryAlertPriority,
};
