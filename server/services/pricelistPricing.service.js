// server/services/pricelistPricing.service.js
//
// Pure pricelist-rule + bundle-picking math, lifted verbatim from the inline
// logic in pos.controller.js's createPOSOrder so both POS and the /sales
// module compute pricing identically. No DB access — every function takes
// plain data and returns plain data.

// Rule types that transform a single line's unit price. bundle and
// cart_threshold are cart-scoped and must never enter the per-line pipeline
// (a stray cart_threshold rule would otherwise pollute the matched-rule pool
// and the appliedPricelistRule snapshot).
const PER_LINE_PRICE_TYPES = ['fixed', 'formula', 'discount', 'flash_sale'];

// Priority order is derived and stored on `sequence`; the stored array order is
// not it. findMatchingPriceRules sorts its own pool, but pickBestBundle ranks
// by savings and needs the input already in priority order to break ties.
const { rulesInSequenceOrder } = require('./pricelistPriority.service');

/**
 * Eligible price rules (fixed/formula/discount/flash_sale — excludes bundle
 * and cart_threshold), filtered by date window + minQuantity, then sorted:
 * ascending sequence, then descending minQuantity (so a higher volume tier
 * wins a tie). Product-specific rules shadow all-products rules entirely
 * when any exist.
 */
function findMatchingPriceRules(rules, subProductId, quantity) {
  if (!rules?.length) return [];
  const now = new Date();
  const pid = String(subProductId);

  const eligible = rules.filter((r) =>
    PER_LINE_PRICE_TYPES.includes(r.priceType) &&
    !(r.endDate && new Date(r.endDate) < now) &&
    !(r.startDate && new Date(r.startDate) > now) &&
    (Number(r.minQuantity) || 0) <= quantity &&
    // flash_sale qty cap: flashSaleQty > 0 limits the rule to qty <= flashSaleQty.
    // 0 (default) = unlimited. Only applies to flash_sale rules.
    !(r.priceType === 'flash_sale' &&
      (Number(r.flashSaleQty) || 0) > 0 &&
      quantity > (Number(r.flashSaleQty) || 0))
  );

  const specific = eligible.filter((r) => {
    const rid = r.subProduct?._id ? String(r.subProduct._id) : r.subProduct ? String(r.subProduct) : null;
    return rid && rid === pid;
  });
  const global = eligible.filter((r) => !r.subProduct);
  const pool = specific.length > 0 ? specific : global;

  return pool.sort((a, b) => {
    const seqDiff = (Number(a.sequence) || 0) - (Number(b.sequence) || 0);
    return seqDiff !== 0 ? seqDiff : (Number(b.minQuantity) || 0) - (Number(a.minQuantity) || 0);
  });
}

/** Sequentially applies already-sorted price rules to a base price. */
function applyPriceRules(price, costPrice, sortedRules, wholesalePrice = 0) {
  let result = price;
  for (const rule of sortedRules || []) {
    if (rule.priceType === 'fixed') {
      const fp = Number(rule.fixedPrice);
      if (fp > 0) result = fp;
    } else if (rule.priceType === 'formula') {
      const markup = Number(rule.markupPercentage || 0);
      if (rule.markupBase === 'wholesale') {
        // Markup applied on the size's wholesale price (skip when absent).
        if (wholesalePrice > 0) result = Math.round(wholesalePrice * (1 + markup / 100) * 100) / 100;
      } else if (costPrice > 0) {
        result = Math.round(costPrice * (1 + markup / 100) * 100) / 100;
      }
    } else if (rule.priceType === 'discount') {
      if (rule.discountType === 'fixed') {
        const amt = Number(rule.discountAmount || 0);
        if (amt > 0) result = Math.max(0, result - amt);
      } else {
        const pct = Number(rule.discountPercentage || 0);
        if (pct > 0) result = Math.max(0, result * (1 - pct / 100));
      }
    } else if (rule.priceType === 'flash_sale') {
      const pct = Number(rule.flashSalePercentage || 0);
      if (pct > 0) result = Math.max(0, result * (1 - pct / 100));
    }
  }
  return result;
}

