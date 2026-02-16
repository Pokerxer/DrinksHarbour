// routes/sale.routes.js

const express = require('express');
const router = express.Router();
const saleController = require('../controllers/sale.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validation.middleware');
const { body, param, query } = require('express-validator');

// Validation rules
const createSaleValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Sale name is required')
    .isLength({ max: 100 })
    .withMessage('Name cannot exceed 100 characters'),
  body('type')
    .isIn(['flash_sale', 'seasonal', 'clearance', 'bundle', 'bogo', 'percentage_off', 'fixed_off'])
    .withMessage('Invalid sale type'),
  body('discountType')
    .isIn(['percentage', 'fixed', 'bogo'])
    .withMessage('Invalid discount type'),
  body('discountValue')
    .isFloat({ min: 0 })
    .withMessage('Discount value must be a positive number'),
  body('startDate')
    .isISO8601()
    .withMessage('Invalid start date format'),
  body('endDate')
    .isISO8601()
    .withMessage('Invalid end date format'),
  body('bannerImage.url')
    .isURL()
    .withMessage('Banner image URL is required'),
];

const mongoIdValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid sale ID'),
];

// ============================================================
// PUBLIC ROUTES
// ============================================================

/**
 * Get active sales for display
 * @route GET /api/sales/active
 */
router.get(
  '/active',
  [
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
    query('type').optional().isIn(['flash_sale', 'seasonal', 'clearance', 'bundle', 'bogo', 'percentage_off', 'fixed_off']),
  ],
  validate,
  saleController.getActiveSales
);

/**
 * Get sale by product
 * @route GET /api/sales/product/:productId
 */
router.get(
  '/product/:productId',
  saleController.getSaleByProduct
);

/**
 * Increment view count
 * @route POST /api/sales/:id/view
 */
router.post(
  '/:id/view',
  mongoIdValidation,
  validate,
  saleController.incrementView
);

// ============================================================
// PROTECTED ROUTES (Admin only after this point)
// ============================================================

router.use(protect);
router.use(authorize('admin', 'super_admin'));

/**
 * Get all sales
 * @route GET /api/sales
 */
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('status').optional().isIn(['scheduled', 'active', 'ended', 'cancelled']),
    query('type').optional().isIn(['flash_sale', 'seasonal', 'clearance', 'bundle', 'bogo', 'percentage_off', 'fixed_off']),
    query('search').optional().isString(),
  ],
  validate,
  saleController.getAllSales
);

/**
 * Create new sale
 * @route POST /api/sales
 */
router.post(
  '/',
  createSaleValidation,
  validate,
  saleController.createSale
);

/**
 * Get sale by ID
 * @route GET /api/sales/:id
 */
router.get(
  '/:id',
  mongoIdValidation,
  validate,
  saleController.getSaleById
);

/**
 * Update sale
 * @route PUT /api/sales/:id
 */
router.put(
  '/:id',
  mongoIdValidation,
  validate,
  saleController.updateSale
);

/**
 * Delete sale
 * @route DELETE /api/sales/:id
 */
router.delete(
  '/:id',
  mongoIdValidation,
  validate,
  saleController.deleteSale
);

/**
 * Toggle sale status
 * @route PATCH /api/sales/:id/toggle
 */
router.patch(
  '/:id/toggle',
  mongoIdValidation,
  validate,
  saleController.toggleSaleStatus
);

/**
 * Apply sale to products
 * @route POST /api/sales/:id/apply
 */
router.post(
  '/:id/apply',
  [
    mongoIdValidation[0],
    body('productIds')
      .isArray({ min: 1 })
      .withMessage('Product IDs array is required'),
    body('productIds.*')
      .isMongoId()
      .withMessage('Invalid product ID'),
  ],
  validate,
  saleController.applySaleToProducts
);

/**
 * Remove sale from products
 * @route POST /api/sales/:id/remove
 */
router.post(
  '/:id/remove',
  mongoIdValidation,
  validate,
  saleController.removeSaleFromProducts
);

/**
 * End sale manually
 * @route PATCH /api/sales/:id/end
 */
router.patch(
  '/:id/end',
  mongoIdValidation,
  validate,
  saleController.endSale
);

module.exports = router;
