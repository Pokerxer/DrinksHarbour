// routes/promo.routes.js

const express = require('express');
const router = express.Router();
const promoController = require('../controllers/promo.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validation.middleware');
const { body, param, query } = require('express-validator');

// Validation rules
const createPromoValidation = [
  body('code')
    .trim()
    .notEmpty()
    .withMessage('Promo code is required')
    .isLength({ min: 3, max: 20 })
    .withMessage('Code must be between 3 and 20 characters'),
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Promo name is required')
    .isLength({ max: 100 })
    .withMessage('Name cannot exceed 100 characters'),
  body('type')
    .isIn(['percentage', 'fixed', 'bogo', 'free_shipping', 'bundle'])
    .withMessage('Invalid promo type'),
  body('discountValue')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Discount value must be a positive number'),
  body('minimumOrderValue')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Minimum order value must be a positive number'),
  body('usageLimit')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Usage limit must be a positive integer'),
  body('startDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid start date format'),
  body('endDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid end date format'),
];

const validatePromoValidation = [
  body('code')
    .trim()
    .notEmpty()
    .withMessage('Promo code is required'),
  body('subtotal')
    .isFloat({ min: 0 })
    .withMessage('Subtotal must be a positive number'),
];

const mongoIdValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid promo ID'),
];

// ============================================================
// PUBLIC ROUTES
// ============================================================

/**
 * Get active promos for display
 * @route GET /api/promos/active
 */
router.get(
  '/active',
  [
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
    query('placement').optional().isString(),
  ],
  validate,
  promoController.getActivePromos
);

/**
 * Validate promo for order
 * @route POST /api/promos/validate
 */
router.post(
  '/validate',
  validatePromoValidation,
  validate,
  protect,
  promoController.validatePromo
);

/**
 * Apply promo to order
 * @route POST /api/promos/apply
 */
router.post(
  '/apply',
  [
    body('code').trim().notEmpty().withMessage('Promo code is required'),
    body('orderId').notEmpty().withMessage('Order ID is required'),
  ],
  validate,
  protect,
  promoController.applyPromo
);

/**
 * Get promo by code (public)
 * @route GET /api/promos/code/:code
 */
router.get(
  '/code/:code',
  promoController.getPromoByCode
);

// ============================================================
// PROTECTED ROUTES (Admin only after this point)
// ============================================================

router.use(protect);
router.use(authorize('admin', 'super_admin'));

/**
 * Get all promos
 * @route GET /api/promos
 */
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('status').optional().isIn(['draft', 'scheduled', 'active', 'expired', 'disabled']),
    query('type').optional().isIn(['percentage', 'fixed', 'bogo', 'free_shipping', 'bundle']),
    query('search').optional().isString(),
  ],
  validate,
  promoController.getAllPromos
);

/**
 * Create new promo
 * @route POST /api/promos
 */
router.post(
  '/',
  createPromoValidation,
  validate,
  promoController.createPromo
);

/**
 * Get promo by ID
 * @route GET /api/promos/:id
 */
router.get(
  '/:id',
  mongoIdValidation,
  validate,
  promoController.getPromoById
);

/**
 * Update promo
 * @route PUT /api/promos/:id
 */
router.put(
  '/:id',
  mongoIdValidation,
  validate,
  promoController.updatePromo
);

/**
 * Delete promo
 * @route DELETE /api/promos/:id
 */
router.delete(
  '/:id',
  mongoIdValidation,
  validate,
  promoController.deletePromo
);

/**
 * Toggle promo status
 * @route PATCH /api/promos/:id/toggle
 */
router.patch(
  '/:id/toggle',
  mongoIdValidation,
  validate,
  promoController.togglePromoStatus
);

/**
 * Reset promo usage count
 * @route PATCH /api/promos/:id/reset-usage
 */
router.patch(
  '/:id/reset-usage',
  mongoIdValidation,
  validate,
  promoController.resetPromoUsage
);

module.exports = router;
