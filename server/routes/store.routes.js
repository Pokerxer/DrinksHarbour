// routes/store.routes.js  — public tenant/store listing

const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const Tenant = require('../models/Tenant');
const SubProduct = require('../models/SubProduct');
require('../models/Product'); // ensure 'products' collection is registered for $lookup
const Size = require('../models/Size');
const {
  calcPlatformCostPrice,
  calcPlatformSellingPrice,
  isDiscountActive,
  DEFAULT_PLATFORM_MARKUP,
} = require('../utils/pricing');

/**
 * Compute the websitePrice for one SubProduct + its sizes,
 * matching the exact pipeline used in product.service.js:
 *   Step 1: platformCostPrice  = calcPlatformCostPrice(costPrice, sellingPrice, revenueModel, markupPct, commissionPct)
 *   Step 2: platformSellingPrice = calcPlatformSellingPrice(platformCostPrice, platformMarkupPct, productDiscount)
 *   Step 3: apply subProduct-level sale discount (if active)
 *
 * Returns { minWebsitePrice, maxWebsitePrice, originalMinPrice, isOnSale }
 */
function computeStorePricing(subProduct, sizeDocs, tenant, product) {
  const revenueModel    = tenant.revenueModel       ?? 'markup';
  const markupPct       = tenant.markupPercentage   ?? 25;
  const commissionPct   = tenant.commissionPercentage ?? 12;
  const platformMarkupPct = product.platformMarkup  ?? DEFAULT_PLATFORM_MARKUP;

  // Product-level discount (applied before sale)
  const productDiscount = product.platformDiscount?.value > 0 && product.platformDiscount?.type
    ? {
        value : product.platformDiscount.value,
        type  : product.platformDiscount.type,
        start : product.platformDiscount.start,
        end   : product.platformDiscount.end,
      }
    : null;

  const now = new Date();

  // ── Flash sale validity ──────────────────────────────────────────────────────
  const fs          = subProduct.flashSale;
  const flashStart  = fs?.startDate ? new Date(fs.startDate) : null;
  const flashEnd    = fs?.endDate   ? new Date(fs.endDate)   : null;
  const flashActive =
    fs?.isActive === true &&
    (fs?.discountPercentage ?? 0) > 0 &&
    (!flashStart || now >= flashStart) &&
    (!flashEnd   || now <= flashEnd)   &&
    (fs?.remainingQuantity == null || fs.remainingQuantity > 0);

  // ── Regular sale validity ────────────────────────────────────────────────────
  const saleStart  = subProduct.saleStartDate ? new Date(subProduct.saleStartDate) : null;
  const saleEnd    = subProduct.saleEndDate   ? new Date(subProduct.saleEndDate)   : null;
  const saleActive = !flashActive &&
    subProduct.isOnSale &&
    (subProduct.saleDiscountValue ?? 0) > 0 &&
    (!saleStart || now >= saleStart) &&
    (!saleEnd   || now <= saleEnd);

  /**
   * Compute websitePrice for a single (costPrice, sellingPrice) pair,
   * then apply whichever discount is active (flash > regular).
   */
  function priceForVariant(costPrice, sellingPrice) {
    const platformCostPrice    = calcPlatformCostPrice(costPrice, sellingPrice, revenueModel, markupPct, commissionPct);
    let   platformSellingPrice = calcPlatformSellingPrice(platformCostPrice, platformMarkupPct, productDiscount);
    const priceBeforeSale      = platformSellingPrice;

    if (flashActive) {
      platformSellingPrice = parseFloat((platformSellingPrice * (1 - fs.discountPercentage / 100)).toFixed(2));
    } else if (saleActive) {
      const discountType = subProduct.saleType || 'percentage';
      if (discountType === 'percentage' || discountType === 'flash_sale') {
        platformSellingPrice = parseFloat((platformSellingPrice * (1 - subProduct.saleDiscountValue / 100)).toFixed(2));
      } else if (discountType === 'fixed') {
        platformSellingPrice = Math.max(0, parseFloat((platformSellingPrice - subProduct.saleDiscountValue).toFixed(2)));
      }
    }

    return { websitePrice: platformSellingPrice, originalPrice: priceBeforeSale };
  }

  const websitePrices    = [];
  const originalPrices   = [];

  if (sizeDocs && sizeDocs.length > 0) {
    // Size-variant path
    for (const size of sizeDocs) {
      const costPrice    = size.costPrice    ?? subProduct.costPrice        ?? 0;
      const sellingPrice = size.sellingPrice ?? subProduct.baseSellingPrice ?? 0;
      if (sellingPrice <= 0 && costPrice <= 0) continue;
      const { websitePrice, originalPrice } = priceForVariant(costPrice, sellingPrice);
      if (websitePrice > 0) {
        websitePrices.push(websitePrice);
        originalPrices.push(originalPrice);
      }
    }
  }

  // Fallback to subProduct-level price (no size variants)
  if (websitePrices.length === 0) {
    const costPrice    = subProduct.costPrice        ?? 0;
    const sellingPrice = subProduct.baseSellingPrice ?? 0;
    if (sellingPrice > 0 || costPrice > 0) {
      const { websitePrice, originalPrice } = priceForVariant(costPrice, sellingPrice);
      if (websitePrice > 0) {
        websitePrices.push(websitePrice);
        originalPrices.push(originalPrice);
      }
    }
  }

  if (websitePrices.length === 0) return null;

  const minWebsitePrice  = Math.min(...websitePrices);
  const maxWebsitePrice  = Math.max(...websitePrices);
  const originalMinPrice = Math.min(...originalPrices);

  return {
    minWebsitePrice,
    maxWebsitePrice,
    // Show original only when there's an actual discount (sale or product discount)
    originalMinPrice : (saleActive && subProduct.saleDiscountValue > 0) || isDiscountActive(productDiscount)
      ? originalMinPrice
      : null,
    isOnSale:           flashActive || (saleActive && subProduct.saleDiscountValue > 0),
    isFlashSale:        flashActive,
    hasProductDiscount: isDiscountActive(productDiscount),
  };
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * @desc    List all approved stores (public)
 * @route   GET /api/stores
 */
router.get('/', asyncHandler(async (req, res) => {
  const { search, city, state, page = 1, limit = 20 } = req.query;

  const query = { status: 'approved' };
  if (search) query.name = { $regex: search, $options: 'i' };
  if (city)   query.city  = { $regex: city,  $options: 'i' };
  if (state)  query.state = { $regex: state, $options: 'i' };

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [stores, total] = await Promise.all([
    Tenant.find(query)
      .select('name slug logo primaryColor city state plan description')
      .sort({ name: 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    Tenant.countDocuments(query),
  ]);

  // Count distinct approved products that have at least one active/low_stock subProduct per tenant
  const tenantIds = stores.map(s => s._id);
  const availableCounts = await SubProduct.aggregate([
    { $match: { tenant: { $in: tenantIds }, status: { $in: ['active', 'low_stock'] }, isPublished: true, visibleInOnlineStore: true } },
    { $lookup: { from: 'products', localField: 'product', foreignField: '_id', as: '_prod' } },
    { $unwind: '$_prod' },
    { $match: { '_prod.status': 'approved' } },
    { $group: { _id: { tenant: '$tenant', product: '$product' } } },
    { $group: { _id: '$_id.tenant', count: { $sum: 1 } } },
  ]);
  const countMap = Object.fromEntries(availableCounts.map(r => [r._id.toString(), r.count]));

  const storesWithCount = stores
    .map(s => ({ ...s, productCount: countMap[s._id.toString()] ?? 0 }))
    .sort((a, b) => b.productCount - a.productCount); // sort by real count

  res.json({
    success: true,
    data: {
      stores: storesWithCount,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
    },
  });
}));

/**
 * @desc    Get single store + its products with correct websitePrice (public)
 * @route   GET /api/stores/:slug
 */
router.get('/:slug', asyncHandler(async (req, res) => {
  const store = await Tenant.findOne({ slug: req.params.slug, status: 'approved' })
    .select('name slug logo primaryColor city state plan description email address revenueModel markupPercentage commissionPercentage')
    .lean();

  if (!store) {
    return res.status(404).json({ success: false, message: 'Store not found' });
  }

  // Count the real number of distinct approved products available from this store
  const availableCountAgg = await SubProduct.aggregate([
    { $match: { tenant: store._id, status: { $in: ['active', 'low_stock'] }, isPublished: true, visibleInOnlineStore: true } },
    { $lookup: { from: 'products', localField: 'product', foreignField: '_id', as: '_prod' } },
    { $unwind: '$_prod' },
    { $match: { '_prod.status': 'approved' } },
    { $group: { _id: '$product' } },
    { $count: 'total' },
  ]);
  store.productCount = availableCountAgg[0]?.total ?? 0;

  // Fetch active published subProducts, including the fields needed for pricing
  const subProducts = await SubProduct.find({
    tenant: store._id,
    status: { $in: ['active', 'low_stock'] },
    isPublished: true,
    visibleInOnlineStore: true,
  })
    .select('product costPrice baseSellingPrice salePrice isOnSale saleType saleDiscountValue saleStartDate saleEndDate flashSale bundleDeals sizes')
    .populate({
      path   : 'product',
      select : 'name slug images primaryImage status platformMarkup platformDiscount abv originCountry',
    })
    .limit(40) // fetch more than we display so we can deduplicate
    .lean();

  // Collect all Size IDs referenced by these subProducts
  const allSizeIds = [...new Set(subProducts.flatMap(sp => (sp.sizes || []).map(s => s.toString())))];
  const sizeDocs   = allSizeIds.length > 0
    ? await Size.find({ _id: { $in: allSizeIds } })
        .select('costPrice sellingPrice discountValue discountType discountStart discountEnd size subproduct')
        .lean()
    : [];
  const sizeMap = Object.fromEntries(sizeDocs.map(s => [s._id.toString(), s]));

  // Deduplicate by product, compute correct websitePrice per the platform pricing pipeline
  const seen       = new Set();
  const products   = [];

  for (const sp of subProducts) {
    if (!sp.product || sp.product.status !== 'approved') continue;
    const pid = sp.product._id.toString();
    if (seen.has(pid)) continue;
    seen.add(pid);

    const variantSizes = (sp.sizes || [])
      .map(id => sizeMap[id.toString()])
      .filter(Boolean);

    const pricing = computeStorePricing(sp, variantSizes, store, sp.product);
    if (!pricing) continue;

    // Collect unique size labels for this product
    const sizeLabels = [...new Set(variantSizes.map(s => s.size).filter(Boolean))];

    products.push({
      _id          : sp.product._id,
      name         : sp.product.name,
      slug         : sp.product.slug,
      primaryImage : sp.product.primaryImage || sp.product.images?.[0] || null,
      abv          : sp.product.abv ?? null,
      originCountry: sp.product.originCountry ?? null,
      sizes        : sizeLabels,
      minWebsitePrice  : pricing.minWebsitePrice,
      maxWebsitePrice  : pricing.maxWebsitePrice,
      originalMinPrice : pricing.originalMinPrice,
      isOnSale         : pricing.isOnSale || pricing.hasProductDiscount,
    });

    if (products.length >= 8) break;
  }

  res.json({
    success : true,
    data    : { store, products },
  });
}));

module.exports = router;