/**
 * Merges DB bundleDeals with pricelist `priceType:'bundle'` rules scoped to
 * subProductId, filters to qualifying (active, not expired, quantity met),
 * and returns the single best-savings candidate (or null).
 *
 * @param {number} wholesalePrice - the product/size's wholesale price, used when bundleMarkupBase=wholesale
 * @param {number} unitsPerPack   - the size's unitsPerPack, used when bundleUnitsMode=pack
 */
function pickBestBundle(dbBundles, pricelistRules, quantity, subProductId, { price, costPrice, wholesalePrice = 0, unitsPerPack = 1 }) {
  const now = new Date();

  // Pricelist bundle candidates, split by how specifically they target this
  // line. Sequence order, so the pools come out in applied order: callers hand
  // us the rules straight off the stored document, whose array order is not
  // priority order (resequenceRules rewrites `sequence` and leaves the array
  // alone).
  const specific = [];
  const allProducts = [];

  for (const r of rulesInSequenceOrder(pricelistRules || [])) {
    if (r.priceType !== 'bundle' || !r.bundleQuantity) continue;
    // Cross-product rules (buy X of trigger → discount target) are cart-scoped
    // and handled by applyCartBundles. Without this guard a cross-product rule
    // would wrongly discount the TRIGGER product here (rid === trigger id).
    if (r.bundleTargetSubProduct) continue;
    if (r.endDate && new Date(r.endDate) < now) continue;
    if (r.startDate && new Date(r.startDate) > now) continue;
    if (r.bundleDiscountType !== 'no_discount' && !r.bundleDiscount) continue;
    if ((Number(r.minQuantity) || 0) > quantity) continue;
    const rid = r.subProduct?._id ? String(r.subProduct._id) : r.subProduct ? String(r.subProduct) : null;
    if (rid && rid !== String(subProductId)) continue;

    // Resolve the effective bundle quantity: 'pack' mode uses the size's unitsPerPack
    const effectiveQty = r.bundleUnitsMode === 'pack' ? (unitsPerPack || 1) : r.bundleQuantity;
    // Qualify BEFORE the pool split: a product-specific rule the customer has
    // not bought enough for must not shadow an all-products rule they have.
    if (quantity < (effectiveQty || 1)) continue;

    (rid ? specific : allProducts).push({
      name: r.bundleName || `Buy ${effectiveQty}+`,
      quantity: effectiveQty,
      discount: r.bundleDiscount || 0,
      discountType: r.bundleDiscountType || 'percentage',
      bundleMarkupBase: r.bundleMarkupBase || 'cost',
      active: true,
      validUntil: r.endDate || null,
      fromPricelist: true,
    });
  }

  // ── Specificity, not savings ────────────────────────────────────────────────
  // A rule aimed at THIS product outranks one aimed at everything, exactly as
  // findMatchingPriceRules already shadows whole pools for per-line rules.
  // Ranking bundles on savings instead meant a broad "all products" rule could
  // beat the deliberate per-product price a tenant had set — the narrower rule
  // is the more considered one, whether or not it is the cheaper one.
  // Within a pool the tie goes to `sequence`, i.e. the derived priority the
  // panel displays, so the list you see is the order that is charged.
  const pricelistPool = specific.length > 0 ? specific : allProducts;
  if (pricelistPool.length) return pricelistPool[0];

  // ── DB bundleDeals — unchanged ──────────────────────────────────────────────
  // These live on the SubProduct, not the pricelist, and are only reached when
  // the pricelist offers no bundle for this line. Ranking among them stays
  // best-savings so a tenant with no pricelist prices exactly as before.
  const qualifying = (dbBundles || []).filter((bd) =>
    bd.active !== false &&
    (!bd.validUntil || new Date(bd.validUntil) >= now) &&
    quantity >= (bd.quantity || 1)
  );
  if (!qualifying.length) return null;

  const savings = (bd) => {
    const d = bd.discountType || 'percentage';
    if (d === 'fixed') return (bd.discount || 0) * quantity;
    if (d === 'markup_on_cost') {
      const basis = bd.bundleMarkupBase === 'wholesale' ? wholesalePrice : costPrice;
      return basis > 0
        ? Math.max(0, price - basis * (1 + (bd.discount || 0) / 100)) * quantity
        : 0;
    }
    if (d === 'no_discount') return 0;
    return (price * quantity * Math.min(100, bd.discount || 0)) / 100;
  };

  return qualifying.sort((a, b) => savings(b) - savings(a))[0];
}

