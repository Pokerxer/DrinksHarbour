// routes/coupon.routes.js

const express = require('express');
const router = express.Router();
const couponController = require('../controllers/coupon.controller');
const { protect, authorize, optionalProtect } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validation.middleware');
const { body, param, query } = require('express-validator');

// ============================================================
// VALIDATION RULES
// ============================================================

const createCouponValidation = [
    body('code')
        .optional()
        .trim()
        .isLength({ min: 3, max: 50 })
        .withMessage('Coupon code must be between 3 and 50 characters')
        .matches(/^[A-Z0-9-]+$/)
        .withMessage('Coupon code can only contain uppercase letters, numbers, and hyphens'),

    body('name')
        .trim()
        .notEmpty()
        .withMessage('Coupon name is required')
        .isLength({ max: 100 })
        .withMessage('Name cannot exceed 100 characters'),

    body('description')
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage('Description cannot exceed 500 characters'),

    body('discountType')
        .isIn(['percentage', 'fixed_amount', 'free_shipping', 'buy_x_get_y'])
        .withMessage('Invalid discount type'),

    body('discountValue')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Discount value must be a positive number'),

    body('startDate')
        .notEmpty()
        .withMessage('Start date is required')
        .isISO8601()
        .withMessage('Invalid start date format'),

    body('endDate')
        .notEmpty()
        .withMessage('End date is required')
        .isISO8601()
        .withMessage('Invalid end date format'),

    body('usageLimit')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Usage limit must be at least 1'),

    body('usageLimitPerUser')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Usage limit per user must be at least 1'),

    body('minimumPurchaseAmount')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Minimum purchase amount must be positive'),
];

const updateCouponValidation = [
    body('code')
        .optional()
        .trim()
        .isLength({ min: 3, max: 50 })
        .withMessage('Coupon code must be between 3 and 50 characters'),

    body('name')
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage('Name cannot exceed 100 characters'),

    body('discountType')
        .optional()
        .isIn(['percentage', 'fixed_amount', 'free_shipping', 'buy_x_get_y'])
        .withMessage('Invalid discount type'),

    body('discountValue')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Discount value must be positive'),
];

const validateCouponValidation = [
    body('code')
        .trim()
        .notEmpty()
        .withMessage('Coupon code is required'),

    body('cartData')
        .optional()
        .isObject()
        .withMessage('Cart data must be an object'),
];

const bulkCreateValidation = [
    body('template')
        .isObject()
        .withMessage('Template is required'),

    body('count')
        .isInt({ min: 1, max: 1000 })
        .withMessage('Count must be between 1 and 1000'),
];

const mongoIdValidation = [
    param('id').isMongoId().withMessage('Invalid coupon ID'),
];

// ============================================================
// PUBLIC ROUTES
// ============================================================

/**
 * Validate coupon (can be used by guests)
 * @route POST /api/coupons/validate
 */
router.post(
    '/validate',
    validateCouponValidation,
    validate,
    couponController.validateCoupon
);

/**
 * Get coupon by code (public for frontend to display details)
 * @route GET /api/coupons/code/:code
 */
router.get(
    '/code/:code',
    param('code').notEmpty().withMessage('Coupon code is required'),
    validate,
    couponController.getCouponByCode
);

// ============================================================
// PROTECTED ROUTES (Authenticated Users)
// ============================================================

/**
 * Get auto-apply coupons
 * @route POST /api/coupons/auto-apply
 */
router.post(
    '/auto-apply',
    optionalProtect,
    body('cartData').isObject().withMessage('Cart data is required'),
    validate,
    couponController.getAutoApplyCoupons
);

router.use(protect);

/**
 * Apply coupon to order
 * @route POST /api/coupons/apply
 */
router.post(
    '/apply',
    body('code').notEmpty().withMessage('Coupon code is required'),
    body('orderData').isObject().withMessage('Order data is required'),
    validate,
    couponController.applyCoupon
);



/**
 * Get active coupons for customer
 * @route GET /api/coupons/customer/active
 */
router.get('/customer/active', couponController.getActiveCouponsForCustomer);

/**
 * Get my coupon usage history
 * @route GET /api/coupons/my-usage
 */
router.get('/my-usage', couponController.getMyCouponUsage);

/**
 * Check if can use specific coupon
 * @route GET /api/coupons/:code/can-use
 */
router.get(
    '/:code/can-use',
    param('code').notEmpty(),
    validate,
    couponController.canUseCoupon
);

// ============================================================
// ADMIN ROUTES
// ============================================================

router.use(authorize('admin', 'super_admin', 'tenant_admin'));

/**
 * Get all coupons
 * @route GET /api/coupons
 */
router.get('/', couponController.getAllCoupons);

/**
 * Get coupon statistics
 * @route GET /api/coupons/stats/summary
 */
router.get('/stats/summary', couponController.getCouponStatistics);

/**
 * Export coupons
 * @route GET /api/coupons/export
 */
router.get('/export', couponController.exportCoupons);

/**
 * Generate coupon code
 * @route POST /api/coupons/generate-code
 */
router.post('/generate-code', couponController.generateCouponCode);

/**
 * Bulk create coupons
 * @route POST /api/coupons/bulk-create
 */
router.post(
    '/bulk-create',
    bulkCreateValidation,
    validate,
    couponController.bulkCreateCoupons
);

/**
 * Update scheduled coupons (cron job)
 * @route POST /api/coupons/cron/update-scheduled
 */
router.post('/cron/update-scheduled', couponController.updateScheduledCoupons);

/**
 * Create coupon
 * @route POST /api/coupons
 */
router.post(
    '/',
    createCouponValidation,
    validate,
    couponController.createCoupon
);

/**
 * Get coupon by ID
 * @route GET /api/coupons/:id
 */
router.get(
    '/:id',
    mongoIdValidation,
    validate,
    couponController.getCouponById
);

/**
 * Update coupon
 * @route PUT /api/coupons/:id
 */
router.put(
    '/:id',
    mongoIdValidation,
    updateCouponValidation,
    validate,
    couponController.updateCoupon
);

/**
 * Delete coupon
 * @route DELETE /api/coupons/:id
 */
router.delete(
    '/:id',
    mongoIdValidation,
    validate,
    couponController.deleteCoupon
);

/**
 * Toggle coupon status
 * @route PATCH /api/coupons/:id/toggle-status
 */
router.patch(
    '/:id/toggle-status',
    mongoIdValidation,
    validate,
    couponController.toggleCouponStatus
);

/**
 * Get coupon analytics
 * @route GET /api/coupons/:id/analytics
 */
router.get(
    '/:id/analytics',
    mongoIdValidation,
    validate,
    couponController.getCouponAnalytics
);

/**
 * Record coupon usage
 * @route POST /api/coupons/:id/record-usage
 */
router.post(
    '/:id/record-usage',
    mongoIdValidation,
    body('userId').isMongoId(),
    body('orderAmount').isFloat({ min: 0 }),
    body('discountApplied').isFloat({ min: 0 }),
    body('orderId').isMongoId(),
    validate,
    couponController.recordCouponUsage
);

/**
 * Clone coupon
 * @route POST /api/coupons/:id/clone
 */
router.post(
    '/:id/clone',
    mongoIdValidation,
    validate,
    couponController.cloneCoupon
);

module.exports = router;