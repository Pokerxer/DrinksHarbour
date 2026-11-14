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
const AdCampaign = require('../models/AdCampaign');
const { ValidationError, NotFoundError } = require('../utils/errors');
const catalogKind = require('../constants/catalogKind');
const { complementFamilies, typesForFamilies, familyForType } = require('../config/merchandising');
const { CPC_TARIFF_NGN } = require('../config/ads');
const productService = require('./product.service');
const pairingService = require('./merchandisingPairing.service');
const adClickService = require('./adClick.service');
const adWalletService = require('./adWallet.service');
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
  // Bounded window: a complement family can span hundreds of catalog rows on
  // a mature marketplace. The DB narrows to the most-offered candidates first
  // (deterministic); the in-memory tag boost then re-ranks within that window.
  const window = Math.max(limit * 8, 40);
  const docs = await Product.find(query)
    .select('-embedding')
    .populate(CARD_POPULATE)
    .sort({ tenantCount: -1, averageSellingPrice: 1 })
    .limit(window)
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

// ─── Sponsored placements (paid tier, phase 2 merchandising Part B) ─────────
// A paid slot is served ONLY while the campaign is active, within its daily
// budget after the SAME 4-step sweep the CPC click pipeline runs
// (adClick.service.recordClick: expiry → status → rollover → daily cap), and
// only while the prepaid wallet covers one more click. adClick's sweep is not
// a standalone export, so it is mirrored inline and kept READ-ONLY —
// persisting rollover/exhaustion states remains recordClick's job.
//
// Disclosure is MANDATORY: every served card carries source:'sponsored' +
// adCampaignId so the UI renders SponsoredBadge and the client can fire the
// CPC click endpoint before quick-add/navigation.

const AD_SURFACES = new Set(['pdp', 'cart']);
const adsTodayKey = () => new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD' (UTC)

