// services/payment.service.js

let stripe;
try {
  stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
} catch (e) {
  console.warn('Stripe key not found, payment service will be disabled.');
  stripe = null;
}

const axios = require('axios');
const crypto = require('crypto');
const Order = require('../models/Order');
const { ValidationError, NotFoundError } = require('../utils/errors');

const PAYSTACK_BASE_URL = 'https://api.paystack.co';
const KORAPAY_BASE_URL = 'https://api.korapay.com/merchant/api/v1';

// Which gateway customer-facing payments (checkout, wallet fund, gift cards) go
// through. Paystack stays available behind this flag for when it's re-enabled.
const ACTIVE_GATEWAY = (process.env.PAYMENT_GATEWAY || 'korapay').toLowerCase();

/**
 * Initialize Stripe payment intent (without order)
 */
const createStripePaymentIntent = async (amount, currency = 'ngn', metadata = {}) => {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }
  try {
    // Create payment intent without order association
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents/kobo
      currency: currency.toLowerCase(),
      metadata: {
        ...metadata,
        createdAt: new Date().toISOString(),
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: amount,
      currency: currency,
    };
  } catch (error) {
    console.error('Stripe payment intent error:', error);
    throw new ValidationError(error.message || 'Failed to create payment intent');
  }
};

/**
 * Confirm Stripe payment and create/update order
 */
const confirmStripePayment = async (paymentIntentId) => {
  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status === 'succeeded') {
      return {
        success: true,
        status: 'succeeded',
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency,
        metadata: paymentIntent.metadata,
      };
    } else if (paymentIntent.status === 'requires_action' || paymentIntent.status === 'requires_confirmation') {
      return {
        success: false,
        status: 'requires_action',
        clientSecret: paymentIntent.client_secret,
      };
    } else {
      return {
        success: false,
        status: 'failed',
        message: paymentIntent.last_payment_error?.message || 'Payment failed',
      };
    }
  } catch (error) {
    console.error('Stripe confirm payment error:', error);
    throw new ValidationError(error.message || 'Failed to confirm payment');
  }
};

/**
 * Attach payment to order after successful payment
 */
const attachPaymentToOrder = async (orderId, paymentData) => {
  try {
    const order = await Order.findById(orderId);
    if (!order) {
      throw new NotFoundError('Order not found');
    }

    order.paymentStatus = 'paid';
    order.status = 'confirmed';
    order.paidAt = new Date();
    order.paymentDetails = paymentData;
    
    if (paymentData.transactionId) {
      order.paymentIntentId = paymentData.transactionId;
    }

    await order.save();

    return order;
  } catch (error) {
    console.error('Attach payment to order error:', error);
    throw new ValidationError(error.message || 'Failed to attach payment to order');
  }
};

/**
 * Initialize Paystack transaction (without order).
 *
 * @param {number} amount   Amount in major units (NGN).
 * @param {string} email    Customer email.
 * @param {object} metadata Arbitrary metadata forwarded to Paystack.
 * @param {object} [options]
 * @param {string} [options.reference]   Force Paystack to use OUR reference so the
 *   callback + verify echo the same value (wallet/gift-card funding rely on this).
 * @param {string} [options.callbackUrl] Where Paystack redirects after payment.
 *   Defaults to the cart flow's /payment/verify page.
 *
 * NOTE: Paystack honours the callback_url set HERE at initialization time. Appending
 * a callback_url query param to the returned checkout URL has no effect, so callers
 * that need a different return page MUST pass options.callbackUrl.
 */
