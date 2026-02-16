// routes/order.routes.js

const express = require('express');
const router = express.Router();
const orderController = require('../controllers/order.controller');
const { protect, optionalProtect } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validation.middleware');
const { body, param, query } = require('express-validator');

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
  body('paymentMethod')
    .isIn(['card', 'bank', 'cod', 'bank_transfer', 'mobile_money', 'cash_on_delivery', 'wallet'])
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
];

router.post(
  '/',
  optionalProtect,
  createOrderValidation,
  validate,
  orderController.createOrder
);

router.get(
  '/number/:orderNumber',
  param('orderNumber').notEmpty(),
  query('email').optional().isEmail(),
  validate,
  orderController.getOrderByNumber
);

router.use(protect);

router.get('/my-orders', orderController.getMyOrders);

router.get(
  '/:id',
  optionalProtect,
  param('id').isMongoId(),
  validate,
  orderController.getOrder
);

router.post(
  '/:id/cancel',
  param('id').isMongoId(),
  body('reason').optional().trim(),
  validate,
  orderController.cancelOrder
);

module.exports = router;