const sponsoredForSurface = async (productId, surface, { tenantId } = {}) => {
  if (!AD_SURFACES.has(surface)) return [];
  try {
    const rows = (await AdCampaign.find({
      surfaces: surface,
      status: 'active',
      product: { $ne: productId },
    }).lean()) || [];
    const today = adsTodayKey();

    // Oldest campaign first — a stable, fair rotation for the single slot.
    for (const campaign of rows.sort((a, b) =>
      new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
    )) {
      // 1. Expiry — an ended campaign is expired even if the row still says
      //    'active' (same precedence as recordClick).
      if (campaign.endsAt && new Date(campaign.endsAt).getTime() <= Date.now()) continue;
      // 2. Status — 'active' is also enforced by the query; belt-and-braces.
      if (campaign.status !== 'active') continue;
      // 3. Rollover (read-only) — a stale counter belongs to yesterday, so
      //    today's spend is zero for budget purposes.
      const spentToday = campaign.spentDay === today ? campaign.spentToday ?? 0 : 0;
      // 4. Daily cap — never surface a campaign without room for one click.
      if ((campaign.dailyBudget ?? 0) - spentToday < CPC_TARIFF_NGN) continue;

      // Prepaid-only agreement: the wallet must cover one more click. getWallet
      // is a plain read here — the authoritative atomic debit guard lives in
      // the click path (adWallet.service.debitForClick).
      const { balance } = await module.exports.sponsoredWalletOkSafe(campaign.tenant);
      if (balance < CPC_TARIFF_NGN) continue;

      // hydrateCards re-verifies publication/approval (and the tenant's own
      // sellability on the storefront) — the paid card obeys the same gate as
      // every organic card. Cap: at most ONE sponsored card per response.
      const [card] = await module.exports.hydrateCards(
        [String(campaign.product)],
        { tenantId }
      );
      if (!card) continue;
      return [{ ...card, source: 'sponsored', adCampaignId: String(campaign._id) }];
    }
    return [];
  } catch {
    return []; // the paid tier must never take down recommendations (§degradation)
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

  // Sponsored tier (Task 10): at most ONE paid card per response. The lookup
  // is a full sweep of eligibility (budget, wallet, publication) and never
  // throws — failures degrade to no paid slot (§degradation).
  let sponsoredCard = null;
  try {
    sponsoredCard =
      (await module.exports.sponsoredForSurface(productId, context, { tenantId }))[0] || null;
  } catch {
    sponsoredCard = null;
  }
  const sponsoredId = sponsoredCard ? String(sponsoredCard._id) : null;

  // Organic always wins ACROSS the whole response: if the paid product already
  // earns any organic slot (any automatic tier or a manual pairing), the paid
  // card is dropped entirely and no impression is counted.
  const organicIds = new Set(
    [...pick(settled[0]), ...pick(settled[1]), ...pick(settled[2]),
     ...manualTogether, ...manualCross].map((p) => String(p._id))
  );

  const mergeManual = (auto, manual, { sponsored = false } = {}) => {
    const seen = new Set(manual.map((p) => String(p._id)));
    // Otherwise the paid card sits AFTER manual pairings but BEFORE the
    // automatic tiers — FIRST on the marketplace, where manual is always empty.
    const head = sponsored && sponsoredId && !organicIds.has(sponsoredId)
      ? [{ ...sponsoredCard, source: 'sponsored' }]
      : [];
    if (head.length) seen.add(sponsoredId);
    return [...manual, ...head, ...auto.filter((p) => !seen.has(String(p._id)))]
      .slice(0, limit ?? 4);
  };

  // The paid placement must live in the array the context actually renders:
  // cart → crossSells (the cart strip), pdp → upSells (the disclosed list
  // above the step-up rail). Organic always wins the slot; the same product is
  // then deduped out of the other arrays so it surfaces exactly once.
  const sponsoredContext = context === 'cart' ? 'cart' : 'pdp';
  const crossSellsAuto = pick(settled[1]);
  const upSellsAuto = pick(settled[2]);
  const sponsoredHomeArray = sponsoredContext === 'cart'
    ? mergeManual(crossSellsAuto, manualCross, { sponsored: true })
    : mergeManual(upSellsAuto, [], { sponsored: true });
  const sponsoredIncluded = sponsoredHomeArray.some((p) => p.source === 'sponsored');

  // A paid placement surfaces exactly ONCE: when the sponsored card is served
  // in its home array, the same product is deduped out of the other arrays (the
  // same mechanism mergeManual uses for manual vs automatic items).
  const stripSponsored = (items) =>
    sponsoredIncluded ? items.filter((p) => String(p._id) !== sponsoredId) : items;

  const value = {
    productId,
    context,
    boughtTogether: stripSponsored(mergeManual(pick(settled[0]), manualTogether)),
    crossSells: sponsoredContext === 'cart'
      ? sponsoredHomeArray
      : stripSponsored(mergeManual(crossSellsAuto, manualCross)),
    // Manual pairings never compete for upSells — an upsell is a premium
    // alternative, not a pairing — but the paid pdp slot does (disclosed).
    upSells: sponsoredContext === 'cart'
      ? stripSponsored(upSellsAuto)
      : sponsoredHomeArray,
  };
  // Impression is counted on the serve path only, right before the cache set:
  // cached serves within the TTL window keep the sponsored card in the payload
  // but do not re-count (accepted design — count impressions on first serve).
  if (sponsoredIncluded) {
    module.exports.recordImpressionSafe(sponsoredCard.adCampaignId);
  }
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
  sponsoredForSurface,
  getActivePairingSafe: (tenantId, productId) =>
    pairingService.getActivePairing(tenantId, productId),
  // Wrapper seams (Task 10) — the money lives in adWallet/adClick services;
  // these exist so tests can mock either layer (established pattern) and so
  // the merchandising engine stays uncoupled from the billing internals.
  sponsoredWalletOkSafe: (tenantId) => adWalletService.getWallet(tenantId),
  recordImpressionSafe: (campaignId) => adClickService.recordImpression(campaignId),
  familyForType, // re-exported for the Task 4 test convenience
};
