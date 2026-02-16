// routes/product.routes.js

const express = require('express');
const router = express.Router();
const productController = require('../controllers/product.controller');
const productService = require('../services/product.service');
const asyncHandler = require('../utils/asyncHandler');
const { protect, authorize } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validation.middleware');
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

// ============================================================
// WISHLIST & CART ROUTES (Optional Auth)
// ============================================================

/**
 * Add product to wishlist
 * @route POST /api/products/wishlist/:id
 * @access Public (optional auth)
 */
router.post(
  '/wishlist/:id',
  mongoIdValidation,
  validate,
  productController.addProductToWishlist
);

/**
 * Remove product from wishlist
 * @route DELETE /api/products/wishlist/:id
 * @access Public (optional auth)
 */
router.delete(
  '/wishlist/:id',
  mongoIdValidation,
  validate,
  productController.removeProductFromWishlist
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
// ADMIN ROUTES (Super Admin / Tenant Admin)
// ============================================================

router.use(protect);
router.use(authorize('super_admin', 'tenant_admin', 'admin'));

/**
 * Create new product
 * @route POST /api/products
 * @access Private/Admin
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
 * @access Private/Admin
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
 * @access Private/Admin
 */
router.delete(
  '/:id',
  mongoIdValidation,
  validate,
  productController.deleteProduct
);

/**
 * Get all products (admin with stats)
 * @route GET /api/products/admin/all
 * @access Private/Admin
 */
router.get('/admin/all', productController.getAllProducts);

/**
 * Get pending products
 * @route GET /api/products/admin/pending
 * @access Private/Admin
 */
router.get('/admin/pending', productController.getPendingProducts);

/**
 * Approve product
 * @route POST /api/products/:id/approve
 * @access Private/Admin
 */
router.post(
  '/:id/approve',
  mongoIdValidation,
  validate,
  productController.approveProduct
);

/**
 * Reject product
 * @route POST /api/products/:id/reject
 * @access Private/Admin
 */
router.post(
  '/:id/reject',
  mongoIdValidation,
  validate,
  productController.rejectProduct
);

module.exports = router;
