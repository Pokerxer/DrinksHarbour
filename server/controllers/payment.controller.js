// controllers/payment.controller.js

const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/response');
const paymentService = require('../services/payment.service');

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

  const paymentData = await paymentService.createStripePaymentIntent(
    amount,
    currency || 'ngn',
    metadata
  );

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

  const order = await paymentService.attachPaymentToOrder(orderId, paymentData);

  successResponse(res, { order }, 'Payment attached to order successfully');
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

  const paymentData = await paymentService.createPaystackTransaction(
    amount,
    email,
    metadata
  );

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

  const result = await paymentService.verifyPaystackTransaction(reference);

  if (result.success) {
    successResponse(res, result, 'Payment verified successfully');
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

  const status = await paymentService.getPaymentStatus(orderId);

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

  const result = await paymentService.createStripeRefund(orderId, amount);

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
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.log(`Webhook Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      console.log('PaymentIntent was successful!');
      // Payment succeeded - order will be created on frontend after confirmation
      break;

    case 'payment_intent.payment_failed':
      const failedPayment = event.data.object;
      console.log('Payment failed:', failedPayment.last_payment_error?.message);
      break;

    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
});

/**
 * @desc    Paystack webhook handler
 * @route   POST /api/payments/webhooks/paystack
 * @access  Public
 */
const handlePaystackWebhook = asyncHandler(async (req, res) => {
  const hash = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (hash === req.headers['x-paystack-signature']) {
    const event = req.body;

    // Handle the event
    switch (event.event) {
      case 'charge.success':
        console.log('Paystack payment successful!');
        // Payment succeeded - order will be created on frontend after redirect
        break;

      case 'charge.failed':
        console.log('Paystack payment failed:', event.data);
        break;

      default:
        console.log(`Unhandled Paystack event type ${event.event}`);
    }
  }

  res.sendStatus(200);
});

module.exports = {
  initializeStripePayment,
  confirmStripePayment,
  attachPaymentToOrder,
  initializePaystackPayment,
  verifyPaystackPayment,
  getPaymentStatus,
  createRefund,
  handleStripeWebhook,
  handlePaystackWebhook,
};
