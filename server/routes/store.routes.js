// routes/store.routes.js  — public tenant/store listing

const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const Tenant = require('../models/Tenant');
const Product = require('../models/Product');
const SubProduct = require('../models/SubProduct');
const Size = require('../models/Size');

const { calculateSizePricing, calculateSubProductPricing, isDiscountActive } = require('../utils/pricing');

/**
 * @desc    List all approved stores (public)
 * @route   GET /api/stores
 */
router.get('/', asyncHandler(async (req, res) => {
  const { search, city, state, page = 1, limit = 20 } = req.query;

  const query = { status: 'approved' };

  if (search) {
    query.name = { $regex: search, $options: 'i' };
  }
  if (city) query.city = { $regex: city, $options: 'i' };
  if (state) query.state = { $regex: state, $options: 'i' };

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [stores, total] = await Promise.all([
    Tenant.find(query)
      .select('name slug logo primaryColor city state plan productCount totalOrders description email address')
      .sort({ productCount: -1, name: 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    Tenant.countDocuments(query),
  ]);

  res.json({
    success: true,
    data: {
      stores,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    },
  });
}));

/**
 * @desc    Get single store with its products (public)
 * @route   GET /api/stores/:slug
 */
router.get('/:slug', asyncHandler(async (req, res) => {
  const store = await Tenant.findOne({ slug: req.params.slug, status: 'approved' })
    .select('name slug logo primaryColor city state plan productCount description email address revenueModel markupPercentage commissionPercentage platformMarkupPercentage')
    .lean();

  if (!store) {
    return res.status(404).json({ success: false, message: 'Store not found' });
  }

  // Fetch active subproducts with sizes
  const subProducts = await SubProduct.find({ tenant: store._id, status: { $in: ['active', 'low_stock'] } })
    .select('product baseSellingPrice costPrice salePrice isOnSale saleType saleDiscountValue saleStartDate saleEndDate sizes availableStock discount discountType discountStart discountEnd')
    .populate('product', 'name slug images primaryImage status')
    .lean();

  // Get all Size IDs
  const allSizeIds = [...new Set(subProducts.flatMap(sp => (sp.sizes || []).map(s => s.toString())))];
  const sizeDocs = allSizeIds.length > 0 
    ? await Size.find({ _id: { $in: allSizeIds }, status: 'active' }).lean()
    : [];
  const sizeMap = {};
  sizeDocs.forEach(s => { sizeMap[s._id.toString()] = s; });

  // Deduplicate & filter to approved products
  const seen = new Set();
  const productMap = {};

  subProducts.forEach(sp => {
    if (!sp.product || sp.product.status !== 'approved') return;
    const pid = sp.product._id.toString();
    if (seen.has(pid)) return;
    seen.add(pid);

    // Calculate min price from sizes (same logic as shop page)
    let minPrice = sp.baseSellingPrice || 0;
    let maxPrice = sp.baseSellingPrice || 0;
    let hasDiscount = false;
    let saleActive = false;

    // Check size-level pricing
    if (sp.sizes && sp.sizes.length > 0) {
      const prices = [];
      sp.sizes.forEach(sizeId => {
        const sz = sizeMap[sizeId.toString()];
        if (sz) {
          const sizePrice = sz.sellingPrice || sp.baseSellingPrice;
          if (sizePrice > 0) prices.push(sizePrice);
          // Check for discounts
          if (sz.discount && isDiscountActive(sz.discount)) hasDiscount = true;
        }
      });
      if (prices.length > 0) {
        minPrice = Math.min(...prices);
        maxPrice = Math.max(...prices);
      }
    }

    // Check subproduct-level sale (date validated)
    if (sp.isOnSale && sp.saleStartDate && sp.saleEndDate) {
      const now = new Date();
      saleActive = now >= new Date(sp.saleStartDate) && now <= new Date(sp.saleEndDate);
    }
    if (saleActive && sp.salePrice) hasDiscount = true;

    // Check subproduct discount (date validated)
    if (sp.discount && isDiscountActive(sp.discount)) hasDiscount = true;

    productMap[pid] = {
      _id: sp.product._id,
      name: sp.product.name,
      slug: sp.product.slug,
      primaryImage: sp.product.primaryImage || sp.product.images?.[0] || null,
      minPrice,
      maxPrice,
      hasDiscount,
      saleActive,
      salePrice: saleActive ? sp.salePrice : null,
    };
  });

  const products = Object.values(productMap);

  res.json({
    success: true,
    data: { store, products },
  });
}));

module.exports = router;