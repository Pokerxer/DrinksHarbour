// routes/order.routes.js

const express = require('express');
const router = express.Router();
router.use((req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
const orderController = require('../controllers/order.controller');
const posController   = require('../controllers/pos.controller');
const { protect, optionalProtect, attachTenant, superAdminOnly, tenantAdminOrSuperAdmin } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validation.middleware');
const { body, param, query, validationResult } = require('express-validator');
const { ACCEPTED_PAYMENT_METHODS } = require('../utils/paymentMethods');
const { assertRequestedDeliveryDate } = require('../config/giftPackaging');
const { ValidationError } = require('../utils/errors');

const createOrderValidation = [
  body('customer.firstName')
    .trim()
    .notEmpty()
    .withMessage('First name is required')
    .isLength({ max: 50 }),
  body('customer.lastName')
    .trim()
    .notEmpty()
    .withMessage('Last name is required')
    .isLength({ max: 50 }),
  body('customer.email')
    .isEmail()
    .withMessage('Please provide a valid email'),
  body('customer.phone')
    .trim()
    .notEmpty()
    .withMessage('Phone number is required'),
  body('shipping.address')
    .trim()
    .notEmpty()
    .withMessage('Address is required'),
  body('shipping.city')
    .trim()
    .notEmpty()
    .withMessage('City is required'),
  body('shipping.state')
    .trim()
    .notEmpty()
    .withMessage('State is required'),
  body('shipping.zipCode')
    .trim()
    .notEmpty()
    .withMessage('ZIP code is required'),
  body('shipping.country')
    .trim()
    .notEmpty()
    .withMessage('Country is required'),
  // Accepted spellings and the storable enum both come from utils/paymentMethods;
  // the controller folds aliases to a canonical value before saving.
  body('paymentMethod')
    .customSanitizer((v) => (typeof v === 'string' ? v.trim().toLowerCase() : v))
    .isIn(ACCEPTED_PAYMENT_METHODS)
    .withMessage('Invalid payment method'),
  body('items')
    .isArray({ min: 1 })
    .withMessage('At least one item is required'),
  body('items.*.productId')
    .notEmpty()
    .withMessage('Product ID is required'),
  body('items.*.quantity')
    .isInt({ min: 1 })
    .withMessage('Quantity must be at least 1'),
  body('items.*.price')
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),
  body('subtotal')
    .isFloat({ min: 0 })
    .withMessage('Subtotal must be a positive number'),
  body('total')
    .isFloat({ min: 0 })
    .withMessage('Total must be a positive number'),
  // ── Gift checkout (order-level, optional) ─────────────────────────────────
  // Contract: docs/superpowers/specs/2026-10-27-gift-checkout-design.md. The
  // whole block is optional; when `gift` is present, the full contract applies.
  // The requested delivery date is a plan the team confirms — never a
  // guaranteed date, so bounds are enforced but nothing more is promised.
  body('gift')
    .optional()
    .isObject()
    .withMessage('Gift must be an object'),
  body('gift.isGift')
    .if(body('gift').exists())
    .custom((value) => value === true)
    .withMessage('isGift must be true when the gift block is present'),
  body('gift.from')
    .if(body('gift').exists())
    .isString()
    .withMessage('Gift "from" must be text')
    .trim()
    .isLength({ min: 1, max: 80 })
    .withMessage('Gift "from" must be between 1 and 80 characters'),
  body('gift.to')
    .if(body('gift').exists())
    .isString()
    .withMessage('Gift "to" must be text')
    .trim()
    .isLength({ min: 1, max: 80 })
    .withMessage('Gift "to" must be between 1 and 80 characters'),
  body('gift.message')
    .if(body('gift').exists())
    .optional({ checkFalsy: true })
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Gift message cannot exceed 500 characters'),
  body('gift.requestedDeliveryDate')
    .if(body('gift').exists())
    .custom((value) => assertRequestedDeliveryDate(value))
    .withMessage('Requested delivery date is invalid'),
  body('gift.packagingRequested')
    .if(body('gift').exists())
    .isBoolean()
    .withMessage('packagingRequested must be a boolean'),
];

// validation.middleware's `validate` is a passthrough when mounted directly
// (it only works in factory mode, which no route uses), so express-validator
// records errors on req but nothing enforces them. Rather than flip the global
// gate for the whole checkout contract — a behavior change far beyond gift
// checkout — the gift rules get their own gate: only errors recorded against
// gift paths reject the request. Contract:
// docs/superpowers/specs/2026-10-27-gift-checkout-design.md
const enforceGiftValidation = (req, res, next) => {
  const errors = validationResult(req).array().filter(e =>
    e.path === 'gift' || String(e.path || '').startsWith('gift.')
  );
  if (errors.length) {
    return next(new ValidationError(errors.map(e => e.msg).join(', ')));
  }
  next();
};

router.post(
  '/',
  optionalProtect,
  createOrderValidation,
  validate,
  enforceGiftValidation,
  require('../services/marketContext').handler(orderController.createOrder)
);

// Order-number lookup uses authenticated ownership; an entered email grants no access.
router.get(
  '/number/:orderNumber',
  protect,
  attachTenant,
  param('orderNumber').notEmpty(),
  query('email').optional().isEmail(),
  validate,
  orderController.getOrderByNumber
);

router.get('/my-orders', protect, attachTenant, orderController.getMyOrders);

router.get(
  '/:id',
  optionalProtect,
  param('id').isMongoId(),
  validate,
  orderController.getOrder
);

router.use(protect);
router.use(attachTenant);

// Admin: list all orders
router.get('/', tenantAdminOrSuperAdmin, orderController.getAllOrders);

// Lookup by receipt number (POS orders)
router.get('/receipt/:receiptNumber', tenantAdminOrSuperAdmin, orderController.getOrderByReceipt);




router.post(
  '/:id/cancel',
  param('id').isMongoId(),
  body('reason').optional().trim(),
  validate,
  orderController.cancelOrder
);

router.put(
  '/:id/payment',
  tenantAdminOrSuperAdmin,
  param('id').isMongoId(),
  body('action')
    .isIn(['mark_paid', 'mark_failed', 'mark_refunded'])
    .withMessage('Invalid action'),
  body('reference').optional().trim(),
  body('notes').optional().trim(),
  body('amount').optional().isFloat({ min: 0 }),
  validate,
  orderController.updatePaymentStatus
);

// Admin-initiated POS order refund (uses regular admin JWT, not POS token)
router.post(
  '/:id/pos-refund',
  tenantAdminOrSuperAdmin,
  param('id').isMongoId(),
  validate,
  posController.refundPOSOrder
);

// Order status update — restricted to tenant admin or super admin (was open to any authenticated user)
router.put(
  '/:id/status',
  tenantAdminOrSuperAdmin,
  param('id').isMongoId(),
  body('status')
    .isIn(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'])
    .withMessage('Invalid status'),
  body('reason').optional().trim(),
  validate,
  orderController.updateOrderStatus
);

module.exports = router;
