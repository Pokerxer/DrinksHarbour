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
const pairingService = require('./merchandisingPairing.service');
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

// ─── Cross-sells ────────────────────────────────────────────────────────────

// Semantic similarity fallback. Runs against a candidate window (no family
// restriction); products without embeddings simply never score.
const semanticFallback = async (product, { limit, tenantId } = {}) => {
  const query = {
    _id: { $ne: product._id },
    status: 'approved',
    isPublished: true,
    embedding: { $exists: true, $ne: null },
  };
  if (!tenantId) Object.assign(query, marketplaceGate());

  const candidates = await Product.find(query)
    .select('name slug type images abv averageSellingPrice tenantCount priceRange embedding')
    .limit(200)
    .lean();

  const scored = getProductRecommendations(product, candidates, { limit });
  // scored are candidate docs with similarity metadata; strip the heavy
  // embedding field before returning and hydrate missing card fields.
  return scored.map(({ embedding, ...rest }) => ({ ...rest, _id: rest._id ?? rest.id }));
};

const getCrossSells = async (productId, product, { limit = 4, tenantId } = {}) => {
  if (!isMongoId(productId)) throw new ValidationError('Invalid product ID');

  // Tier 1: curated pairing rules (skipped entirely for OTHER-family types).
  if (complementFamilies(product.type).length > 0) {
    const paired = await module.exports.pairingCandidates(product, { limit, tenantId });
    if (paired.length > 0) return paired.map((p) => ({ ...p, source: 'pairing_rules' }));
  }

  // Tier 2: semantic similarity.
  return (await module.exports.semanticFallback(product, { limit, tenantId })).map((p) => ({
    ...p,
    source: 'semantic',
  }));
};

// ─── Up-sells ───────────────────────────────────────────────────────────────

// Tier 1: same beverage family, priced 1.2×–3× the source product's average
// selling price, cheapest premium option first (spec §Tiered hybrid).
const upSellPriceBand = async (product, { limit, tenantId } = {}) => {
  const current = product.averageSellingPrice || 0;
  if (current <= 0) return [];
  const types = typesForFamilies([familyForType(product.type)]);
  if (!types.length) return [];

  const query = {
    _id: { $ne: product._id },
    status: 'approved',
    isPublished: true,
    type: { $in: types },
    averageSellingPrice: { $gte: current * 1.2, $lte: current * 3 },
  };
  if (!tenantId) Object.assign(query, marketplaceGate());

  return Product.find(query)
    .select('-embedding')
    .populate(CARD_POPULATE)
    .sort({ averageSellingPrice: 1 })
    .limit(limit)
    .lean();
};

// Tier 2: same brand, any beverage type, meaningfully dearer than the source.
const upSellBrandPremium = async (product, { limit, tenantId } = {}) => {
  const current = product.averageSellingPrice || 0;
  const brandId = product.brand?._id ?? product.brand;
  if (!brandId) return [];

  const query = {
    _id: { $ne: product._id },
    status: 'approved',
    isPublished: true,
    brand: brandId,
  };
  if (current > 0) query.averageSellingPrice = { $gt: current * 1.2 };
  if (!tenantId) Object.assign(query, marketplaceGate());

  return Product.find(query)
    .select('-embedding')
    .populate(CARD_POPULATE)
    .sort({ averageSellingPrice: 1 })
    .limit(limit)
    .lean();
};

const getUpSells = async (productId, product, { limit = 4, tenantId } = {}) => {
  if (!isMongoId(productId)) throw new ValidationError('Invalid product ID');

  // Tier 1: family price band (skipped entirely without a current price).
  if ((product.averageSellingPrice || 0) > 0) {
    const band = await module.exports.upSellPriceBand(product, { limit, tenantId });
    if (band.length > 0) return band.map((p) => ({ ...p, source: 'price_band' }));
  }

  // Tier 2: brand premium.
  const premium = await module.exports.upSellBrandPremium(product, { limit, tenantId });
  if (premium.length > 0) return premium.map((p) => ({ ...p, source: 'brand_premium' }));

  // Tier 3: semantic similarity (any price) — a "more like this" fallback.
  return (await module.exports.semanticFallback(product, { limit, tenantId })).map((p) => ({
    ...p,
    source: 'semantic',
  }));
};

