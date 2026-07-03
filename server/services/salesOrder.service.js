// server/services/salesOrder.service.js
const SalesOrder = require('../models/SalesOrder');
const { generateSalesOrderNumber } = require('../utils/orderUtils');
const { logActivity, statusSubject } = require('./salesActivity.service');

/**
 * F3: reject client-supplied foreign keys that don't belong to the acting
 * tenant. Without this, a tenant user could reference another tenant's customer,
 * warehouse, or pricelist id (it would persist as a dangling cross-tenant ref).
 * Each id is optional — only present ones are checked. Throws an Error tagged
 * `.status = 400` (caught by the controller's async handler) on a mismatch.
 *
 * Best-effort like the pricing/promotion engines: if there's no live DB
 * connection (unit tests, offline) the lookups are skipped rather than hanging
 * on Mongoose command buffering.
 */
async function assertTenantOwnedRefs({ tenantId, customer, warehouseId, pricelist }) {
  let mongoose;
  try {
    mongoose = require('mongoose');
  } catch {
    return; // mongoose unavailable — nothing to validate against
  }
  if (!mongoose.connection || mongoose.connection.readyState !== 1) return;

  const checks = [];
  if (customer) {
    const POSCustomer = require('../models/POSCustomer');
    checks.push(
      POSCustomer.exists({ _id: customer, tenant: tenantId }).then((ok) => {
        if (!ok) throw fkError('customer', customer);
      })
    );
  }
  if (warehouseId) {
    const Warehouse = require('../models/Warehouse');
    checks.push(
      Warehouse.exists({ _id: warehouseId, tenant: tenantId }).then((ok) => {
        if (!ok) throw fkError('warehouse', warehouseId);
      })
    );
  }
  if (pricelist) {
    const Pricelist = require('../models/Pricelist');
    checks.push(
      Pricelist.exists({ _id: pricelist, tenant: tenantId }).then((ok) => {
        if (!ok) throw fkError('pricelist', pricelist);
      })
    );
  }
  await Promise.all(checks);
}

function fkError(kind, id) {
  const err = new Error(`Invalid ${kind} reference: ${id} does not belong to this tenant`);
  err.status = 400;
  return err;
}

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

/** Absolute ₦ discount off the WHOLE line, clamped to the line's gross.
 *  discountType 'percentage' = percent of each unit (scales with quantity);
 *  'fixed' = a flat ₦ amount off the whole line (independent of quantity).
 *  Section/note lines carry no discount. */
function lineDiscountOf(item) {
  if (item.lineType && item.lineType !== 'product') return 0;
  const gross = (Number(item.unitPrice) || 0) * (Number(item.quantity) || 0);
  const raw = Math.max(0, Number(item.discount) || 0);
  if (item.discountType === 'percentage') {
    return Math.min(gross, Math.round((gross * Math.min(100, raw)) / 100));
  }
  return Math.min(gross, raw);
}

/** Compute a single line's UNTAXED total: gross − line discount, floored at 0.
 *  Section/note lines carry no price and contribute nothing. */
function lineTotalOf(item) {
  if (item.lineType && item.lineType !== 'product') return 0;
  const gross = (Number(item.unitPrice) || 0) * (Number(item.quantity) || 0);
  return Math.max(0, gross - lineDiscountOf(item));
}

/**
 * Per-line tax (tax-exclusive): the line's untaxed total * taxRate%. Rounded to
 * the nearest integer minor unit so order taxTotal is the sum of clean line taxes.
 */
function lineTaxOf(item) {
  if (item.lineType && item.lineType !== 'product') return 0;
  const rate = Math.max(0, Number(item.taxRate) || 0);
  if (rate <= 0) return 0;
  // Tax is charged on the post-promotion untaxed base (discount-before-tax).
  const base = Math.max(0, lineTotalOf(item) - (Number(item.promoDiscount) || 0));
  return Math.round(base * (rate / 100));
}

/**
 * The authoritative pricing engine, but ONLY when a DB connection is live —
 * same guard as defaultPromotionEngine below: without one (unit tests,
 * offline) resolveLinePricing skips the lookup instead of hanging on
 * Mongoose command buffering, leaving items' submitted unitPrice untouched.
 */
