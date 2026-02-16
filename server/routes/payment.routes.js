// routes/payment.routes.js

const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');
const { protect } = require('../middleware/auth.middleware');

// Stripe routes
router.post('/stripe/initialize', protect, paymentController.initializeStripePayment);
router.post('/stripe/confirm', protect, paymentController.confirmStripePayment);

// Paystack routes
router.post('/paystack/initialize', protect, paymentController.initializePaystackPayment);
router.get('/paystack/verify/:reference', paymentController.verifyPaystackPayment);

// General routes
router.post('/attach-to-order', protect, paymentController.attachPaymentToOrder);
router.get('/status/:orderId', protect, paymentController.getPaymentStatus);
router.post('/refund', protect, paymentController.createRefund);

// Webhooks (must be raw body for signature verification)
router.post(
  '/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  paymentController.handleStripeWebhook
);

router.post(
  '/webhooks/paystack',
  express.json(),
  paymentController.handlePaystackWebhook
);

module.exports = router;
