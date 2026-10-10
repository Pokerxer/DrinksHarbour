const SalesOrder = require('../models/SalesOrder');

/**
 * The agreed unit price of every line on a Sales Order loaded into the cart.
 *
 * A quotation is a negotiated, ISSUED offer, so its line prices have to beat
 * today's POS price, the pricelist and the bundle rules — a 10% deal price, a
 * manually overridden line, a price from a pricelist that has since changed, all
 * sit far outside the 1% band `createPOSOrder` allows a cart price. Widening
 * that band was never the answer: it is the tamper guard on a number that
 * arrived from the client. Instead the client sends an ID and the server looks
 * the prices up here, so an agreed price never crosses the wire and never has to
 * be trusted.
 *
 * The price is NET of the line's agreed discount and promotion, per unit:
 *   (unitPrice·qty − lineDiscount − promoDiscount) / qty
 * The till's own per-line discount is a percentage from the dialpad and cannot
 * express a flat ₦ off a line, and per-unit is the only split of a flat discount
 * that stays right when the cashier sells 3 of a quoted 10. Line tax is NOT
 * folded in; the quoted rate travels separately and is charged at checkout.
 *
 * @returns {Promise<Map<string, { unitPrice: number, taxRate: number }>>} keyed `subProductId_sizeId`, or
 *   `subProductId` when the line is unsized OR when the order names that
 *   sub-product exactly once (so a cart line whose size is unknown still
 *   matches). Two sizes of one product leave the bare key unset: ambiguity
 *   falls through to ordinary pricing rather than picking the cheaper line.
 */
async function resolveLinkedSalesOrderLines(salesOrderId, tenantId) {
  const prices = new Map();
  if (!salesOrderId || !tenantId) return prices;

  let so = null;
  try {
    so = await SalesOrder.findOne({ _id: salesOrderId, tenant: tenantId })
      .select('items')
      .lean();
  } catch (_) {
    return prices; // a malformed id is not a reason to fail the sale
  }
  if (!so) return prices;

  const { lineTotalOf } = require('../services/salesOrder.service');
  const bySubProduct = new Map();

  for (const line of so.items || []) {
    if (line.lineType && line.lineType !== 'product') continue;
    if (!line.subproduct) continue;
    const qty = Number(line.quantity) || 0;
    if (qty <= 0) continue;

    const net  = lineTotalOf(line) - (Number(line.promoDiscount) || 0);
    const unit = Math.max(0, net / qty);
    const sub  = String(line.subproduct);

    const pricing = { unitPrice: unit, taxRate: Math.max(0, Number(line.taxRate) || 0) };
    prices.set(line.size ? `${sub}_${String(line.size)}` : sub, pricing);
    bySubProduct.set(sub, [...(bySubProduct.get(sub) || []), pricing]);
  }

  for (const [sub, units] of bySubProduct) {
    if (units.length === 1 && !prices.has(sub)) prices.set(sub, units[0]);
  }

  return prices;
}

module.exports = { resolveLinkedSalesOrderLines };