function defaultPricingEngine() {
  try {
    const mongoose = require('mongoose');
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      return require('./salesPricing.service').computeAuthoritativeLinePrices;
    }
  } catch {
    // mongoose/salesPricing.service unavailable — treat as no recompute
  }
  return null;
}

/**
 * Recompute unitPrice for every line against the tenant's pricelist (price
 * rules + bundle deals) unless a line is priceOverridden — those are trusted
 * verbatim (the operator typed a manual price). Best-effort: a missing DB
 * connection or a lookup failure leaves items unchanged. The engine fn is
 * injected for test isolation; defaults to salesPricing.service.
 */
async function resolveLinePricing(items, deps = {}) {
  const compute = deps.computeAuthoritativeLinePrices || defaultPricingEngine();
  if (!compute) return items;
  try {
    return await compute(items, { tenantId: deps.tenantId, pricelistId: deps.pricelistId });
  } catch {
    return items;
  }
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
 *   discountTotal sum(per-line discount off the whole line)
 *   taxTotal      sum(per-line tax on the post-discount line total)
 *   total         grand total = (subtotal - discountTotal) + taxTotal
 * The "Untaxed Amount" Odoo row is (subtotal - discountTotal).
 */
function computeTotals(items) {
  let subtotal = 0, discountTotal = 0, promotionTotal = 0, taxTotal = 0;
  for (const it of items) {
    // Section/note lines are presentational only — excluded from all totals.
    if (it.lineType && it.lineType !== 'product') continue;
    subtotal += (Number(it.unitPrice) || 0) * (Number(it.quantity) || 0);
    discountTotal += lineDiscountOf(it);
    promotionTotal += Number(it.promoDiscount) || 0;
    taxTotal += lineTaxOf(it);
  }
  const untaxed = Math.max(0, subtotal - discountTotal - promotionTotal);
  return { subtotal, discountTotal, promotionTotal, taxTotal, total: untaxed + taxTotal };
}

/**
 * Re-derive the grand total from the order's stored totals plus the footer
 * adjustments (coupon discount, pricelist cart discount, shipping fee).
 * Single place where the final `total` is assembled so
 * create/edit/recompute/coupon paths can't drift:
 *   total = max(0, (subtotal - discountTotal - promotionTotal) + taxTotal
 *                  - couponDiscount - pricelistCartDiscount) + shippingFee
 */
function refreshOrderTotal(so) {
  const untaxed = Math.max(
    0,
    (Number(so.subtotal) || 0) - (Number(so.discountTotal) || 0) - (Number(so.promotionTotal) || 0)
  );
  const beforeAdjust = untaxed + (Number(so.taxTotal) || 0);
  so.total =
    Math.max(
      0,
      beforeAdjust - (Number(so.couponDiscount) || 0) - (Number(so.pricelistCartDiscount) || 0)
    ) +
    Math.max(0, Number(so.shippingFee) || 0);
  return so;
}

/**
 * Cart spend-threshold discount (cart_threshold pricelist rules) for the
 * order's untaxed base. Live-DB guarded like the pricing/promotion engines so
 * offline unit tests never hang on Mongoose buffering; any failure → 0.
 */
async function resolveCartThresholdDiscount(so, pricelistId, deps = {}) {
  const compute = deps.computeCartThresholdForOrder || (() => {
    try {
      const mongoose = require('mongoose');
      if (mongoose.connection && mongoose.connection.readyState === 1) {
        return require('./salesPricing.service').computeCartThresholdForOrder;
      }
    } catch { /* mongoose/salesPricing unavailable — no threshold discount */ }
    return null;
  })();
  if (!compute || !pricelistId) return 0;
  const base = Math.max(
    0,
    (Number(so.subtotal) || 0) - (Number(so.discountTotal) || 0) - (Number(so.promotionTotal) || 0)
  );
  try {
    return Math.max(0, Math.round(Number(await compute(base, { tenantId: so.tenant, pricelistId })) || 0));
  } catch {
    return 0;
  }
}

/**
 * Apply (or clear, when `code` is falsy) a coupon to an editable order. The
 * code must match a tenant Promotion (Promotion.findByCode: active + enabled)
 * with a percentage/fixed discountValue; the resolved ₦ discount is snapshotted
 * on the order and the grand total refreshed. `deps.findByCode` is injectable
 * for offline tests. Usage-count tracking is not implemented yet.
 */
async function applyCouponToOrder(so, code, deps = {}) {
  if (!code) {
    so.couponCode = '';
    so.couponName = '';
    so.couponDiscount = 0;
    return refreshOrderTotal(so);
  }
  const findByCode =
    deps.findByCode ||
    ((tenantId, c) => require('../models/Promotion').findByCode(tenantId, c));
  const promo = await findByCode(so.tenant, String(code).trim());
  if (!promo) {
    const err = new Error('Invalid or inactive coupon code');
    err.statusCode = 400;
    throw err;
  }
  const now = new Date();
  if (promo.endDate && new Date(promo.endDate) < now) {
    const err = new Error('This coupon has expired');
    err.statusCode = 400;
    throw err;
  }
  const untaxed = Math.max(
    0,
    (Number(so.subtotal) || 0) - (Number(so.discountTotal) || 0) - (Number(so.promotionTotal) || 0)
  );
  const base = untaxed + (Number(so.taxTotal) || 0);
  const value = Math.max(0, Number(promo.discountValue) || 0);
  let discount =
    promo.discountType === 'fixed' ? value : Math.round((base * Math.min(100, value)) / 100);
  const cap = Number(promo.maxDiscountAmount) || 0;
  if (cap > 0) discount = Math.min(discount, cap);
  discount = Math.min(discount, base);
  so.couponCode = String(promo.code || code).toUpperCase();
  so.couponName = promo.name || '';
  so.couponDiscount = discount;
  return refreshOrderTotal(so);
}

/** Normalize one inbound line into a stored line, snapshotting tax + totals.
 *  Preserves the lineType discriminator; section/note lines carry no product
 *  reference and zero pricing so they never affect totals. */
function mapLine(input) {
  // Unconditional toObject(): a hydrated Mongoose subdocument spread with
  // `{ ...subdoc }` copies internals, NOT schema fields — quantity/taxRate/
  // promoDiscount vanish and the lineTotal/taxAmount snapshots persist as 0
  // (same pitfall recomputeOrderPricing already guards against).
  const it = typeof input.toObject === 'function' ? input.toObject() : input;
  const lineType = it.lineType === 'section' || it.lineType === 'note' ? it.lineType : 'product';
  if (lineType !== 'product') {
    return {
      lineType,
      product: undefined, subproduct: undefined, size: undefined,
      sku: '', name: it.name || '',
      description: it.description || '',
      quantity: 0, unitPrice: 0, discount: 0,
      taxRate: 0, promoDiscount: 0, promoName: '',
      taxAmount: 0, lineTotal: 0, priceOverridden: false,
    };
  }
  // Store the operator's raw discount input verbatim (percentage clamped to
  // 0–100; fixed as an absolute ₦ figure). It's interpreted against the line —
  // 'percentage' as a percent of each unit, 'fixed' as a flat ₦ off the whole
  // line — by lineDiscountOf, which drives the totals and the stored snapshot.
  const unitPrice = Number(it.unitPrice) || 0;
  const discountType = it.discountType === 'percentage' ? 'percentage' : 'fixed';
  const rawDiscount = Math.max(0, Number(it.discount) || 0);
  const discount =
    discountType === 'percentage' ? Math.min(100, rawDiscount) : rawDiscount;
  const lineForTotals = { ...it, lineType, unitPrice, discount, discountType };

  return {
    lineType,
    product: it.product, subproduct: it.subproduct, size: it.size,
    sku: it.sku, name: it.name,
    description: it.description || '',
    quantity: Number(it.quantity) || 0,
    unitPrice,
    discount,
    discountType,
    taxRate: Math.max(0, Number(it.taxRate) || 0),
    promoDiscount: Math.max(0, Number(it.promoDiscount) || 0),
    promoName: it.promoName || '',
    taxAmount: lineTaxOf(lineForTotals),
    lineTotal: lineTotalOf(lineForTotals),
    priceOverridden: !!it.priceOverridden,
  };
}

/**
 * Build + persist a SalesOrder. Snapshots line totals and order totals.
 * docType 'quotation' starts quoteStatus='draft'; 'order' starts orderStatus='draft'.
 */
async function createSalesOrderDoc({ tenantId, salesperson, body }) {
  const docType = body.docType === 'quotation' ? 'quotation' : 'order';
  await assertTenantOwnedRefs({
    tenantId,
    customer: body.customer,
    warehouseId: body.warehouseId,
    pricelist: body.pricelist,
  });

  // Derive appliedPricelist snapshot server-side from the validated pricelist doc
  // rather than trusting the client-supplied snapshot verbatim.
  let appliedPricelist;
  if (body.pricelist) {
    try {
      const Pricelist = require('../models/Pricelist');
      const pl = await Pricelist.findById(body.pricelist).select('name').lean();
      appliedPricelist = pl ? { pricelistId: pl._id, pricelistName: pl.name } : undefined;
    } catch {
      appliedPricelist = undefined;
    }
  }

  const priced = await resolveLinePricing(body.items || [], { tenantId, pricelistId: body.pricelist });
  const withPromos = await resolveLinePromotions(priced, { tenantId });
  const items = withPromos.map(mapLine);
  const totals = computeTotals(items);
  const soNumber = await generateSalesOrderNumber();
  const paymentTerms = normalizePaymentTerms(body.paymentTerms);

  const shippingFee = Math.max(0, Number(body.shippingFee) || 0);
  const pricelistCartDiscount = await resolveCartThresholdDiscount(
    { ...totals, tenant: tenantId },
    body.pricelist
  );
  totals.total = Math.max(0, totals.total - pricelistCartDiscount) + shippingFee;
  return SalesOrder.create({
    tenant: tenantId,
    soNumber,
    docType,
    salesperson: salesperson || body.salesperson || '',
    customer: body.customer || undefined,
    customerSnapshot: body.customerSnapshot || undefined,
    pricelist: body.pricelist || null,
    appliedPricelist,
    currency: body.currency || 'NGN',
    items,
    ...totals, // subtotal, discountTotal, taxTotal, total (refreshed below for footer adjustments)
    pricelistCartDiscount,
    shippingFee: Math.max(0, Number(body.shippingFee) || 0),
    plannedRedeemPoints: Math.max(0, Math.round(Number(body.plannedRedeemPoints) || 0)),
    validUntil: body.validUntil || undefined,
    paymentTerms,
    dueDate: computeDueDate(paymentTerms),
    invoiceAddress: normalizeAddress(body.invoiceAddress),
    deliveryAddress: normalizeAddress(body.deliveryAddress),
    notes: body.notes, terms: body.terms,
    warehouseId: body.warehouseId || null,
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

/**
 * Recompute unit prices + all order totals from `so`'s CURRENT line set against
 * the order's current pricelist (`so.pricelist`), then re-snapshot each line and
 * the order totals. Mutates `so.items` and totals in place and returns `so`.
 * When `clearOverrides` is true, every product line's `priceOverridden` flag is
 * dropped first so the pricelist engine re-prices lines the operator had
 * manually overridden. Shared by `applyEdit` and `updatePricesForOrder`.
 */
async function recomputeOrderPricing(so, { tenantId, clearOverrides = false } = {}) {
  const source = (so.items || []).map((it) => {
    const raw = typeof it.toObject === 'function' ? it.toObject() : { ...it };
    return clearOverrides ? { ...raw, priceOverridden: false } : raw;
  });
  const priced = await resolveLinePricing(source, { tenantId, pricelistId: so.pricelist });
  const withPromos = await resolveLinePromotions(priced, { tenantId });
  so.items = withPromos.map(mapLine);
  const totals = computeTotals(so.items);
  so.subtotal = totals.subtotal;
  so.discountTotal = totals.discountTotal;
  so.promotionTotal = totals.promotionTotal;
  so.taxTotal = totals.taxTotal;
  so.pricelistCartDiscount = await resolveCartThresholdDiscount(so, so.pricelist);
  refreshOrderTotal(so);
  return so;
}

/**
 * Re-price every product line from the order's current pricelist, clearing any
 * manual price overrides first, and re-snapshot totals. Mutates `so` in place.
 */
async function updatePricesForOrder(so, { tenantId } = {}) {
  await recomputeOrderPricing(so, { tenantId, clearOverrides: true });
  return so;
}

/** Re-snapshot line prices + totals from an edit body. Mutates `so` in place. */
async function applyEdit(so, body) {
  // Validate only the FKs this patch actually touches, scoped to the order's
  // own tenant. `undefined` = field omitted (skip); a present value (incl. a
  // real id) is checked. Clearing to null/'' is allowed and not validated.
  await assertTenantOwnedRefs({
    tenantId: so.tenant,
    customer: body.customer !== undefined ? body.customer : undefined,
    warehouseId: body.warehouseId !== undefined ? body.warehouseId : undefined,
    pricelist: body.pricelist !== undefined ? body.pricelist : undefined,
  });
  // Customer change: mirror createSalesOrderDoc's convention — trust the
  // client-provided snapshot verbatim (no server-side rebuild from the id).
  // `body.customer !== undefined` means the edit payload touched the customer
  // field. The client sends a real id to change customer, `null` to clear to
  // walk-in (NOT undefined — that would be JSON-omitted and skip this guard,
  // leaving the old customer in place). When a customer is sent the snapshot
  // comes with it; on a `null` clear we drop the snapshot too. Omission (the
  // field absent from the patch entirely) leaves both stored fields untouched.
  if (body.customer !== undefined) {
    so.customer = body.customer || undefined;
    so.customerSnapshot = body.customerSnapshot || undefined;
  }
  // Capture the SO's pricelist BEFORE any body.pricelist update so we can
  // detect whether the pricelist actually changed.
  const origPricelist = String(so.pricelist || '');

  if (body.pricelist !== undefined) {
    const pricelistChanged = String(body.pricelist || '') !== origPricelist;
    so.pricelist = body.pricelist || null;
    // Derive appliedPricelist snapshot server-side from the actual pricelist doc.
    if (body.pricelist) {
      try {
        const Pricelist = require('../models/Pricelist');
        const pl = await Pricelist.findById(body.pricelist).select('name').lean();
        so.appliedPricelist = pl ? { pricelistId: pl._id, pricelistName: pl.name } : undefined;
      } catch {
        so.appliedPricelist = undefined;
      }
    } else {
      so.appliedPricelist = undefined;
    }
    // When pricelist changes but items weren't included in the patch, re-price
    // the existing stored lines against the new pricelist rather than leaving
    // stale prices on the order.
    if (pricelistChanged && !Array.isArray(body.items)) {
      await recomputeOrderPricing(so, { tenantId: so.tenant });
    }
  }
  if (Array.isArray(body.items)) {
    // Skip the DB-backed pricing engine when the pricelist hasn't actually
    // changed — the client already computed prices against the same pricelist.
    // Still map and total them for normalization. This avoids redundant DB
    // lookups on every autosave (the common case = user edited qty, not pricelist).
    const pricelistSame = body.pricelist !== undefined &&
      String(body.pricelist || '') === origPricelist;
    if (pricelistSame) {
      // Map the plain body items BEFORE assigning to so.items — assigning
      // first casts them to subdocuments, which mapLine then has to unwrap.
      so.items = body.items.map(mapLine);
      const totals = computeTotals(so.items);
      so.subtotal = totals.subtotal;
      so.discountTotal = totals.discountTotal;
      so.promotionTotal = totals.promotionTotal;
      so.taxTotal = totals.taxTotal;
      // The spend-threshold discount depends on the subtotal, so it must be
      // refreshed even on this line-only fast path (single pricelist lookup —
      // still skips the per-line pricing engine).
      so.pricelistCartDiscount = await resolveCartThresholdDiscount(so, so.pricelist);
      refreshOrderTotal(so);
    } else {
      so.items = body.items;
      await recomputeOrderPricing(so, { tenantId: so.tenant });
    }
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
  if (body.warehouseId !== undefined) so.warehouseId = body.warehouseId || null;
  if (body.shippingFee !== undefined) {
    so.shippingFee = Math.max(0, Number(body.shippingFee) || 0);
    refreshOrderTotal(so);
  }
  if (body.plannedRedeemPoints !== undefined) {
    so.plannedRedeemPoints = Math.max(0, Math.round(Number(body.plannedRedeemPoints) || 0));
  }
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
      priceOverridden: it.priceOverridden,
      fulfilledQty: 0, postedQty: 0, returnedQty: 0,
    })),
    subtotal: quotation.subtotal, discountTotal: quotation.discountTotal,
    promotionTotal: quotation.promotionTotal,
    pricelistCartDiscount: quotation.pricelistCartDiscount || 0,
    taxTotal: quotation.taxTotal, total: quotation.total,
    paymentTerms: quotation.paymentTerms || 'immediate',
    dueDate: computeDueDate(quotation.paymentTerms || 'immediate'),
    salesperson: quotation.salesperson || '',
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

/**
 * Deep-clone a sales order into a new draft document. Resets status, fulfillment
 * counters, payment fields, and linked document references.
 */
async function duplicateSalesOrderDoc(so) {
  const soNumber = await generateSalesOrderNumber();
  const items = (so.items || []).map((it) => {
    const raw = typeof it.toObject === 'function' ? it.toObject() : { ...it };
    return {
      lineType: raw.lineType || 'product',
      product: raw.product, subproduct: raw.subproduct, size: raw.size,
      sku: raw.sku, name: raw.name, description: raw.description,
      quantity: raw.quantity, unitPrice: raw.unitPrice,
      discount: raw.discount, discountType: raw.discountType,
      taxRate: raw.taxRate, promoDiscount: raw.promoDiscount, promoName: raw.promoName,
      taxAmount: raw.taxAmount, lineTotal: raw.lineTotal,
      priceOverridden: raw.priceOverridden,
      fulfilledQty: 0, postedQty: 0, returnedQty: 0,
    };
  });
  const newDoc = new SalesOrder({
    tenant: so.tenant,
    soNumber,
    docType: so.docType,
    customer: so.customer,
    customerSnapshot: so.customerSnapshot,
    pricelist: so.pricelist,
    appliedPricelist: so.appliedPricelist,
    currency: so.currency,
    items,
    subtotal: so.subtotal, discountTotal: so.discountTotal,
    promotionTotal: so.promotionTotal, pricelistCartDiscount: so.pricelistCartDiscount || 0,
    taxTotal: so.taxTotal, total: so.total,
    paymentTerms: so.paymentTerms || 'immediate',
    dueDate: so.dueDate,
    invoiceAddress: so.invoiceAddress, deliveryAddress: so.deliveryAddress,
    notes: so.notes, terms: so.terms,
    validUntil: so.validUntil, warehouseId: so.warehouseId,
    fulfillments: [],
    convertedFrom: undefined, convertedTo: undefined, relatedInvoice: undefined,
    paymentStatus: 'unpaid', amountPaid: 0, walletTxRef: undefined,
    loyaltyEarned: 0, loyaltyRedeemed: 0, pointsRedeemed: 0,
    quoteStatus: so.docType === 'quotation' ? 'draft' : undefined,
    orderStatus: so.docType === 'order' ? 'draft' : undefined,
  });
  return newDoc.save();
}

/**
 * Build a MongoDB query object from an array of structured filter objects.
 * Accepts a JSON string or a parsed array. Returns an empty object on invalid
 * input so callers can safely Object.assign it into their query.
 */
function buildFilterQuery(filtersRaw) {
  if (!filtersRaw) return {};
  let filters;
  try {
    filters = typeof filtersRaw === 'string' ? JSON.parse(filtersRaw) : filtersRaw;
  } catch {
    return {};
  }
  if (!Array.isArray(filters)) return {};

  const q = {};
  for (const f of filters) {
    if (!f.field || !f.operator) continue;
    const val = f.value;
    switch (f.operator) {
      case 'equals': q[f.field] = val; break;
      case 'not_equals': q[f.field] = { $ne: val }; break;
      case 'contains': q[f.field] = { $regex: String(val), $options: 'i' }; break;
      case 'gt': q[f.field] = { $gt: Number(val) }; break;
      case 'gte': q[f.field] = { $gte: Number(val) }; break;
      case 'lt': q[f.field] = { $lt: Number(val) }; break;
      case 'lte': q[f.field] = { $lte: Number(val) }; break;
      case 'between':
        if (Array.isArray(val) && val.length === 2) {
          q[f.field] = { $gte: new Date(val[0]), $lte: new Date(val[1]) };
        }
        break;
      case 'in': q[f.field] = { $in: Array.isArray(val) ? val : [val] }; break;
    }
  }
  return q;
}

// ─── Bulk action helpers ──────────────────────────────────────────────────────

async function bulkMarkSent(doc) {
  if (doc.docType !== 'quotation') throw new Error(`${doc.soNumber} is not a quotation`);
  if (doc.quoteStatus !== 'draft') throw new Error(`Only draft quotations can be marked as sent, ${doc.soNumber} is ${doc.quoteStatus}`);
  doc.quoteStatus = 'sent';
  await doc.save();
  logActivity(doc.tenant, doc._id, { subject: statusSubject(doc.docType, 'sent') });
  return {};
}

async function bulkDuplicate(doc) {
  const dup = await duplicateSalesOrderDoc(doc);
  return { duplicateId: dup._id };
}

async function bulkDeleteDoc(doc) {
  await SalesOrder.deleteOne({ _id: doc._id });
  return { deleted: true };
}

async function bulkCancelDoc(doc) {
  let action;
  if (doc.docType === 'order') {
    if (['fulfilled', 'cancelled'].includes(doc.orderStatus)) {
      throw new Error(`${doc.soNumber} cannot be cancelled — current status: ${doc.orderStatus}`);
    }
    doc.orderStatus = 'cancelled';
    action = 'cancelled';
  } else {
    if (['converted', 'rejected'].includes(doc.quoteStatus)) {
      throw new Error(`${doc.soNumber} cannot be rejected — current status: ${doc.quoteStatus}`);
    }
    doc.quoteStatus = 'rejected';
    action = 'rejected';
  }
  await doc.save();
  logActivity(doc.tenant, doc._id, { subject: statusSubject(doc.docType, action) });
  return {};
}

async function bulkCreateInvoice(doc) {
  if (doc.docType !== 'order') throw new Error(`${doc.soNumber} is not an order`);
  await SalesOrder.updateOne(
    { _id: doc._id },
    { $set: { orderStatus: 'invoiced' } },
    { runValidators: false }
  );
  return { invoiced: true };
}

async function bulkAccruedRevenue(doc) {
  if (doc.docType !== 'order') throw new Error(`${doc.soNumber} is not an order`);
  if (doc.orderStatus !== 'confirmed') throw new Error(`Only confirmed orders can record accrued revenue, ${doc.soNumber} is ${doc.orderStatus}`);
  console.log(`[ACCRUED REVENUE STUB] Order ${doc.soNumber} (${doc._id}) — total ${doc.total}`);
  return { total: doc.total };
}

async function bulkFollowers(doc, action, userId) {
  if (action === 'add') {
    await SalesOrder.updateOne(
      { _id: doc._id },
      { $addToSet: { followers: { userId, addedAt: new Date() } } },
      { strict: false }
    );
  } else if (action === 'remove') {
    await SalesOrder.updateOne(
      { _id: doc._id },
      { $pull: { followers: { userId } } },
      { strict: false }
    );
  }
  console.log(`[FOLLOWERS] ${action} userId=${userId} on ${doc.soNumber} (${doc._id})`);
  return { action, userId };
}

async function bulkSendEmail(doc, to, subject, body) {
  const emailSvc = require('./email.service');
  try {
    await emailSvc.sendEmail({
      to,
      subject: subject || `Sales Order ${doc.soNumber}`,
      html: body || `<p>Sales Order: ${doc.soNumber}</p>`,
    });
    return { emailSent: true };
  } catch (err) {
    console.log('[BULK_SEND_EMAIL] Email service unavailable:', err.message);
    return { emailSent: false, note: 'Email service not available — logged to console' };
  }
}

/**
 * Map a groupBy ID + subOption to the value extractor function used in
 * getGroupedOrders. Returns (doc) => string | number | Date.
 */
function groupByExtractor(groupBy, groupBySubOption) {
  switch (groupBy) {
    case 'salesperson':
      return (d) => {
        if (d.salesperson && typeof d.salesperson === 'object') return d.salesperson.name;
        if (typeof d.salesperson === 'string') return d.salesperson;
        return 'None';
      };
    case 'customer':
      return (d) => d.customerSnapshot?.name || 'None';
    case 'orderDate': {
      if (!groupBySubOption) return (d) => d.createdAt ? new Date(d.createdAt).toISOString().slice(0, 7) : 'None';
      switch (groupBySubOption) {
        case 'year': return (d) => d.createdAt ? new Date(d.createdAt).getFullYear().toString() : 'None';
        case 'quarter': {
          return (d) => {
            if (!d.createdAt) return 'None';
            const m = new Date(d.createdAt).getMonth();
            return `Q${Math.floor(m / 3) + 1} ${new Date(d.createdAt).getFullYear()}`;
          };
        }
        case 'month': return (d) => d.createdAt ? new Date(d.createdAt).toISOString().slice(0, 7) : 'None';
        case 'week': return (d) => {
          if (!d.createdAt) return 'None';
          const dt = new Date(d.createdAt);
          const dNum = (dt.getDay() + 6) % 7 + 1;
          const start = new Date(dt);
          start.setDate(dt.getDate() - dNum + 1);
          return `${start.toISOString().slice(0, 10)}`;
        };
        case 'day': return (d) => d.createdAt ? new Date(d.createdAt).toISOString().slice(0, 10) : 'None';
        default: return (d) => 'None';
      }
    }
    case 'paymentMethod':
      return (d) => d.paymentMethod || 'None';
    case 'defaultSalesPriceInclude':
      return () => 'N/A';
    case 'general': case 'dates': case 'customer':
    case 'pricing': case 'delivery': case 'status':
    case 'sales': case 'other':
      return (d) => {
        const cat = groupBy;
        const lookup = {
          general: ['createdBy', 'company', 'currency', 'campaign', 'createdBy', 'medium', 'orderReference', 'paymentMethod', 'paymentRef', 'paymentTerms', 'project', 'projectAccount', 'source', 'sourceDocument', 'tags', 'taxCalculationRounding', 'termsConditions', 'transactions', 'warning', 'website'],
          dates: ['createdAt', 'effectiveDate', 'createdAt', 'validUntil', 'updatedAt', 'signedOn'],
          customer: ['customer', 'customerReference', 'invoiceAddress'],
          pricing: ['defaultSalesPriceInclude', 'manuallyAppliedCoupons', 'pricelist', 'taxRoundingMethod'],
          delivery: ['deliveryAddress', 'deliveryDate', 'deliveryMessage', 'deliveryMethod', 'deliveryStatus', 'deliveryCostRecompute', 'incoterm', 'incotermLocation', 'shippingPolicy', 'warehouse'],
          status: ['status', 'invoiceStatus'],
          sales: ['salesTeam', 'salesperson'],
          other: [],
        };
        const fields = lookup[cat] || [];
        return fields.some((f) => {
          const v = d[f];
          return v !== undefined && v !== null && v !== '';
        }) ? 'Has fields' : 'None';
      };
    default:
      return () => 'None';
  }
}

/**
 * Fetch sales orders grouped by a field/value extractor.
 * When groupBy is falsy, returns null (caller uses paginated fallback).
 */
async function getGroupedOrders({ matchQuery, groupBy, groupBySubOption, sort }) {
  if (!groupBy || groupBy === 'none') return null;
  const docs = await SalesOrder.find(matchQuery)
    .sort(sort || { createdAt: -1 })
    .populate('warehouseId', 'name')
    .lean();
  const extract = groupByExtractor(groupBy, groupBySubOption);
  const map = new Map();
  for (const d of docs) {
    const key = extract(d);
    const g = map.get(key) ?? { _id: key, count: 0, total: 0, currency: d.currency || 'NGN', docs: [] };
    g.count += 1;
    g.total += d.total || 0;
    g.docs.push(d);
    map.set(key, g);
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

module.exports = {
  lineTotalOf, lineTaxOf, mapLine, computeTotals, refreshOrderTotal,
  resolveCartThresholdDiscount,
  applyCouponToOrder, createSalesOrderDoc,
  canEdit, canCancel, applyEdit, recomputeOrderPricing, updatePricesForOrder,
  convertQuotationToOrder, duplicateSalesOrderDoc,
  PAYMENT_TERMS, computeDueDate, normalizePaymentTerms, normalizeAddress,
  resolveLinePromotions, resolveLinePricing,
  buildFilterQuery, groupByExtractor, getGroupedOrders,
  bulkMarkSent, bulkDuplicate, bulkDeleteDoc, bulkCancelDoc,
  bulkCreateInvoice, bulkAccruedRevenue, bulkFollowers, bulkSendEmail,
};