const createPaystackTransaction = async (amount, email, metadata = {}, options = {}) => {
  try {
    const payload = {
      email: email,
      amount: Math.round(amount * 100), // Paystack uses kobo
      metadata: {
        ...metadata,
        createdAt: new Date().toISOString(),
      },
      callback_url:
        options.callbackUrl ||
        `${process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3002'}/payment/verify`,
    };
    if (options.reference) payload.reference = options.reference;

    const response = await axios.post(
      `${PAYSTACK_BASE_URL}/transaction/initialize`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.data.status) {
      return {
        authorizationUrl: response.data.data.authorization_url,
        accessCode: response.data.data.access_code,
        reference: response.data.data.reference,
        amount: amount,
      };
    } else {
      throw new ValidationError(response.data.message || 'Failed to initialize payment');
    }
  } catch (error) {
    console.error('Paystack initialize error:', error.response?.data || error.message);
    throw new ValidationError(error.response?.data?.message || error.message || 'Failed to initialize Paystack payment');
  }
};

/**
 * Verify Paystack transaction
 */
const verifyPaystackTransaction = async (reference) => {
  try {
    const response = await axios.get(
      `${PAYSTACK_BASE_URL}/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    if (response.data.status) {
      const { data } = response.data;

      if (data.status === 'success') {
        return {
          success: true,
          status: 'paid',
          data: {
            reference: data.reference,
            transactionId: data.id,
            amount: data.amount / 100,
            currency: data.currency,
            paidAt: data.paid_at,
            channel: data.channel,
            metadata: data.metadata,
          },
        };
      } else {
        return {
          success: false,
          status: 'failed',
          message: `Payment ${data.status}`,
        };
      }
    } else {
      throw new ValidationError(response.data.message || 'Verification failed');
    }
  } catch (error) {
    console.error('Paystack verify error:', error.response?.data || error.message);
    throw new ValidationError(error.response?.data?.message || error.message || 'Failed to verify payment');
  }
};

/**
 * Initialize Korapay charge (without order).
 *
 * Same call signature and return shape as createPaystackTransaction so callers
 * (checkout, wallet funding, gift cards) can switch gateways transparently.
 *
 * @param {number} amount   Amount in major units (NGN) — Korapay takes naira, not kobo.
 * @param {string} email    Customer email.
 * @param {object} metadata Arbitrary metadata stored on the charge.
 * @param {object} [options]
 * @param {string} [options.reference]   Merchant reference. Korapay REQUIRES one at
 *   init time (unlike Paystack where it's optional), so we generate one if absent.
 * @param {string} [options.callbackUrl] Where Korapay redirects after payment
 *   (?reference=<ref> is appended). Defaults to the cart flow's /payment/verify page.
 */
const createKorapayCharge = async (amount, email, metadata = {}, options = {}) => {
  try {
    const reference =
      options.reference || `DH-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

    const payload = {
      amount: Math.round(amount),
      currency: 'NGN',
      reference,
      narration: metadata.kind === 'wallet_fund'
        ? 'DrinksHarbour wallet funding'
        : metadata.kind === 'gift_card_purchase'
          ? 'DrinksHarbour gift card'
          : 'DrinksHarbour order payment',
      customer: {
        email,
        ...(metadata.customerName ? { name: metadata.customerName } : {}),
      },
      metadata: {
        ...metadata,
        createdAt: new Date().toISOString(),
      },
      // Without an explicit list Korapay only offers the card channel, whose
      // per-transaction limit is too low for premium-liquor carts (error AA021).
      // bank_transfer carries a much higher limit.
      channels: ['card', 'bank_transfer'],
      redirect_url:
        options.callbackUrl ||
        `${process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3002'}/payment/verify`,
    };

    const response = await axios.post(`${KORAPAY_BASE_URL}/charges/initialize`, payload, {
      headers: {
        Authorization: `Bearer ${process.env.KORAPAY_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.data.status) {
      return {
        authorizationUrl: response.data.data.checkout_url,
        accessCode: null, // Korapay has no access-code concept; kept for shape parity
        reference: response.data.data.reference || reference,
        amount: amount,
      };
    } else {
      throw new ValidationError(response.data.message || 'Failed to initialize payment');
    }
  } catch (error) {
    console.error('Korapay initialize error:', error.response?.data || error.message);
    throw new ValidationError(error.response?.data?.message || error.message || 'Failed to initialize Korapay payment');
  }
};

/**
 * Verify Korapay charge. Same return shape as verifyPaystackTransaction.
 */
const verifyKorapayCharge = async (reference) => {
  try {
    const response = await axios.get(`${KORAPAY_BASE_URL}/charges/${reference}`, {
      headers: {
        Authorization: `Bearer ${process.env.KORAPAY_SECRET_KEY}`,
      },
    });

    if (response.data.status) {
      const { data } = response.data;

      if (data.status === 'success') {
        return {
          success: true,
          status: 'paid',
          data: {
            reference: data.reference,
            transactionId: data.payment_reference || data.reference,
            // Korapay amounts are already in major units (naira)
            amount: Number(data.amount_paid ?? data.amount),
            currency: data.currency,
            paidAt: data.transaction_date || data.completed_at || new Date().toISOString(),
            channel: data.payment_method || data.channel,
            metadata: data.metadata,
          },
        };
      } else {
        return {
          success: false,
          status: 'failed',
          message: `Payment ${data.status}`,
        };
      }
    } else {
      throw new ValidationError(response.data.message || 'Verification failed');
    }
  } catch (error) {
    console.error('Korapay verify error:', error.response?.data || error.message);
    throw new ValidationError(error.response?.data?.message || error.message || 'Failed to verify payment');
  }
};

/**
 * Gateway-generic entry points. Wallet funding, gift cards, and checkout call
 * these so the active gateway is a single-env-var switch (PAYMENT_GATEWAY).
 */
const createGatewayTransaction = (amount, email, metadata, options) =>
  ACTIVE_GATEWAY === 'paystack'
    ? createPaystackTransaction(amount, email, metadata, options)
    : createKorapayCharge(amount, email, metadata, options);

const verifyGatewayTransaction = (reference) =>
  ACTIVE_GATEWAY === 'paystack'
    ? verifyPaystackTransaction(reference)
    : verifyKorapayCharge(reference);

/**
 * Process refund (Stripe only)
 */
const createStripeRefund = async (orderId, amount = null) => {
  try {
    const order = await Order.findById(orderId);
    if (!order) {
      throw new NotFoundError('Order not found');
    }

    if (!order.paymentIntentId) {
      throw new ValidationError('No payment found for this order');
    }

    const refundData = {
      payment_intent: order.paymentIntentId,
    };

    if (amount) {
      refundData.amount = Math.round(amount * 100);
    }

    const refund = await stripe.refunds.create(refundData);

    if (refund.status === 'succeeded') {
      order.paymentStatus = amount ? 'partially_refunded' : 'refunded';
      order.refundDetails = {
        refundId: refund.id,
        amount: refund.amount / 100,
        reason: refund.reason,
        createdAt: new Date(),
      };
      await order.save();

      return {
        success: true,
        refundId: refund.id,
        amount: refund.amount / 100,
      };
    } else {
      return {
        success: false,
        status: refund.status,
      };
    }
  } catch (error) {
    console.error('Stripe refund error:', error);
    throw new ValidationError(error.message || 'Failed to process refund');
  }
};

/**
 * Get payment status
 */
const getPaymentStatus = async (orderId) => {
  const order = await Order.findById(orderId);
  if (!order) {
    throw new NotFoundError('Order not found');
  }

  return {
    orderId: order._id,
    orderNumber: order.orderNumber,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    total: order.total,
    paidAt: order.paidAt,
    paymentDetails: order.paymentDetails,
  };
};

module.exports = {
  createStripePaymentIntent,
  confirmStripePayment,
  attachPaymentToOrder,
  createPaystackTransaction,
  verifyPaystackTransaction,
  createKorapayCharge,
  verifyKorapayCharge,
  createGatewayTransaction,
  verifyGatewayTransaction,
  ACTIVE_GATEWAY,
  createStripeRefund,
  getPaymentStatus,
};
