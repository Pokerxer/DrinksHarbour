// server/services/batch.helpers.js
// Pure, dependency-free helpers for batch/expiry tracking. No DB or Mongoose here.

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Resolve a product's effective tracksBatch value.
 * @param {boolean} isAlcoholic
 * @param {boolean|undefined|null} current  explicit per-product override
 * @returns {boolean}
 */
function defaultTracksBatch(isAlcoholic, current) {
  if (current === true || current === false) return current;
  return !isAlcoholic;
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
 * Allocate `quantity` across batches FEFO without mutating them.
 * @returns {{ allocations: Array<{batch, batchNumber, quantity, expiryDate}>, remainder: number }}
 *   remainder > 0 means batches could not fully cover the quantity (drawn from
 *   untracked slack by the caller).
 */
function allocateFefo(batches, quantity) {
  let need = quantity;
  const allocations = [];
  for (const b of orderBatchesFefo(batches)) {
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
  allocateFefo,
  formatBatchDate,
  nextBatchSeq,
  buildBatchNumber,
  daysUntil,
  isWithinExpiryWindow,
  expiryAlertPriority,
};
