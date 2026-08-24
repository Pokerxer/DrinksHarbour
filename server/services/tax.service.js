// services/tax.service.js
//
// Central tax capture brain. Posting controllers call captureDocumentTax once
// at the document's committed-status transition; cancellations call
// reverseDocumentTax. All math lives in tax.helpers.js (pure, unit-tested);
// this module is the Mongoose glue.

const Tax = require('../models/Tax');
const TaxRecord = require('../models/TaxRecord');
const { round2, groupLinesByRate, matchTaxByRate, buildSummary } = require('./tax.helpers');

const DIRECTION = {
  sales_order: 'collected',
  purchase_order: 'paid',
  vendor_bill: 'paid',
  stock_transfer: 'internal',
  vendor_return: 'paid',
};

const NUMBER_FIELD = {
  sales_order: 'orderNumber',
  purchase_order: 'poNumber',
  vendor_bill: 'billNumber',
  stock_transfer: 'transferNumber',
  vendor_return: 'returnNumber',
};

const TAX_TYPE_FOR_SOURCE = {
  sales_order: 'output', // collected from customers
  purchase_order: 'input',
  vendor_bill: 'input',
  stock_transfer: 'input',
  vendor_return: 'input',
};

// Flow name used against Tax.appliesTo
const FLOW_FOR_SOURCE = {
  sales_order: 'sale',
  purchase_order: 'purchase',
  vendor_bill: 'purchase',
  stock_transfer: 'transfer',
  vendor_return: 'return',
};

// Header-rate derivation for documents that store a single header taxAmount
// instead of per-line rates (VendorBill, VendorReturn).
const headerRateFrom = (doc) =>
  doc?.taxAmount > 0 && doc?.subtotal > 0
    ? round2((doc.taxAmount / doc.subtotal) * 100)
    : 0;

const EXTRACTORS = {
  sales_order: (doc) =>
    (doc.items || [])
      .filter((i) => i.lineType === 'product')
      .map((i) => ({ taxableBase: i.lineTotal, taxRate: i.taxRate })),
  purchase_order: (doc) =>
    (doc.items || []).map((i) => ({ taxableBase: i.totalCost, taxRate: i.taxRate })),
  vendor_bill: (doc) => [{ taxableBase: doc.subtotal, taxRate: headerRateFrom(doc) }],
  stock_transfer: (doc) =>
    (doc.items || []).map((i) => ({
      taxableBase: round2((i.quantity || 0) * (i.costPrice || 0) * (1 - (i.discountRate || 0) / 100)),
      taxRate: i.taxRate,
    })),
  vendor_return: (doc) => [{ taxableBase: doc.subtotal, taxRate: headerRateFrom(doc) }],
};

/**
 * Pure: turn a document into TaxRecord-ready groups (one per distinct rate).
 * Exported for tests and the backfill script.
 */
function _buildRecordGroups({ sourceType, doc, taxes }) {
  const lines = (EXTRACTORS[sourceType] || (() => []))(doc) || [];
  const type = TAX_TYPE_FOR_SOURCE[sourceType] || 'input';
  return groupLinesByRate(lines).map((g) => {
    const tax = matchTaxByRate(taxes, g.taxRate, type);
    return {
      // Keep the matched tax object (tests read .tax._id); Mongoose casts
      // objects carrying _id to the ObjectId ref on insert.
      tax: tax ? { ...tax } : null,
      taxName: tax ? tax.name : `Unmatched ${String(g.taxRate)}%`,
      taxRate: g.taxRate,
      direction: DIRECTION[sourceType],
      taxableBase: g.taxableBase,
      taxAmount: g.taxAmount,
    };
  });
}

