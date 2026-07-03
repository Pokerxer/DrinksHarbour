// server/services/salesPricing.service.js
const SubProduct = require('../models/SubProduct');
const Size = require('../models/Size');
const Pricelist = require('../models/Pricelist');
const Tenant = require('../models/Tenant');
const { computePOSPricing } = require('../controllers/pos.controller');
const {
  findMatchingPriceRules,
  applyPriceRules,
  pickBestBundle,
  applyBundleOverride,
  computeBundleLineDiscount,
  applyCartBundles,
  findCartThresholdRules,
  computeCartThresholdDiscount,
} = require('./pricelistPricing.service');

/**
 * The authoritative per-unit pricing for one line: runs the subproduct through
 * the same base pricing pipeline as POS (computePOSPricing), then the
 * tenant's pricelist price rules + same-product bundle rules on top.
 * Percentage/fixed bundle savings fold into the per-unit price (Sales has no
 * separate line-level discount field the way POS's receipt breakdown does).
 * Returns { unitPrice, costPrice, originalPrice } (or null if the subproduct
 * is missing) so the cart-wide bundle pass can reuse cost/original without a
 * second lookup.
 */
async function computeLinePricing({ subProductId, sizeId, quantity, pricelist, tenant }) {
  const sp = await SubProduct.findById(subProductId)
    .select('product sku baseSellingPrice basePriceBeforePricelist costPrice isOnSale saleType saleStartDate saleEndDate saleDiscountValue flashSale bundleDeals')
    .populate('product', 'platformMarkup platformDiscount')
    .lean();
  if (!sp) return null;

  const sizeDoc = sizeId ? await Size.findById(sizeId).lean() : null;
  const pricing = computePOSPricing(sp, sizeDoc, tenant);
  const cost = pricing.costPrice || 0;
  if (!(pricing.sellingPrice > 0)) {
    return { unitPrice: pricing.sellingPrice, costPrice: cost, originalPrice: pricing.originalPrice };
  }

  const sortedPriceRules = findMatchingPriceRules(pricelist?.rules, subProductId, quantity);
  let price = applyPriceRules(pricing.sellingPrice, cost, sortedPriceRules);

  const bestBundle = pickBestBundle(sp.bundleDeals, pricelist?.rules, quantity, subProductId, { price, costPrice: cost });
  const bundleOverride = applyBundleOverride(price, bestBundle, cost, pricing.originalPrice);
  if (bundleOverride.overridden) {
    price = bundleOverride.price;
  } else if (bestBundle) {
    const lineGross = price * quantity;
    const lineDiscount = computeBundleLineDiscount(bestBundle, lineGross, quantity, 0, false);
    if (lineDiscount > 0) price = Math.max(0, price - lineDiscount / quantity);
  }

  return {
    unitPrice: Math.round(price * 100) / 100,
    costPrice: cost,
    originalPrice: pricing.originalPrice,
  };
}

/**
 * Back-compat wrapper: the bare per-unit price (used by tests/tools that only
 * care about the number).
 */
async function computeLineUnitPrice(args) {
  const r = await computeLinePricing(args);
  return r == null ? null : r.unitPrice;
}

/**
 * Recomputes unitPrice for every line that has a subproduct and is not
 * priceOverridden, then runs the cart-wide cross-product bundle pass
 * (buy N of A → discount B) across the whole line set. Cross-product
 * percentage/fixed savings fold into the target line's unitPrice; override
 * types replace it. Best-effort per line: a lookup failure leaves that one
 * line's price untouched rather than failing the whole order.
 */
async function computeAuthoritativeLinePrices(items, { tenantId, pricelistId }) {
  const needsPricing = items.some((it) => !it.priceOverridden && it.subproduct);
  if (!needsPricing) return items;

  const tenant = await Tenant.findById(tenantId)
    .select('revenueModel markupPercentage commissionPercentage')
    .lean();
  const pricelist = pricelistId
    ? await Pricelist.findOne({ _id: pricelistId, tenant: tenantId }).lean()
    : null;

  const out = [];
  const lineMeta = []; // parallel to `out`: pricing context for the cart pass
  for (const it of items) {
    if (it.priceOverridden || !it.subproduct) {
      out.push(it);
      lineMeta.push(null);
      continue;
    }
    try {
      const priced = await computeLinePricing({
        subProductId: it.subproduct,
        sizeId: it.size,
        quantity: Number(it.quantity) || 0,
        pricelist,
        tenant,
      });
      out.push(priced != null ? { ...it, unitPrice: priced.unitPrice } : it);
      lineMeta.push(priced);
    } catch {
      out.push(it);
      lineMeta.push(null);
    }
  }

  // ── Cross-product Buy-X-Get-Y bundle rules (cart-wide pass) ────────────────
  // Trigger quantities are counted across ALL product lines (including
  // overridden ones — buying the trigger still qualifies), but adjustments are
  // only applied to lines the engine priced (never to manual overrides).
  if (pricelist?.rules?.length) {
    const cartLines = out.map((it, i) => ({
      subProductId: it.subproduct ? String(it.subproduct) : `__none_${i}`,
      quantity: Number(it.quantity) || 0,
      price: Number(it.unitPrice) || 0,
      costPrice: lineMeta[i]?.costPrice || 0,
      originalPrice: lineMeta[i]?.originalPrice || 0,
    }));
    for (const adj of applyCartBundles(cartLines, pricelist.rules)) {
      const it = out[adj.lineIndex];
      if (!it || lineMeta[adj.lineIndex] == null) continue; // overridden/unpriced line
      const qty = Number(it.quantity) || 0;
      if (adj.overridePrice != null && adj.overridePrice > 0) {
        out[adj.lineIndex] = { ...it, unitPrice: adj.overridePrice };
      } else if (adj.discountAmount > 0 && qty > 0) {
        const perUnit = Math.max(0, (Number(it.unitPrice) || 0) - adj.discountAmount / qty);
        out[adj.lineIndex] = { ...it, unitPrice: Math.round(perUnit * 100) / 100 };
      }
    }
  }

  return out;
}

/**
 * Cart spend-threshold discount for a sales order: loads the pricelist and
 * runs the shared cart_threshold engine against the given untaxed base.
 * Returns a whole-₦ discount (sales totals are integer NGN). Best-effort:
 * any failure returns 0 so an order can always be saved.
 */
async function computeCartThresholdForOrder(subtotalBase, { tenantId, pricelistId }) {
  const base = Math.max(0, Number(subtotalBase) || 0);
  if (!pricelistId || base <= 0) return 0;
  try {
    const pricelist = await Pricelist.findOne({ _id: pricelistId, tenant: tenantId })
      .select('rules')
      .lean();
    if (!pricelist?.rules?.length) return 0;
    const rules = findCartThresholdRules(pricelist.rules, base);
    return Math.round(computeCartThresholdDiscount(rules, base));
  } catch {
    return 0;
  }
}

module.exports = {
  computeLinePricing,
  computeLineUnitPrice,
  computeAuthoritativeLinePrices,
  computeCartThresholdForOrder,
};
