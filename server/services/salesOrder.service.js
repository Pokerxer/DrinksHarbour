// server/services/salesOrder.service.js
const SalesOrder = require('../models/SalesOrder');
const { generateSalesOrderNumber } = require('../utils/orderUtils');

/** Compute a single line's UNTAXED total: (unitPrice - discount) * quantity, floored at 0. */
function lineTotalOf(item) {
  const unit = Math.max(0, (Number(item.unitPrice) || 0) - (Number(item.discount) || 0));
  return unit * (Number(item.quantity) || 0);
}

/**
 * Per-line tax (tax-exclusive): the line's untaxed total * taxRate%. Rounded to
 * the nearest integer minor unit so order taxTotal is the sum of clean line taxes.
 */
function lineTaxOf(item) {
  const rate = Math.max(0, Number(item.taxRate) || 0);
  if (rate <= 0) return 0;
  return Math.round(lineTotalOf(item) * (rate / 100));
}

/**
 * Roll item lines into Odoo-style totals (NGN integer):
 *   subtotal      gross, sum(unitPrice * qty) — pre-discount
 *   discountTotal sum(discount * qty)
 *   taxTotal      sum(per-line tax on the post-discount line total)
 *   total         grand total = (subtotal - discountTotal) + taxTotal
 * The "Untaxed Amount" Odoo row is (subtotal - discountTotal).
 */
function computeTotals(items) {
  let subtotal = 0, discountTotal = 0, taxTotal = 0;
  for (const it of items) {
    subtotal += (Number(it.unitPrice) || 0) * (Number(it.quantity) || 0);
    discountTotal += (Number(it.discount) || 0) * (Number(it.quantity) || 0);
    taxTotal += lineTaxOf(it);
  }
  const untaxed = Math.max(0, subtotal - discountTotal);
  return { subtotal, discountTotal, taxTotal, total: untaxed + taxTotal };
}

/**
 * Build + persist a SalesOrder. Snapshots line totals and order totals.
 * docType 'quotation' starts quoteStatus='draft'; 'order' starts orderStatus='draft'.
 */
/** Normalize one inbound line into a stored line, snapshotting tax + totals. */
function mapLine(it) {
  return {
    product: it.product, subproduct: it.subproduct, size: it.size,
    sku: it.sku, name: it.name,
    quantity: Number(it.quantity) || 0,
    unitPrice: Number(it.unitPrice) || 0,
    discount: Number(it.discount) || 0,
    taxRate: Math.max(0, Number(it.taxRate) || 0),
    taxAmount: lineTaxOf(it),
    lineTotal: lineTotalOf(it),
  };
}

async function createSalesOrderDoc({ tenantId, body }) {
  const docType = body.docType === 'quotation' ? 'quotation' : 'order';
  const items = (body.items || []).map(mapLine);
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
    ...totals, // subtotal, discountTotal, taxTotal, total
    validUntil: body.validUntil || undefined,
    notes: body.notes, terms: body.terms,
    ...(docType === 'quotation' ? { quoteStatus: 'draft' } : { orderStatus: 'draft' }),
  });
}

function canEdit(so) {
  if (so.docType === 'quotation') return ['draft', 'sent'].includes(so.quoteStatus);
  return so.orderStatus === 'draft';
}

function canCancel(so) {
  if (so.docType === 'quotation') return !['converted', 'rejected'].includes(so.quoteStatus);
  return !['fulfilled', 'cancelled'].includes(so.orderStatus);
}

/** Re-snapshot line prices + totals from an edit body. Mutates `so` in place. */
function applyEdit(so, body) {
  if (Array.isArray(body.items)) {
    so.items = body.items.map(mapLine);
    const totals = computeTotals(so.items);
    so.subtotal = totals.subtotal;
    so.discountTotal = totals.discountTotal;
    so.taxTotal = totals.taxTotal;
    so.total = totals.total;
  }
  if (body.notes !== undefined) so.notes = body.notes;
  if (body.terms !== undefined) so.terms = body.terms;
  if (body.validUntil !== undefined) so.validUntil = body.validUntil;
}

/**
 * Convert an accepted/draft/sent quotation into a new draft order.
 * Copies the pricing snapshot verbatim (no re-pricing); resets fulfillment
 * counters on each line. Links both docs and marks the quotation converted.
 */
async function convertQuotationToOrder(quotation) {
  const soNumber = await generateSalesOrderNumber();
  const order = await SalesOrder.create({
    tenant: quotation.tenant,
    soNumber,
    docType: 'order',
    customer: quotation.customer,
    customerSnapshot: quotation.customerSnapshot,
    pricelist: quotation.pricelist,
    appliedPricelist: quotation.appliedPricelist,
    currency: quotation.currency,
    items: quotation.items.map((it) => ({
      product: it.product, subproduct: it.subproduct, size: it.size,
      sku: it.sku, name: it.name,
      quantity: it.quantity, unitPrice: it.unitPrice, discount: it.discount,
      taxRate: it.taxRate, taxAmount: it.taxAmount,
      lineTotal: it.lineTotal,
      fulfilledQty: 0, postedQty: 0, returnedQty: 0,
    })),
    subtotal: quotation.subtotal, discountTotal: quotation.discountTotal,
    taxTotal: quotation.taxTotal, total: quotation.total,
    notes: quotation.notes, terms: quotation.terms,
    orderStatus: 'draft',
    convertedFrom: quotation._id,
  });
  quotation.quoteStatus = 'converted';
  quotation.convertedTo = order._id;
  await quotation.save();
  return order;
}

module.exports = {
  lineTotalOf, lineTaxOf, mapLine, computeTotals, createSalesOrderDoc,
  canEdit, canCancel, applyEdit, convertQuotationToOrder,
};
