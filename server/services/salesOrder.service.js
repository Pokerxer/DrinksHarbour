// server/services/salesOrder.service.js
const SalesOrder = require('../models/SalesOrder');
const { generateSalesOrderNumber } = require('../utils/orderUtils');

/**
 * Odoo-style payment-term presets. `days` is the offset from the document's
 * base (creation) date; `end_of_month` is special-cased in computeDueDate.
 */
const PAYMENT_TERMS = [
  { key: 'immediate',    label: 'Immediate Payment', days: 0 },
  { key: 'net_7',        label: '7 Days',            days: 7 },
  { key: 'net_15',       label: '15 Days',           days: 15 },
  { key: 'net_30',       label: '30 Days',           days: 30 },
  { key: 'net_45',       label: '45 Days',           days: 45 },
  { key: 'net_60',       label: '60 Days',           days: 60 },
  { key: 'end_of_month', label: 'End of this Month', days: null },
];
const PAYMENT_TERM_KEYS = PAYMENT_TERMS.map((t) => t.key);

/** Resolve a payment term to a concrete due date off the given base date. */
function computeDueDate(termKey, baseDate = new Date()) {
  const base = baseDate instanceof Date ? baseDate : new Date(baseDate);
  if (termKey === 'end_of_month') {
    // Day 0 of the *next* month is the last day of this month.
    return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0,
      base.getUTCHours(), base.getUTCMinutes(), base.getUTCSeconds(), base.getUTCMilliseconds()));
  }
  const term = PAYMENT_TERMS.find((t) => t.key === termKey);
  const days = term ? term.days : 0; // unknown/blank => immediate
  const due = new Date(base);
  due.setUTCDate(due.getUTCDate() + (days || 0));
  return due;
}

/** Normalize an inbound payment-term key, defaulting to 'immediate'. */
function normalizePaymentTerms(termKey) {
  return PAYMENT_TERM_KEYS.includes(termKey) ? termKey : 'immediate';
}

/** The structured address fields we capture/snapshot (order matters for output). */
const ADDRESS_FIELDS = ['name', 'phone', 'street', 'city', 'state', 'country'];

/**
 * Clean an inbound address into the 6 known string fields (trimmed, missing →
 * ''), or undefined if the whole thing is blank. Pure: no DB, no validation.
 */
function normalizeAddress(addr) {
  if (!addr || typeof addr !== 'object') return undefined;
  const clean = {};
  let hasAny = false;
  for (const f of ADDRESS_FIELDS) {
    const v = (addr[f] == null ? '' : String(addr[f])).trim();
    clean[f] = v;
    if (v) hasAny = true;
  }
  return hasAny ? clean : undefined;
}

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
  // Tax is charged on the post-promotion untaxed base (discount-before-tax).
  const base = Math.max(0, lineTotalOf(item) - (Number(item.promoDiscount) || 0));
  return Math.round(base * (rate / 100));
}

/**
 * The real promotion engine, but ONLY when a DB connection is live. Without one
 * (unit tests, offline) it returns null so resolveLinePromotions skips the
 * lookup instead of hanging on Mongoose command buffering.
 */
function defaultPromotionEngine() {
  try {
    const mongoose = require('mongoose');
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      return require('./promotion.service').calculateDiscountForItem;
    }
  } catch {
    // mongoose/promotion.service unavailable — treat as no promotions
  }
  return null;
}

/**
 * Resolve automatic promotions per product line. For each line with a
 * subproduct + positive untaxed base, ask the promotion engine for the best
 * applicable discount and attach `promoDiscount` (₦ off the line, capped at the
 * base) + `promoName`. Best-effort: a promotion failure never blocks the order.
 * The engine fn is injected for test isolation; defaults to promotion.service.
 */
