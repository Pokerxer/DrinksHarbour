// server/services/salesOrder.service.js
const SalesOrder = require('../models/SalesOrder');
const { generateSalesOrderNumber } = require('../utils/orderUtils');

/** Compute a single line's total: (unitPrice - discount) * quantity, floored at 0. */
function lineTotalOf(item) {
  const unit = Math.max(0, (Number(item.unitPrice) || 0) - (Number(item.discount) || 0));
  return unit * (Number(item.quantity) || 0);
}

/** Roll item lineTotals into subtotal/discountTotal/total (NGN integer). */
function computeTotals(items) {
  let subtotal = 0, discountTotal = 0;
  for (const it of items) {
    subtotal += (Number(it.unitPrice) || 0) * (Number(it.quantity) || 0);
    discountTotal += (Number(it.discount) || 0) * (Number(it.quantity) || 0);
  }
  return { subtotal, discountTotal, total: Math.max(0, subtotal - discountTotal) };
}

/**
 * Build + persist a SalesOrder. Snapshots line totals and order totals.
 * docType 'quotation' starts quoteStatus='draft'; 'order' starts orderStatus='draft'.
 */
async function createSalesOrderDoc({ tenantId, body }) {
  const docType = body.docType === 'quotation' ? 'quotation' : 'order';
  const items = (body.items || []).map((it) => ({
    product: it.product, subproduct: it.subproduct, size: it.size,
    sku: it.sku, name: it.name,
    quantity: Number(it.quantity) || 0,
    unitPrice: Number(it.unitPrice) || 0,
    discount: Number(it.discount) || 0,
    lineTotal: lineTotalOf(it),
  }));
  const totals = computeTotals(items);
  const soNumber = await generateSalesOrderNumber();

  return SalesOrder.create({
    tenant: tenantId,
    soNumber,
    docType,
    customer: body.customer || undefined,
    customerSnapshot: body.customerSnapshot || undefined,
    pricelist: body.pricelist || null,
    appliedPricelist: body.appliedPricelist || undefined,
    currency: body.currency || 'NGN',
    items,
    ...totals,
    validUntil: body.validUntil || undefined,
    notes: body.notes, terms: body.terms,
    ...(docType === 'quotation' ? { quoteStatus: 'draft' } : { orderStatus: 'draft' }),
  });
}

module.exports = { lineTotalOf, computeTotals, createSalesOrderDoc };