/** Idempotent capture: replace any posted records for this source, then insert. */
async function captureDocumentTax({ sourceType, doc, postedBy }) {
  try {
    if (!doc?._id || !EXTRACTORS[sourceType]) return [];
    const taxes = await Tax.find({ tenant: doc.tenant }).lean();
    const groups = _buildRecordGroups({ sourceType, doc, taxes });
    await TaxRecord.deleteMany({
      tenant: doc.tenant,
      sourceType,
      sourceId: doc._id,
      status: 'posted',
    });
    if (!groups.length) return [];
    return TaxRecord.insertMany(
      groups.map((g) => ({
        tenant: doc.tenant,
        tax: g.tax,
        taxName: g.taxName,
        taxRate: g.taxRate,
        sourceType,
        sourceId: doc._id,
        sourceNumber: String(doc[NUMBER_FIELD[sourceType]] || ''),
        direction: g.direction,
        taxableBase: g.taxableBase,
        taxAmount: g.taxAmount,
        currency: doc.currency || 'NGN',
        status: 'posted',
        postedAt: new Date(),
        postedBy: postedBy || undefined,
      }))
    );
  } catch (err) {
    // The document stays the source of truth; the backfill script repairs gaps.
    console.error('taxCaptureFailed', { sourceType, sourceId: String(doc?._id), err });
    return [];
  }
}

/** Mark posted records for this source as reversed (never delete — audit trail). */
async function reverseDocumentTax({ sourceType, doc, userId }) {
  try {
    if (!doc?._id) return;
    await TaxRecord.updateMany(
      { tenant: doc.tenant, sourceType, sourceId: doc._id, status: 'posted' },
      { $set: { status: 'reversed' } }
    );
  } catch (err) {
    console.error('taxReverseFailed', { sourceType, sourceId: String(doc?._id), err });
  }
}

/** Validate a client-supplied tax reference for a given flow. Throws on invalid. */
async function resolveTaxForFlow({ tenantId, taxId, flow }) {
  const tax = await Tax.findOne({ _id: taxId, tenant: tenantId });
  if (!tax) throw new Error('Tax not found');
  if (!tax.isActive) throw new Error(`Tax "${tax.name}" is inactive`);
  if (!tax.appliesTo.includes(flow)) {
    throw new Error(`Tax "${tax.name}" does not apply to ${flow} documents`);
  }
  return tax;
}

/** Default active tax for a type (fallback when a document omits its ref). */
async function getDefaultTax(tenantId, type) {
  return Tax.findOne({ tenant: tenantId, type, isActive: true, isDefault: true });
}

/**
 * Resolve the effective taxRate for a flow from a client-supplied tax ref,
 * falling back to the tenant default. Returns { taxId: ObjectId|null, taxRate }.
 * Throws Error when an explicit ref is invalid (controller → HTTP 400).
 */
async function effectiveTaxForFlow({ tenantId, taxId, sourceType }) {
  const flow = FLOW_FOR_SOURCE[sourceType];
  const type = TAX_TYPE_FOR_SOURCE[sourceType];
  if (taxId) {
    const tax = await resolveTaxForFlow({ tenantId, taxId, flow });
    return { taxId: tax._id, taxRate: tax.rate };
  }
  const fallback = await getDefaultTax(tenantId, type);
  return fallback ? { taxId: fallback._id, taxRate: fallback.rate } : { taxId: null, taxRate: null };
}

/** Period aggregate for GET /api/taxes/summary. */
async function getSummary(tenantId, { from, to } = {}) {
  const filter = { tenant: tenantId };
  if (from || to) {
    filter.postedAt = {};
    if (from) filter.postedAt.$gte = new Date(from);
    if (to) filter.postedAt.$lte = new Date(to);
  }
  const records = await TaxRecord.find(filter).lean();
  return buildSummary(records);
}

module.exports = {
  DIRECTION,
  NUMBER_FIELD,
  TAX_TYPE_FOR_SOURCE,
  FLOW_FOR_SOURCE,
  EXTRACTORS,
  _buildRecordGroups,
  captureDocumentTax,
  reverseDocumentTax,
  resolveTaxForFlow,
  getDefaultTax,
  effectiveTaxForFlow,
  getSummary,
};