async function resolveLinePromotions(items, deps = {}) {
  const tenantId = deps.tenantId;
  const calc = deps.calculateDiscountForItem || defaultPromotionEngine();
  const out = [];
  for (const it of items) {
    let promoDiscount = 0;
    let promoName = '';
    const base = lineTotalOf(it);
    if (calc && it.subproduct && base > 0) {
      try {
        const r = await calc(tenantId, it.subproduct, it.size, base, Number(it.quantity) || 0);
        promoDiscount = Math.min(base, Math.max(0, Math.round(Number(r && r.discount) || 0)));
        promoName =
          (r && r.appliedPromotions && r.appliedPromotions[0] && r.appliedPromotions[0].name) || '';
      } catch {
        // promotions are best-effort; never block order creation/edit
      }
    }
    out.push({ ...it, promoDiscount, promoName });
  }
  return out;
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
  let subtotal = 0, discountTotal = 0, promotionTotal = 0, taxTotal = 0;
  for (const it of items) {
    subtotal += (Number(it.unitPrice) || 0) * (Number(it.quantity) || 0);
    discountTotal += (Number(it.discount) || 0) * (Number(it.quantity) || 0);
    promotionTotal += Number(it.promoDiscount) || 0;
    taxTotal += lineTaxOf(it);
  }
  const untaxed = Math.max(0, subtotal - discountTotal - promotionTotal);
  return { subtotal, discountTotal, promotionTotal, taxTotal, total: untaxed + taxTotal };
}

/** Normalize one inbound line into a stored line, snapshotting tax + totals. */
function mapLine(it) {
  return {
    product: it.product, subproduct: it.subproduct, size: it.size,
    sku: it.sku, name: it.name,
    quantity: Number(it.quantity) || 0,
    unitPrice: Number(it.unitPrice) || 0,
    discount: Number(it.discount) || 0,
    taxRate: Math.max(0, Number(it.taxRate) || 0),
    promoDiscount: Math.max(0, Number(it.promoDiscount) || 0),
    promoName: it.promoName || '',
    taxAmount: lineTaxOf(it),
    lineTotal: lineTotalOf(it),
  };
}

/**
 * Build + persist a SalesOrder. Snapshots line totals and order totals.
 * docType 'quotation' starts quoteStatus='draft'; 'order' starts orderStatus='draft'.
 */
async function createSalesOrderDoc({ tenantId, body }) {
  const docType = body.docType === 'quotation' ? 'quotation' : 'order';
  const withPromos = await resolveLinePromotions(body.items || [], { tenantId });
  const items = withPromos.map(mapLine);
  const totals = computeTotals(items);
  const soNumber = await generateSalesOrderNumber();
  const paymentTerms = normalizePaymentTerms(body.paymentTerms);

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
    paymentTerms,
    dueDate: computeDueDate(paymentTerms),
    invoiceAddress: normalizeAddress(body.invoiceAddress),
    deliveryAddress: normalizeAddress(body.deliveryAddress),
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
async function applyEdit(so, body) {
  if (Array.isArray(body.items)) {
    const withPromos = await resolveLinePromotions(body.items, { tenantId: so.tenant });
    so.items = withPromos.map(mapLine);
    const totals = computeTotals(so.items);
    so.subtotal = totals.subtotal;
    so.discountTotal = totals.discountTotal;
    so.promotionTotal = totals.promotionTotal;
    so.taxTotal = totals.taxTotal;
    so.total = totals.total;
  }
  if (body.notes !== undefined) so.notes = body.notes;
  if (body.terms !== undefined) so.terms = body.terms;
  if (body.validUntil !== undefined) so.validUntil = body.validUntil;
  if (body.paymentTerms !== undefined) {
    so.paymentTerms = normalizePaymentTerms(body.paymentTerms);
    // Recompute due date off the original document date, not "now".
    so.dueDate = computeDueDate(so.paymentTerms, so.createdAt || new Date());
  }
  if (body.invoiceAddress !== undefined) so.invoiceAddress = normalizeAddress(body.invoiceAddress);
  if (body.deliveryAddress !== undefined) so.deliveryAddress = normalizeAddress(body.deliveryAddress);
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
      promoDiscount: it.promoDiscount, promoName: it.promoName,
      lineTotal: it.lineTotal,
      fulfilledQty: 0, postedQty: 0, returnedQty: 0,
    })),
    subtotal: quotation.subtotal, discountTotal: quotation.discountTotal,
    promotionTotal: quotation.promotionTotal,
    taxTotal: quotation.taxTotal, total: quotation.total,
    paymentTerms: quotation.paymentTerms || 'immediate',
    dueDate: computeDueDate(quotation.paymentTerms || 'immediate'),
    invoiceAddress: normalizeAddress(quotation.invoiceAddress),
    deliveryAddress: normalizeAddress(quotation.deliveryAddress),
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
  PAYMENT_TERMS, computeDueDate, normalizePaymentTerms, normalizeAddress,
  resolveLinePromotions,
};
