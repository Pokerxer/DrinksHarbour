// controllers/payment.controller.js

const crypto = require('crypto');
const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/response');
const paymentService = require('../services/payment.service');
const Order = require('../models/Order');

/**
 * @desc    Initialize Stripe payment (without order)
 * @route   POST /api/payments/stripe/initialize
 * @access  Private
 */
const initializeStripePayment = asyncHandler(async (req, res) => {
  const { amount, currency, metadata } = req.body;

  if (!amount) {
    return res.status(400).json({
      success: false,
      message: 'Amount is required',
    });
  }

  const paymentData = await require('../services/marketplacePaymentTrust').initialize('stripe', req.user, amount, currency || 'NGN', req.user.email, metadata, req.get('Idempotency-Key'));

  successResponse(res, paymentData, 'Stripe payment initialized successfully');
});

/**
 * @desc    Confirm Stripe payment
 * @route   POST /api/payments/stripe/confirm
 * @access  Private
 */
const confirmStripePayment = asyncHandler(async (req, res) => {
  const { paymentIntentId, clientSecret } = req.body;

  if (!paymentIntentId && !clientSecret) {
    return res.status(400).json({
      success: false,
      message: 'Payment intent ID or client secret is required',
    });
  }

  const id = paymentIntentId || clientSecret.split('_secret_')[0];
  await require('../services/marketplacePaymentReads').authorize('stripe', id, req.user);
  const result = await paymentService.confirmStripePayment(id);

  if (result.success) {
    successResponse(res, result, 'Payment confirmed successfully');
  } else if (result.status === 'requires_action') {
    res.status(200).json({
      success: true,
      requiresAction: true,
      clientSecret: result.clientSecret,
      message: 'Additional authentication required',
    });
  } else {
    res.status(400).json({
      success: false,
      message: result.message || 'Payment failed',
    });
  }
});

/**
 * @desc    Attach payment to order
 * @route   POST /api/payments/attach-to-order
 * @access  Private
 */
const attachPaymentToOrder = asyncHandler(async (req, res) => {
  const { orderId, paymentData } = req.body;

  if (!orderId || !paymentData) {
    return res.status(400).json({
      success: false,
      message: 'Order ID and payment data are required',
    });
  }

  const order = await paymentService.attachPaymentToOrder(orderId, paymentData, req.user);
  successResponse(res, { order: require('../services/orderAccess').project(order, req.user) }, 'Payment attached to order successfully');
});

/**
 * @desc    Initialize Paystack payment (without order)
 * @route   POST /api/payments/paystack/initialize
 * @access  Private
 */
const initializePaystackPayment = asyncHandler(async (req, res) => {
  const { amount, email, metadata } = req.body;

  if (!amount || !email) {
    return res.status(400).json({
      success: false,
      message: 'Amount and email are required',
    });
  }

  const paymentData = await require('../services/marketplacePaymentTrust').initialize('paystack', req.user, amount, 'NGN', email, metadata, req.get('Idempotency-Key'));

  successResponse(res, paymentData, 'Paystack payment initialized successfully');
});

/**
 * @desc    Verify Paystack payment
 * @route   GET /api/payments/paystack/verify/:reference
 * @access  Public
 */
const verifyPaystackPayment = asyncHandler(async (req, res) => {
  const { reference } = req.params;

  if (!reference) {
    return res.status(400).json({
      success: false,
      message: 'Reference is required',
    });
  }

  await require('../services/marketplacePaymentReads').authorize('paystack', reference, req.user);
  const result = await paymentService.verifyPaystackTransaction(reference);

  if (result.success) {
    successResponse(res, require('../services/marketplacePaymentReads').publicReceipt(result.data), 'Payment verified successfully');
  } else {
    res.status(400).json({
      success: false,
      message: result.message || 'Payment verification failed',
    });
  }
});

/**
 * @desc    Initialize Korapay payment (without order)
 * @route   POST /api/payments/korapay/initialize
 * @access  Private
 */
const initializeKorapayPayment = asyncHandler(async (req, res) => {
  const { amount, email, metadata } = req.body;

  if (!amount || !email) {
    return res.status(400).json({
      success: false,
      message: 'Amount and email are required',
    });
  }

  const paymentData = await require('../services/marketplacePaymentTrust').initialize('korapay', req.user, amount, 'NGN', email, metadata, req.get('Idempotency-Key'));

  successResponse(res, paymentData, 'Korapay payment initialized successfully');
});

