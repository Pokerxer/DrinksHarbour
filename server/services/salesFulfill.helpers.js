// server/services/salesFulfill.helpers.js
// Pure, DB-less fulfillment math — the sell-side analogue of poReceive.helpers.js.

/** Stable id for a SO line, whether a plain test object or a Mongoose subdoc. */
function lineId(item) {
  if (item.lineId != null) return String(item.lineId);
  if (item._id != null) return String(item._id);
  return null;
}

/**
 * Units still expected on a line: ordered minus shipped (fulfilledQty) minus
 * sent-back (returnedQty). Never below zero.
 */
function outstanding(line) {
  const ordered = line.quantity || 0;
  const fulfilled = line.fulfilledQty || 0;
  const returned = line.returnedQty || 0;
  return Math.max(0, ordered - fulfilled - returned);
}

/**
 * Accumulate one fulfillment onto the SO lines WITHOUT mutating them.
 * For each fulfill line, fulfilledQty accumulates (previous + this fulfillment),
 * clamped to the ordered quantity unless allowOver. `delta` is the accepted
 * increment for THIS fulfillment (what should post to stock).
 *
 * @param {Array} soItems    each with quantity, fulfilledQty, _id/lineId
 * @param {Array} fulfillLines  [{ lineId, qty }]
 * @param {{ allowOver?: boolean }} [opts]
 * @returns {{ lines: Array<{ lineId, previousFulfilledQty, newFulfilledQty, delta }> }}
 */
function applyFulfillment(soItems, fulfillLines, { allowOver = false } = {}) {
  const byId = new Map((soItems || []).map((it) => [lineId(it), it]));
  const lines = [];

  for (const fl of fulfillLines || []) {
    const add = Math.max(0, Number(fl.qty) || 0);
    if (add <= 0) continue;

    const item = byId.get(String(fl.lineId));
    if (!item) continue;

    const previousFulfilledQty = item.fulfilledQty || 0;
    let newFulfilledQty = previousFulfilledQty + add;
    if (!allowOver) {
      newFulfilledQty = Math.min(newFulfilledQty, item.quantity || 0);
    }
    const delta = newFulfilledQty - previousFulfilledQty;
    if (delta <= 0) continue;

    lines.push({ lineId: String(fl.lineId), previousFulfilledQty, newFulfilledQty, delta });
  }

  return { lines };
}

/**
 * Derived order status from its lines:
 *  - 'fulfilled'            every line fulfilledQty >= ordered quantity
 *  - 'partially_fulfilled' some (but not all) units shipped
 *  - null                  nothing shipped (caller keeps current status)
 */
function fulfillStatus(soItems) {
  const items = soItems || [];
  if (items.length === 0) return null;
  const allFull = items.every((it) => (it.fulfilledQty || 0) >= (it.quantity || 0));
  if (allFull) return 'fulfilled';
  const anyShipped = items.some((it) => (it.fulfilledQty || 0) > 0);
  if (anyShipped) return 'partially_fulfilled';
  return null;
}

/**
 * Project SO lines into those still needing to post to inventory, with qty set
 * to the UNPOSTED delta (fulfilledQty - postedQty). Makes repeated fulfill
 * posts idempotent.
 * @returns {Array} shallow clones with `qty` = delta; empty when nothing pending
 */
function buildPostingLines(soItems) {
  const out = [];
  for (const it of soItems || []) {
    const delta = (it.fulfilledQty || 0) - (it.postedQty || 0);
    if (delta <= 0) continue;
    out.push({ ...it, qty: delta });
  }
  return out;
}

module.exports = { lineId, outstanding, applyFulfillment, fulfillStatus, buildPostingLines };
