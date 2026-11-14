// server/services/merchandising.service.js
// Upsell/cross-sell recommendation engine (spec:
// docs/superpowers/specs/2026-11-13-merchandising-upsell-cross-sell-design.md).
//
// Tiered hybrid per kind:
//   boughtTogether: co-purchase → pairing rules → related products
//   crossSells:     pairing rules → semantic similarity
//   upSells:        family price band → brand premium → semantic
// Every returned item carries `source` so the UI and GA4 know WHY it was
// recommended. Public responses never contain SubProduct private fields.

const Product = require('../models/Product');
const Order = require('../models/Order');
const SubProduct = require('../models/SubProduct');
const Tenant = require('../models/Tenant');
const { ValidationError, NotFoundError } = require('../utils/errors');
const catalogKind = require('../constants/catalogKind');
const { complementFamilies, typesForFamilies, familyForType } = require('../config/merchandising');
const productService = require('./product.service');
const { getProductRecommendations } = require('../utils/embeddings');

// Marketplace candidates are beverage-only (DRI-5), matching the related strip.
const marketplaceGate = () => catalogKind.marketplaceWhereClause();

const isMongoId = (id) => /^[0-9a-fA-F]{24}$/.test(id);

// ─── Candidate hydration ────────────────────────────────────────────────────

const CARD_POPULATE = [
  { path: 'brand', select: 'name slug logo' },
  { path: 'category', select: 'name slug' },
];

// `tenantId` restricts to that tenant's sellable SubProducts (storefront
// surface); undefined = main marketplace (beverage-only, published products).
const hydrateCards = async (ids, { tenantId } = {}) => {
  if (!ids.length) return [];
  const query = {
    _id: { $in: ids },
    status: 'approved',
    isPublished: true,
  };
  if (!tenantId) Object.assign(query, marketplaceGate());

  const docs = await Product.find(query)
    .populate(CARD_POPULATE)
    .select('-embedding')
    .lean();

  const byId = new Map(docs.map((d) => [d._id.toString(), d]));

  // Tenant surface: price shown is that tenant's own retail price, and only
  // SubProducts that are published + online-visible + in a sellable status.
  let tenantPrices = null;
  if (tenantId) tenantPrices = await sellableForTenant(ids, tenantId);

  return ids
    .map((id) => {
      const doc = byId.get(id.toString());
      if (!doc) return null;
      if (tenantId) {
        const sub = tenantPrices?.get(id.toString());
        if (!sub) return null; // this tenant does not sell it — drop entirely
        doc.price = sub.baseSellingPrice;
        doc.currency = sub.currency || 'NGN';
      }
      return doc;
    })
    .filter(Boolean);
};

const sellableForTenant = async (ids, tenantId) => {
  const subs = await SubProduct.find({
    product: { $in: ids },
    tenant: tenantId,
    isPublished: true,
    visibleInOnlineStore: { $ne: false },
    status: { $in: ['active', 'low_stock'] },
  })
    .select('product baseSellingPrice currency')
    .lean();
  return new Map(subs.map((s) => [s.product.toString(), s]));
};

// ─── Tier helpers (exposed for tests) ───────────────────────────────────────

// Real order co-purchase data — moved verbatim from
// product.service.getFrequentlyBoughtTogether's aggregation.
const coPurchaseAggregates = async (productId, limit) =>
  Order.aggregate([
    {
      $match: {
        'items.product': productId,
        status: { $in: ['delivered', 'shipped', 'processing'] },
      },
    },
    { $unwind: '$items' },
    { $match: { 'items.product': { $ne: productId } } },
    {
      $group: {
        _id: '$items.product',
        frequency: { $sum: 1 },
        totalQuantity: { $sum: '$items.quantity' },
      },
    },
    { $sort: { frequency: -1, totalQuantity: -1 } },
    { $limit: limit },
  ]);

// Pairing-rule candidates from the family map (Task 1).
const pairingCandidates = async (product, { limit, tenantId } = {}) => {
  const families = complementFamilies(product.type);
  if (!families.length) return [];
  const types = typesForFamilies(families);
  if (!types.length) return [];

  const query = {
    _id: { $ne: product._id },
    status: 'approved',
    isPublished: true,
    type: { $in: types },
  };
  if (!tenantId) Object.assign(query, marketplaceGate());

  // Tag overlap boosts genuine affinity (e.g. both tagged "gift-set").
  const tagSlugs = (product.tags || []).map((t) => (t?.slug ?? t));
  const docs = await Product.find(query)
    .select('-embedding')
    .populate(CARD_POPULATE)
    .lean();

  const score = (doc) => {
    const shared = tagSlugs.length
      ? (doc.tags || []).filter((t) => tagSlugs.includes(t?.slug ?? t)).length
      : 0;
    return shared * 10 + (doc.tenantCount || 0);
  };
  return docs
    .sort((a, b) => score(b) - score(a))
    .slice(0, limit);
};

// ─── Bought together ────────────────────────────────────────────────────────

const getBoughtTogether = async (productId, product, { limit = 5, tenantId } = {}) => {
  // Tier 1: real co-purchase data.
  const coPurchases = await module.exports.coPurchaseAggregates(productId, limit);
  if (coPurchases.length > 0) {
    const cards = await module.exports.hydrateCards(
      coPurchases.map((c) => c._id.toString()),
      { tenantId }
    );
    const freqById = new Map(coPurchases.map((c) => [c._id.toString(), c]));
    return cards.map((card) => {
      const freq = freqById.get(card._id.toString());
      return { ...card, source: 'co_purchase', frequency: freq?.frequency, totalQuantity: freq?.totalQuantity };
    });
  }

  // Tier 2: curated pairing rules.
  const paired = await module.exports.pairingCandidates(product, { limit, tenantId });
  if (paired.length > 0) return paired.map((p) => ({ ...p, source: 'pairing_rules' }));

  // Tier 3: related-products fallback.
  const { products } = await productService.getRelatedProducts(productId, { limit });
  return (products || []).map((p) => ({ ...p, source: 'related_fallback' }));
};

module.exports = {
  hydrateCards,
  sellableForTenant,
  coPurchaseAggregates,
  pairingCandidates,
  getBoughtTogether,
  familyForType, // re-exported for the Task 4 test convenience
};
