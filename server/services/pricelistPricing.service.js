// server/services/pricelistPricing.service.js
//
// Pure pricelist-rule + bundle-picking math, lifted verbatim from the inline
// logic in pos.controller.js's createPOSOrder so both POS and the /sales
// module compute pricing identically. No DB access — every function takes
// plain data and returns plain data.

/**
 * Eligible price rules (fixed/formula/discount/flash_sale — excludes bundle),
 * filtered by date window + minQuantity, then sorted: ascending sequence,
 * then descending minQuantity (so a higher volume tier wins a tie). Product-
 * specific rules shadow all-products rules entirely when any exist.
 */
function findMatchingPriceRules(rules, subProductId, quantity) {
  if (!rules?.length) return [];
  const now = new Date();
  const pid = String(subProductId);

  const eligible = rules.filter((r) =>
    r.priceType !== 'bundle' &&
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
function applyPriceRules(price, costPrice, sortedRules) {
  let result = price;
  for (const rule of sortedRules || []) {
    if (rule.priceType === 'fixed') {
      const fp = Number(rule.fixedPrice);
      if (fp > 0) result = fp;
    } else if (rule.priceType === 'formula') {
      const markup = Number(rule.markupPercentage || 0);
      if (costPrice > 0) result = Math.round(costPrice * (1 + markup / 100) * 100) / 100;
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
 */
function pickBestBundle(dbBundles, pricelistRules, quantity, subProductId, { price, costPrice }) {
  const now = new Date();
  const candidates = [...(dbBundles || [])];

  for (const r of pricelistRules || []) {
    if (r.priceType !== 'bundle' || !r.bundleQuantity) continue;
    if (r.endDate && new Date(r.endDate) < now) continue;
    if (r.startDate && new Date(r.startDate) > now) continue;
    if (r.bundleDiscountType !== 'no_discount' && !r.bundleDiscount) continue;
    if ((Number(r.minQuantity) || 0) > quantity) continue;
    const rid = r.subProduct?._id ? String(r.subProduct._id) : r.subProduct ? String(r.subProduct) : null;
    if (rid && rid !== String(subProductId)) continue;
    candidates.push({
      name: r.bundleName || `Buy ${r.bundleQuantity}+`,
      quantity: r.bundleQuantity,
      discount: r.bundleDiscount || 0,
      discountType: r.bundleDiscountType || 'percentage',
      active: true,
      validUntil: r.endDate || null,
    });
  }

  const qualifying = candidates.filter((bd) =>
    bd.active !== false &&
    (!bd.validUntil || new Date(bd.validUntil) >= now) &&
    quantity >= (bd.quantity || 1)
  );
  if (!qualifying.length) return null;

  const savings = (bd) => {
    const d = bd.discountType || 'percentage';
    if (d === 'fixed') return (bd.discount || 0) * quantity;
    if (d === 'markup_on_cost') return Math.max(0, price - costPrice * (1 + (bd.discount || 0) / 100)) * quantity;
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
function applyBundleOverride(price, bestBundle, costPrice, originalPrice) {
  if (!bestBundle) return { price, overridden: false };
  const dt = bestBundle.discountType || 'percentage';

  if (dt === 'markup_on_cost') {
    const markup = bestBundle.discount || 0;
    if (costPrice > 0) {
      return { price: Math.round(costPrice * (1 + markup / 100) * 100) / 100, overridden: true };
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
 * @param {Array<{subProductId, quantity, price, costPrice}>} lines
 * @param {Array} pricelistRules
 * @returns {Array<{subProductId, discountAmount?, overridePrice?}>} per-target
 *   adjustments. discountAmount = line-level discount (percentage/fixed).
 *   overridePrice = new per-unit price (markup_on_cost/no_discount).
 */
function applyCartBundles(lines, pricelistRules) {
  if (!lines?.length || !pricelistRules?.length) return [];
  const now = new Date();
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

    const triggerId = r.subProduct ? String(r.subProduct) : null;
    const targetId = String(r.bundleTargetSubProduct);
    const triggerQty = triggerId ? (qtyByProduct.get(triggerId) || 0) : 0;
    if (triggerQty < (Number(r.bundleQuantity) || 2)) continue;

    // Find the target line(s)
    const targetLines = lines.filter((l) => String(l.subProductId) === targetId);
    if (!targetLines.length) continue;

    const dt = r.bundleDiscountType || 'percentage';
    const disc = Number(r.bundleDiscount) || 0;

    for (const tl of targetLines) {
      const qty = Number(tl.quantity) || 0;
      const lineGross = (Number(tl.price) || 0) * qty;
      const cost = Number(tl.costPrice) || 0;

      if (dt === 'percentage') {
        const amt = parseFloat(((lineGross * Math.min(100, disc)) / 100).toFixed(2));
        adjustments.push({ subProductId: targetId, discountAmount: Math.max(0, amt) });
      } else if (dt === 'fixed') {
        const amt = Math.min(disc * qty, lineGross);
        adjustments.push({ subProductId: targetId, discountAmount: Math.max(0, amt) });
      } else if (dt === 'markup_on_cost' && cost > 0) {
        const overridePrice = Math.round(cost * (1 + disc / 100) * 100) / 100;
        adjustments.push({ subProductId: targetId, overridePrice });
      } else if (dt === 'no_discount') {
        // Keep the target's own price (no sale price to restore in this context;
        // the line's price IS the original). Mark it so the caller knows.
        adjustments.push({ subProductId: targetId, overridePrice: Number(tl.price) || 0 });
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
