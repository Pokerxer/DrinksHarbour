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
    successResponse(res, result.data, 'Payment verified successfully');
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

  const paymentData = await paymentService.createKorapayCharge(
    amount,
    email,
    metadata
  );

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

  const result = await paymentService.verifyKorapayCharge(reference);

  if (result.success) {
    successResponse(res, result.data, 'Payment verified successfully');
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

  switch (event.type) {
    case 'payment_intent.succeeded': {
      const pi = event.data.object;
      console.log('[Stripe] payment_intent.succeeded:', pi.id);
      try {
        // Find order by stripePaymentIntentId or paymentIntentId
        const order = await Order.findOne({
          $or: [{ stripePaymentIntentId: pi.id }, { paymentIntentId: pi.id }],
        });
        if (order) {
          if (order.paymentStatus !== 'paid') {
            await paymentService.attachPaymentToOrder(order._id.toString(), {
              method: 'stripe',
              transactionId: pi.id,
              amount: pi.amount / 100,
              currency: pi.currency,
              paidAt: new Date(),
            });
            console.log(`[Stripe] Order ${order.orderNumber} marked as paid via webhook`);
          }
        } else {
          console.warn(`[Stripe] No order found for paymentIntent ${pi.id}`);
        }
      } catch (err) {
        console.error('[Stripe] Failed to process payment_intent.succeeded webhook:', err.message);
      }
      break;
    }
    case 'payment_intent.payment_failed': {
      const pi = event.data.object;
      console.error('[Stripe] payment_intent.payment_failed:', pi.last_payment_error?.message);
      try {
        const order = await Order.findOne({
          $or: [{ stripePaymentIntentId: pi.id }, { paymentIntentId: pi.id }],
        });
        if (order && order.paymentStatus === 'pending') {
          order.paymentStatus = 'failed';
          await order.save();
          console.log(`[Stripe] Order ${order.orderNumber} payment marked failed via webhook`);
        }
      } catch (err) {
        console.error('[Stripe] Failed to process payment_intent.payment_failed webhook:', err.message);
      }
      break;
    }
    default:
      console.log(`[Stripe] Unhandled event: ${event.type}`);
  }

  res.json({ received: true });
});

/**
 * @desc    Paystack webhook handler
 * @route   POST /api/payments/webhooks/paystack
 * @access  Public
 */
const handlePaystackWebhook = asyncHandler(async (req, res) => {
  // Always respond 200 immediately so Paystack doesn't retry
  res.sendStatus(200);

  if (!process.env.PAYSTACK_SECRET_KEY) return;

  const hash = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (hash !== req.headers['x-paystack-signature']) {
    console.warn('[Paystack] Webhook signature mismatch — ignoring');
    return;
  }

  const event = req.body;

  switch (event.event) {
    case 'charge.success': {
      const data = event.data || {};
      const ref = data.reference;
      console.log(`[Paystack] charge.success — ref: ${ref}, amount: ₦${(data.amount || 0) / 100}`);
      // Safety net: if the frontend redirect already created/updated the order, this is a no-op.
      // If the redirect failed (e.g. user closed browser), this webhook marks the order as paid.
      try {
        const order = await Order.findOne({ paymentReference: ref });
        if (order) {
          if (order.paymentStatus !== 'paid') {
            await paymentService.attachPaymentToOrder(order._id.toString(), {
              method: 'paystack',
              transactionId: String(data.id || ''),
              reference: ref,
              amount: (data.amount || 0) / 100,
              currency: (data.currency || 'NGN').toUpperCase(),
              paidAt: data.paid_at ? new Date(data.paid_at) : new Date(),
              channel: data.channel,
            });
            console.log(`[Paystack] Order ${order.orderNumber} marked as paid via webhook`);
          } else {
            console.log(`[Paystack] Order ${order.orderNumber} already paid — webhook skipped`);
          }
        } else {
          console.warn(`[Paystack] No order found for reference ${ref} — may be created by frontend redirect`);
        }
      } catch (err) {
        console.error('[Paystack] Failed to process charge.success webhook:', err.message);
      }
      break;
    }
    case 'charge.failed':
      console.error('[Paystack] charge.failed:', event.data?.reference, event.data?.gateway_response);
      break;
    default:
      console.log(`[Paystack] Unhandled event: ${event.event}`);
  }
});

/**
 * @desc    Korapay webhook handler
 * @route   POST /api/payments/webhooks/korapay
 * @access  Public
 */
const handleKorapayWebhook = asyncHandler(async (req, res) => {
  // Always respond 200 immediately so Korapay doesn't retry
  res.sendStatus(200);

  if (!process.env.KORAPAY_SECRET_KEY) return;

  // Korapay signs ONLY the `data` object of the payload (not the full body)
  const hash = crypto
    .createHmac('sha256', process.env.KORAPAY_SECRET_KEY)
    .update(JSON.stringify(req.body?.data || {}))
    .digest('hex');

  if (hash !== req.headers['x-korapay-signature']) {
    console.warn('[Korapay] Webhook signature mismatch — ignoring');
    return;
  }

  const event = req.body;

  switch (event.event) {
    case 'charge.success': {
      const data = event.data || {};
      const ref = data.reference;
      console.log(`[Korapay] charge.success — ref: ${ref}, amount: ₦${data.amount || 0}`);
      // Safety net: if the frontend redirect already created/updated the order, this is a no-op.
      // If the redirect failed (e.g. user closed browser), this webhook marks the order as paid.
      try {
        const order = await Order.findOne({ paymentReference: ref });
        if (order) {
          if (order.paymentStatus !== 'paid') {
            await paymentService.attachPaymentToOrder(order._id.toString(), {
              method: 'korapay',
              transactionId: String(data.payment_reference || ref),
              reference: ref,
              // Korapay webhook amounts are in major units already
              amount: Number(data.amount || 0),
              currency: (data.currency || 'NGN').toUpperCase(),
              paidAt: data.transaction_date ? new Date(data.transaction_date) : new Date(),
              channel: data.payment_method,
            });
            console.log(`[Korapay] Order ${order.orderNumber} marked as paid via webhook`);
          } else {
            console.log(`[Korapay] Order ${order.orderNumber} already paid — webhook skipped`);
          }
        } else {
          console.warn(`[Korapay] No order found for reference ${ref} — may be created by frontend redirect`);
        }
      } catch (err) {
        console.error('[Korapay] Failed to process charge.success webhook:', err.message);
      }
      break;
    }
    case 'charge.failed':
      console.error('[Korapay] charge.failed:', event.data?.reference, event.data?.status);
      break;
    default:
      console.log(`[Korapay] Unhandled event: ${event.event}`);
  }
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
