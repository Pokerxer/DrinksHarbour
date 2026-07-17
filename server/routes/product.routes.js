// routes/product.routes.js

const express = require('express');
const router = express.Router();
const productController = require('../controllers/product.controller');
const productService = require('../services/product.service');
const asyncHandler = require('../utils/asyncHandler');
const { protect, authorize } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validation.middleware');
const { uploadReviewImages } = require('../middleware/imageUpload.middleware');
const { body, param, query } = require('express-validator');

const productValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Product name is required')
    .isLength({ max: 200 })
    .withMessage('Product name cannot exceed 200 characters'),
  body('type')
    .isIn([
      'beer', 'wine', 'sparkling_wine', 'fortified_wine', 'spirit',
      'liqueur', 'cocktail_ready_to_drink', 'non_alcoholic', 'other',
      'juice', 'tea', 'coffee', 'energy_drink', 'water', 'mixer',
      'accessory', 'snack', 'gift'
    ])
    .withMessage('Invalid product type'),
];

const mongoIdValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid product ID'),
];

// ============================================================
// PUBLIC ROUTES (No authentication required)
// ============================================================

/**
 * Get all products with filtering and pagination
 * @route GET /api/products
 * @access Public
 */
router.get('/', productController.getAllProducts);

/**
 * Get featured products
 * @route GET /api/products/featured
 * @access Public
 */
router.get('/featured', productController.getFeaturedProducts);

/**
 * Get new arrivals
 * @route GET /api/products/new-arrivals
 * @access Public
 */
router.get('/new-arrivals', productController.getNewArrivals);

/**
 * Get bestsellers
 * @route GET /api/products/bestsellers
 * @access Public
 */
router.get('/bestsellers', productController.getBestsellers);

/**
 * Get trending products
 * @route GET /api/products/trending
 * @access Public
 */
router.get('/trending', productController.getTrendingProducts);

/**
 * @route   GET /api/products/recommendations/personalized
 * @desc    Get personalized product recommendations
 * @access  Private
 */
router.get(
  '/recommendations/personalized',
  protect,
  productController.getPersonalizedRecommendations
);


/**
 * Get products by category
 * @route GET /api/products/category/:slug
 * @access Public
 */
router.get(
  '/category/:slug',
  productController.getProductsByCategory
);

/**
 * Get products by brand
 * @route GET /api/products/brand/:slug
 * @access Public
 */
router.get(
  '/brand/:slug',
  productController.getProductsByBrand
);

/**
 * Search products
 * @route GET /api/products/search
 * @access Public
 */
router.get(
  '/search',
  productController.searchProductsPublic
);

/**
 * Catalog-wide filter facets (brands, origins, categories, price bounds)
 * @route GET /api/products/filter-options
 * @access Public
 */
router.get(
  '/filter-options',
  productController.getProductFilterOptions
);

/**
 * Get search suggestions
 * @route GET /api/products/suggestions
 * @access Public
 */
router.get(
  '/suggestions',
  asyncHandler(async (req, res) => {
    const { q, limit = 8 } = req.query;
    const suggestions = await productService.getSearchSuggestions(q, parseInt(limit));
    res.status(200).json({
      success: true,
      data: suggestions,
    });
  })
);

/**
 * Get all approved product slugs (for sitemap generation)
 * @route GET /api/products/slugs
 * @access Public
 */
router.get(
  '/slugs',
  asyncHandler(async (req, res) => {
    const ProductModel = require('../models/product.model');
    const docs = await ProductModel
      .find({ status: 'approved' }, 'slug updatedAt -_id')
      .lean();
    const items = docs
      .filter((p) => p.slug)
      .map((p) => ({ slug: p.slug, updatedAt: p.updatedAt }));
    res.status(200).json({
      success: true,
      // `slugs` kept for backward compatibility; `items` adds updatedAt so the
      // platform sitemap can emit truthful <lastmod> values.
      data: { slugs: items.map((p) => p.slug), items },
    });
  })
);

// ============================================================
// WISHLIST ROUTES (must be before /:id to avoid param capture)
// ============================================================

/**
 * Get user's wishlist
 * @route GET /api/products/wishlist
 */
router.get('/wishlist', protect, productController.getWishlist);

/**
 * Clear entire wishlist
 * @route DELETE /api/products/wishlist
 */
router.delete('/wishlist', protect, productController.clearWishlistController);

/**
 * Add product to wishlist
 * @route POST /api/products/wishlist/:id
 */
router.post('/wishlist/:id', protect, mongoIdValidation, validate, productController.addProductToWishlist);