/**
 * @desc    Verify Korapay payment
 * @route   GET /api/payments/korapay/verify/:reference
 * @access  Public
 */
const verifyKorapayPayment = asyncHandler(async (req, res) => {
  const { reference } = req.params;

  if (!reference) {
    return res.status(400).json({
      success: false,
      message: 'Reference is required',
    });
  }

  await require('../services/marketplacePaymentReads').authorize('korapay', reference, req.user);
  const result = await paymentService.verifyKorapayCharge(reference);

  if (result.success) {
    successResponse(res, require('../services/marketplacePaymentReads').publicReceipt(result.data), 'Payment verified successfully');
  } else {
    res.status(400).json({
      success: false,
      message: result.message || 'Payment verification failed',
    });
  }
});

/**
 * @desc    Get payment status
 * @route   GET /api/payments/status/:orderId
 * @access  Private
 */
const getPaymentStatus = asyncHandler(async (req, res) => {
  const { orderId } = req.params;

  const status = await paymentService.getPaymentStatus(orderId, req.user);

  successResponse(res, status, 'Payment status retrieved successfully');
});

/**
 * @desc    Create refund (Stripe only)
 * @route   POST /api/payments/refund
 * @access  Private/Admin
 */
const createRefund = asyncHandler(async (req, res) => {
  const { orderId, amount } = req.body;

  if (!orderId) {
    return res.status(400).json({
      success: false,
      message: 'Order ID is required',
    });
  }

  const result = await paymentService.createStripeRefund(orderId, amount, req.user);

  if (result.success) {
    successResponse(res, result, 'Refund processed successfully');
  } else {
    res.status(400).json({
      success: false,
      message: 'Refund failed',
      status: result.status,
    });
  }
});

/**
 * @desc    Stripe webhook handler
 * @route   POST /api/payments/webhooks/stripe
 * @access  Public
 */
const handleStripeWebhook = asyncHandler(async (req, res) => {
  let stripe;
  try {
    stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  } catch {
    return res.status(500).json({ success: false, message: 'Stripe not configured' });
  }

  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error(`Stripe webhook error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'payment_intent.succeeded') await require('../services/marketplaceWebhook').settle('stripe', event.data.object.id);

  res.json({ received: true });
});

/**
 * @desc    Paystack webhook handler
 * @route   POST /api/payments/webhooks/paystack
 * @access  Public
 */
const handlePaystackWebhook = asyncHandler(async (req, res) => {
  const webhook = require('../services/paystackWebhook');
  if (!process.env.PAYSTACK_SECRET_KEY) return res.sendStatus(503);
  if (!webhook.validSignature(req.rawBody, req.headers['x-paystack-signature'], process.env.PAYSTACK_SECRET_KEY)) {
    return res.status(401).json({ success: false, message: 'Invalid webhook signature' });
  }
  // Processing failures must reach Paystack so it retries; acknowledge only
  // after settlement commits. The signed bytes come from the global parser.
  await webhook.processEvent(req.body);
  res.json({ received: true });
});

/**
 * @desc    Korapay webhook handler
 * @route   POST /api/payments/webhooks/korapay
 * @access  Public
 */
const handleKorapayWebhook = asyncHandler(async (req, res) => {
  if (!process.env.KORAPAY_SECRET_KEY) return res.sendStatus(503);
  const expected = crypto.createHmac('sha256', process.env.KORAPAY_SECRET_KEY).update(JSON.stringify(req.body?.data || {})).digest('hex');
  const signature = req.headers['x-korapay-signature'];
  if (typeof signature !== 'string' || !/^[a-f0-9]{64}$/i.test(signature) || !crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'))) {
    return res.status(401).json({ success: false, message: 'Invalid webhook signature' });
  }
  if (req.body.event === 'charge.success') await require('../services/marketplaceWebhook').settle('korapay', req.body.data?.reference);
  res.json({ received: true });
});

module.exports = {
  initializeStripePayment,
  confirmStripePayment,
  attachPaymentToOrder,
  initializePaystackPayment,
  verifyPaystackPayment,
  initializeKorapayPayment,
  verifyKorapayPayment,
  getPaymentStatus,
  createRefund,
  handleStripeWebhook,
  handlePaystackWebhook,
  handleKorapayWebhook,
};
