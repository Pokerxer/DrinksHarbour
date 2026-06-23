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
    // Mongoose subdocuments store schema fields behind getters, not as
    // own-enumerable properties, so `{ ...it }` silently drops everything
    // (subproduct, size, _id, name...) and keeps only internal bookkeeping
    // (_doc, $__, ...). Go through toObject() first when it's a real
    // subdocument; plain test fixtures (no toObject) spread as before.
    const plain = typeof it.toObject === 'function' ? it.toObject() : it;
    out.push({ ...plain, qty: delta });
  }
  return out;
}

/**
 * Post each shipped posting line OUT of the target warehouse via the injected
 * adjustStock(type:'shipped'). A line missing subproduct/size is surfaced as a
 * failure, not silently dropped.
 * @returns {Promise<{ successCount, failCount, failures: Array<{lineId, name, reason}>, postedLineIds: Array<string> }>}
 */
async function postShippedStock({
  salesOrder, targetWarehouseId, postingLines, adjustStock, userId, tenantId, logger = console,
}) {
  let successCount = 0, failCount = 0;
  const failures = [];
  const postedLineIds = [];
  const label = (l) => l.name || l.sku || String(l.subproduct || 'unknown item');

  for (const line of postingLines || []) {
    const qty = Number(line.qty) || 0;
    if (qty <= 0) continue;
    const id = lineId(line);
    if (!line.subproduct || !line.size) {
      failures.push({ lineId: id, name: label(line), reason: 'missing subproduct/size to ship from' });
      failCount++; continue;
    }
    try {
      await adjustStock(
        { warehouseId: targetWarehouseId, subProduct: line.subproduct, size: line.size,
          quantity: qty, type: 'shipped', notes: `Sales fulfillment: ${salesOrder.soNumber}` },
        userId, tenantId
      );
      successCount++;
      postedLineIds.push(id);
    } catch (err) {
      logger.error(`   ❌ ${label(line)} — ${err.message}`);
      failures.push({ lineId: id, name: label(line), reason: err.message });
      failCount++;
    }
  }
  return { successCount, failCount, failures, postedLineIds };
}

/** Sales.paymentMethod enum — anything outside this set (incl. 'split') maps to 'other'. */
const SALES_PAYMENT_METHODS = new Set([
  'card', 'bank_transfer', 'mobile_money', 'cash', 'pos_terminal', 'wallet', 'invoice', 'other',
]);

/** Map an arbitrary order-level payment method onto the Sales schema's enum. */
function mapPaymentMethod(paymentMethod) {
  if (paymentMethod && SALES_PAYMENT_METHODS.has(paymentMethod) && paymentMethod !== 'split') {
    return paymentMethod;
  }
  return 'other';
}

/**
 * Build a COMPLETE Sales document payload (every field the real Sales schema
 * requires) for one shipped line. Pure — no DB access; unitCost is passed in.
 *
 * @param {Object} args
 * @param {string} args.tenantId
 * @param {{ product, subproduct, size, unitPrice?, discount? }} args.item  SO line
 * @param {number} args.qty                                                shipped delta
 * @param {string} [args.paymentMethod]                                    order-level method
 * @param {number} [args.unitCost]                                         cost per unit (markup model)
 * @param {{ revenueModel?: 'commission'|'markup', commissionPct?: number }} [args.revenue]
 * @param {string} [args.channelDetail]
 * @returns {Object} a payload satisfying every `required: true` field on Sales
 */
function buildSalesRow({ tenantId, item, qty, paymentMethod, unitCost = 0, revenue = {}, channelDetail }) {
  const priceAtSale = Math.max(0, (item.unitPrice || 0) - (item.discount || 0));
  const itemSubtotal = priceAtSale * qty;
  const finalItemPrice = priceAtSale;

  const isCommission = revenue.revenueModel === 'commission';
  const revenueModelUsed = isCommission ? 'commission' : 'markup';

  let tenantAmount;
  if (isCommission) {
    const commissionPct = Number(revenue.commissionPct) || 0;
    tenantAmount = Math.round(itemSubtotal * (1 - commissionPct / 100));
  } else {
    tenantAmount = Math.min((Number(unitCost) || 0) * qty, itemSubtotal);
    tenantAmount = Math.round(tenantAmount);
  }
  tenantAmount = Math.max(0, Math.min(tenantAmount, itemSubtotal));
  const platformAmount = Math.max(0, Math.round(itemSubtotal) - tenantAmount);

  return {
    tenant: tenantId,
    product: item.product,
    subproduct: item.subproduct,
    size: item.size,
    quantity: qty,
    priceAtSale,
    itemSubtotal,
    finalItemPrice,
    revenueModelUsed,
    platformAmount,
    tenantAmount,
    paymentMethod: mapPaymentMethod(paymentMethod),
    channel: 'tenant_manual',
    channelDetail,
  };
}

module.exports = {
  lineId, outstanding, applyFulfillment, fulfillStatus, buildPostingLines, postShippedStock,
  buildSalesRow, mapPaymentMethod,
};