/**
 * markup_on_cost / no_discount bundle types replace the per-unit price
 * outright. percentage/fixed types do NOT change price here — the caller
 * applies those as a separate line-level discount via computeBundleLineDiscount.
 */
function applyBundleOverride(price, bestBundle, costPrice, originalPrice, wholesalePrice = 0) {
  if (!bestBundle) return { price, overridden: false };
  const dt = bestBundle.discountType || 'percentage';

  if (dt === 'markup_on_cost') {
    const markup = bestBundle.discount || 0;
    const basis = bestBundle.bundleMarkupBase === 'wholesale' ? wholesalePrice : costPrice;
    if (basis > 0) {
      // Platform selling prices always round UP to the nearest ₦100
      const { roundUpTo100 } = require('../utils/pricing');
      return { price: roundUpTo100(basis * (1 + markup / 100)), overridden: true };
    }
  } else if (dt === 'no_discount') {
    if (originalPrice && originalPrice > price) {
      return { price: originalPrice, overridden: true };
    }
  }
  return { price, overridden: false };
}

/**
 * The percentage/fixed bundle savings as a flat amount across the whole
 * line (POS keeps this separate from the per-unit price; see
 * applyBundleOverride). Returns 0 when the bundle already overrode price.
 */
function computeBundleLineDiscount(bestBundle, lineGross, quantity, itemDiscAmt, bundleOverridePrice) {
  if (!bestBundle || bundleOverridePrice) return 0;
  const dt = bestBundle.discountType || 'percentage';
  const amt = dt === 'fixed'
    ? Math.min((bestBundle.discount || 0) * quantity, lineGross - itemDiscAmt)
    : parseFloat(((lineGross * Math.min(100, bestBundle.discount || 0)) / 100).toFixed(2));
  return Math.max(0, amt);
}

/**
 * Cross-product bundle adjustments (Buy X of A, get discount on B).
 * Scans the whole cart: for each bundle rule with bundleTargetSubProduct set,
 * checks if the trigger product's total quantity meets the threshold, then
 * applies the discount to the target product's lines.
 *
 * Same-product bundles (no bundleTargetSubProduct) are NOT handled here —
 * those run through the existing per-line pickBestBundle path.
 *
 * @param {Array<{subProductId, quantity, price, costPrice, originalPrice?, wholesalePrice?}>} lines
 * @param {Array} pricelistRules
 * @returns {Array<{subProductId, lineIndex, ruleName?, discountAmount?, overridePrice?}>}
 *   per-target adjustments. lineIndex points at the exact line in `lines` (size
 *   variants can share a subProductId). discountAmount = line-level discount
 *   (percentage/fixed). overridePrice = new per-unit price
 *   (markup_on_cost/no_discount).
 */