// ─── Assembly + process-local cache ────────────────────────────────────────

// Standalone-runtime agreement: process-local Map cache only, no Redis/Upstash
// (docs/memory/standalone-without-upstash.md). Per-process is acceptable for a
// read-only recommendation payload.
const CACHE_TTL_MS = 5 * 60 * 1000;
const recommendationsCache = new Map();

const clearRecommendationsCache = () => recommendationsCache.clear();

// ─── Manual pairings (tenant dashboard, Growth+) ───────────────────────────
// Storefront surface only: the tenant's own "buy X with Y" configuration
// outranks every automatic tier. Suggestions are re-verified sellable via
// hydrateCards (which drops products this tenant does not publish/stock).
const manualPairingCards = async (tenantId, productId, cap) => {
  try {
    const pairing = await module.exports.getActivePairingSafe(tenantId, productId);
    if (!pairing) return [];
    const cards = await module.exports.hydrateCards(
      pairing.suggestedProducts.map((id) => id.toString()),
      { tenantId }
    );
    return cards.slice(0, cap).map((p) => ({ ...p, source: 'manual' }));
  } catch {
    return []; // pairing lookup must never take down recommendations
  }
};

const getRecommendations = async (productId, { context = 'pdp', tenantId, limit } = {}) => {
  if (!isMongoId(productId)) throw new ValidationError('Invalid product ID');

  const cacheKey = `${productId}:${context}:${tenantId || 'market'}`;
  const cached = recommendationsCache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;

  const product = await Product.findById(productId).lean();
  if (!product) throw new NotFoundError('Product not found');

  const opts = { limit, tenantId };
  // Any tier failing must not take down the whole payload (spec §degradation).
  const settled = await Promise.allSettled([
    module.exports.getBoughtTogether(productId, product, opts),
    module.exports.getCrossSells(productId, product, opts),
    module.exports.getUpSells(productId, product, opts),
  ]);
  const pick = (r) => (r.status === 'fulfilled' ? r.value : []);

  // Manual pairings are storefront-only and merge ahead of automatic tiers.
  // NOTE: the process-local cache key below already includes tenantId, so a
  // manual pairing edit becomes visible to shoppers within the 5-minute TTL —
  // documented trade-off, not staleness (standalone-runtime agreement).
  let manualCross = [];
  let manualTogether = [];
  if (tenantId) {
    const cap = Math.max(0, (limit ?? 4) - 1); // leave room for ≥1 automatic item
    [manualTogether, manualCross] = await Promise.all([
      module.exports.manualPairingCards(tenantId, productId, Math.min(cap, 2)),
      module.exports.manualPairingCards(tenantId, productId, cap),
    ]);
  }
  const mergeManual = (auto, manual) => {
    const seen = new Set(manual.map((p) => p._id.toString()));
    return [...manual, ...auto.filter((p) => !seen.has(p._id.toString()))].slice(
      0, limit ?? 4
    );
  };

  const value = {
    productId,
    context,
    boughtTogether: mergeManual(pick(settled[0]), manualTogether),
    crossSells: mergeManual(pick(settled[1]), manualCross),
    // Manual pairings do not touch upSells — an upsell is a premium
    // alternative, not a pairing.
    upSells: pick(settled[2]),
  };
  recommendationsCache.set(cacheKey, { at: Date.now(), value });
  return value;
};

module.exports = {
  hydrateCards,
  sellableForTenant,
  coPurchaseAggregates,
  pairingCandidates,
  getBoughtTogether,
  getCrossSells,
  semanticFallback,
  getUpSells,
  upSellPriceBand,
  upSellBrandPremium,
  getRecommendations,
  clearRecommendationsCache,
  manualPairingCards,
  getActivePairingSafe: (tenantId, productId) =>
    pairingService.getActivePairing(tenantId, productId),
  familyForType, // re-exported for the Task 4 test convenience
};