/**
 * Remove product from wishlist
 * @route DELETE /api/products/wishlist/:id
 */
router.delete('/wishlist/:id', protect, mongoIdValidation, validate, productController.removeProductFromWishlist);

/**
 * Get single product by ID
 * @route GET /api/products/:id
 * @access Public
 */
router.get(
  '/:id',
  mongoIdValidation,
  validate,
  productController.getProductById
);

/**
 * Get single product by slug
 * @route GET /api/products/slug/:slug
 * @access Public
 */
router.get(
  '/slug/:slug',
  productController.getProductBySlug
);

/**
 * Get related products
 * @route GET /api/products/:id/related
 * @access Public
 */
router.get(
  '/:id/related',
  mongoIdValidation,
  validate,
  productController.getRelatedProducts
);

/**
 * Get product reviews
 * @route GET /api/products/:id/reviews
 * @access Public
 */
router.get(
  '/:id/reviews',
  mongoIdValidation,
  validate,
  productController.getProductReviews
);

/**
 * Check if the authenticated user can review this product
 * @route GET /api/products/:id/reviews/eligibility
 * @access Private
 */
router.get(
  '/:id/reviews/eligibility',
  protect,
  mongoIdValidation,
  validate,
  productController.checkReviewEligibility
);

/**
 * Submit a product review (verified-purchase only, up to 5 images)
 * @route POST /api/products/:id/reviews
 * @access Private
 */
router.post(
  '/:id/reviews',
  protect,
  mongoIdValidation,
  validate,
  uploadReviewImages,   // multer: up to 5 images in field "images"
  productController.submitProductReview
);

/**
 * Mark a review as helpful (toggle)
 * @route POST /api/products/reviews/:reviewId/helpful
 * @access Private
 */
router.post(
  '/reviews/:reviewId/helpful',
  protect,
  productController.markReviewHelpful
);

/**
 * Add product to cart
 * @route POST /api/products/cart/:id
 * @access Public (optional auth)
 */
router.post(
  '/cart/:id',
  mongoIdValidation,
  validate,
  productController.addProductToCart
);

// ============================================================
// ADMIN ROUTES (Super Admin / Tenant Admin / Tenant Owner)
// ============================================================

router.use(protect);
// tenant_owner included so owners can browse the product catalogue
router.use(authorize('super_admin', 'tenant_admin', 'admin', 'tenant_owner'));

/**
 * Get all products (admin with stats)
 * @route GET /api/products/admin/all
 * @access Private/Admin (incl. tenant_admin/owner for read-only browsing)
 */
router.get('/admin/all', productController.getAllProducts);

/**
 * Get all products directly from DB for admin CRUD (all statuses, no tenant filtering)
 * @route GET /api/products/admin/list
 * @access Private/Admin (incl. tenant_admin/owner for read-only browsing)
 */
router.get('/admin/list', productController.getAdminProductList);

/**
 * Get pending products
 * @route GET /api/products/admin/pending
 * @access Private/Admin (incl. tenant_admin/owner for read-only browsing)
 */
router.get('/admin/pending', productController.getPendingProducts);

// ── Product mutations — restricted to platform admins only ──────────────────
// Central Products are platform-owned; tenants may only create pending proposals.
router.use(authorize('super_admin', 'admin'));

/**
 * Create new product
 * @route POST /api/products
 * @access Private/PlatformAdmin
 */
router.post(
  '/',
  productValidation,
  validate,
  productController.createProduct
);

/**
 * Update product
 * @route PUT /api/products/:id
 * @access Private/PlatformAdmin
 */
router.put(
  '/:id',
  mongoIdValidation,
  validate,
  productController.updateProduct
);

/**
 * Delete product (soft delete)
 * @route DELETE /api/products/:id
 * @access Private/PlatformAdmin
 */
router.delete(
  '/:id',
  mongoIdValidation,
  validate,
  productController.deleteProduct
);

/**
 * Approve product — super_admin only (AGENTS.md: "pending until super-admin publishes")
 * @route POST /api/products/:id/approve
 * @access Private/SuperAdmin
 */
router.post(
  '/:id/approve',
  authorize('super_admin'),
  mongoIdValidation,
  validate,
  productController.approveProduct
);

/**
 * Reject product — super_admin only
 * @route POST /api/products/:id/reject
 * @access Private/SuperAdmin
 */
router.post(
  '/:id/reject',
  authorize('super_admin'),
  mongoIdValidation,
  validate,
  productController.rejectProduct
);

module.exports = router;