function applyCartBundles(lines, pricelistRules) {
  if (!lines?.length || !pricelistRules?.length) return [];
  const now = new Date();
  const refId = (v) => (v?._id ? String(v._id) : v ? String(v) : null);
  const qtyByProduct = new Map();
  for (const l of lines) {
    const sid = String(l.subProductId);
    qtyByProduct.set(sid, (qtyByProduct.get(sid) || 0) + (Number(l.quantity) || 0));
  }

  const adjustments = [];
  for (const r of pricelistRules) {
    if (r.priceType !== 'bundle') continue;
    if (!r.bundleTargetSubProduct) continue; // same-product bundle — skip
    if (!r.bundleQuantity) continue;
    if (r.endDate && new Date(r.endDate) < now) continue;
    if (r.startDate && new Date(r.startDate) > now) continue;

    const triggerId = refId(r.subProduct);
    const targetId = refId(r.bundleTargetSubProduct);
    const triggerQty = triggerId ? (qtyByProduct.get(triggerId) || 0) : 0;
    if (triggerQty < (Number(r.bundleQuantity) || 2)) continue;
    // minQuantity is the rule's overall activation threshold, same semantics
    // as the per-line engine: the trigger quantity must also meet it.
    if ((Number(r.minQuantity) || 0) > triggerQty) continue;

    const dt = r.bundleDiscountType || 'percentage';
    const disc = Number(r.bundleDiscount) || 0;
    if (dt !== 'no_discount' && disc <= 0) continue;
    const bmb = r.bundleMarkupBase || 'cost';

    for (let i = 0; i < lines.length; i++) {
      const tl = lines[i];
      if (String(tl.subProductId) !== targetId) continue;
      const qty = Number(tl.quantity) || 0;
      const lineGross = (Number(tl.price) || 0) * qty;
      const cost = Number(tl.costPrice) || 0;
      const wPrice = Number(tl.wholesalePrice) || 0;
      const ruleName = r.bundleName || `Buy ${r.bundleQuantity} get target deal`;

      if (dt === 'percentage') {
        const amt = parseFloat(((lineGross * Math.min(100, disc)) / 100).toFixed(2));
        adjustments.push({ subProductId: targetId, lineIndex: i, ruleName, discountAmount: Math.max(0, amt) });
      } else if (dt === 'fixed') {
        const amt = Math.min(disc * qty, lineGross);
        adjustments.push({ subProductId: targetId, lineIndex: i, ruleName, discountAmount: Math.max(0, amt) });
      } else if (dt === 'markup_on_cost') {
        const basis = bmb === 'wholesale' ? wPrice : cost;
        if (basis > 0) {
          const overridePrice = Math.round(basis * (1 + disc / 100) * 100) / 100;
          adjustments.push({ subProductId: targetId, lineIndex: i, ruleName, overridePrice });
        }
      } else if (dt === 'no_discount') {
        // Restore the target's pre-sale price when the caller supplies one;
        // otherwise keep the line's own price (it IS the original).
        const orig = Number(tl.originalPrice) || 0;
        const own = Number(tl.price) || 0;
        adjustments.push({ subProductId: targetId, lineIndex: i, ruleName, overridePrice: orig > own ? orig : own });
      }
    }
  }
  return adjustments;
}

/**
 * Cart spend-threshold rules: filters cart_threshold rules whose threshold is
 * met and date window is valid, sorted by sequence (they stack sequentially).
 */
function findCartThresholdRules(rules, cartSubtotal) {
  if (!rules?.length) return [];
  const now = new Date();
  return rules
    .filter((r) =>
      r.priceType === 'cart_threshold' &&
      (Number(r.thresholdAmount) || 0) <= cartSubtotal &&
      !(r.endDate && new Date(r.endDate) < now) &&
      !(r.startDate && new Date(r.startDate) > now)
    )
    .sort((a, b) => (Number(a.sequence) || 0) - (Number(b.sequence) || 0));
}

/**
 * Sequentially applies cart-threshold rules to a running subtotal.
 * Each percentage rule reduces the running amount; each fixed rule subtracts
 * a flat amount. Returns the total discount (subtotal - finalRunning).
 */
function computeCartThresholdDiscount(rules, subtotal) {
  if (!rules?.length) return 0;
  let running = subtotal;
  for (const r of rules) {
    if (r.discountType === 'fixed') {
      running -= Math.min(Number(r.discountAmount) || 0, running);
    } else {
      running -= running * (Math.min(100, Number(r.discountPercentage) || 0) / 100);
    }
    running = Math.max(0, running);
  }
  return Math.max(0, subtotal - running);
}

module.exports = {
  findMatchingPriceRules,
  applyPriceRules,
  pickBestBundle,
  applyBundleOverride,
  computeBundleLineDiscount,
  applyCartBundles,
  findCartThresholdRules,
  computeCartThresholdDiscount,
};
