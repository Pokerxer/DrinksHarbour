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
} = require('./pricelistPricing.service');

/**
 * The authoritative per-unit price for one line: runs the subproduct through
 * the same base pricing pipeline as POS (computePOSPricing), then the
 * tenant's pricelist price rules + bundle rules on top. Percentage/fixed
 * bundle savings fold into the per-unit price (Sales has no separate
 * line-level discount field the way POS's receipt breakdown does).
 */
async function computeLineUnitPrice({ subProductId, sizeId, quantity, pricelist, tenant }) {
  const sp = await SubProduct.findById(subProductId)
    .select('product sku baseSellingPrice basePriceBeforePricelist costPrice isOnSale saleType saleStartDate saleEndDate saleDiscountValue flashSale bundleDeals')
    .populate('product', 'platformMarkup platformDiscount')
    .lean();
  if (!sp) return null;

  const sizeDoc = sizeId ? await Size.findById(sizeId).lean() : null;
  const pricing = computePOSPricing(sp, sizeDoc, tenant);
  if (!(pricing.sellingPrice > 0)) return pricing.sellingPrice;

  const cost = pricing.costPrice || 0;
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

  return Math.round(price * 100) / 100;
}

/**
 * Recomputes unitPrice for every line that has a subproduct and is not
 * priceOverridden. Best-effort per line: a lookup failure leaves that one
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
  for (const it of items) {
    if (it.priceOverridden || !it.subproduct) {
      out.push(it);
      continue;
    }
    try {
      const unitPrice = await computeLineUnitPrice({
        subProductId: it.subproduct,
        sizeId: it.size,
        quantity: Number(it.quantity) || 0,
        pricelist,
        tenant,
      });
      out.push(unitPrice != null ? { ...it, unitPrice } : it);
    } catch {
      out.push(it);
    }
  }
  return out;
}

module.exports = { computeLineUnitPrice, computeAuthoritativeLinePrices };
