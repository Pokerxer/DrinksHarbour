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
const { normalizeUrl, frontendUrl } = require('../utils/frontendUrl');
const { normalizePaymentMethod } = require('../utils/paymentMethods');

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
      // Gateways reject anything that isn't an absolute http(s) URI, so a bad
      // caller URL or env value is repaired here rather than forwarded.
      callback_url: normalizeUrl(options.callbackUrl) || frontendUrl('/payment/verify'),
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
      // Korapay 400s the whole charge ("redirect_url must be a valid uri") if this
      // isn't absolute, so normalise the caller URL / env value before sending.
      redirect_url: normalizeUrl(options.callbackUrl) || frontendUrl('/payment/verify'),
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

    // AA021 — amount outside the merchant account's per-transaction channel
    // limits. Korapay's raw message is confusing for shoppers; translate it and
    // point at the wallet path (wallet payments don't go through the gateway).
    const kpErr = error.response?.data;
    if (kpErr?.code === 'AA021') {
      const limits = String(kpErr.message || '').match(/NGN\s?([\d,]+)/gi) || [];
      const maxLimit = limits
        .map((s) => Number(s.replace(/\D/g, '')))
        .filter((n) => n > 100)
        .sort((a, b) => b - a)[0];
      const limitText = maxLimit
        ? `₦${maxLimit.toLocaleString()} per transaction`
        : 'the per-transaction limit';
      throw new ValidationError(
        `This order total (₦${Math.round(amount).toLocaleString()}) is above ${limitText} for online card/bank payments. ` +
        `You can fund your DH Wallet in smaller amounts and pay from the wallet, or contact support to complete this order.`
      );
    }

    // Korapay's validation message ("One or more fields are invalid") names
    // nothing; the useful part is per-field under data.<field>.message. Surface it
    // so a bad payload is diagnosable from the response, not just the logs.
    if (kpErr?.error === 'validation_error' && kpErr.data && typeof kpErr.data === 'object') {
      const details = Object.entries(kpErr.data)
        .map(([field, info]) => info?.message || `${field} is invalid`)
        .join('; ');
      if (details) {
        throw new ValidationError(`Payment could not be initialized (${details})`);
      }
    }

    throw new ValidationError(kpErr?.message || error.message || 'Failed to initialize Korapay payment');
  }
};

// Channels Korapay can settle a charge through. The charge-lookup response
// (GET /charges/:reference) names no channel at all — unlike the webhook payload
// it carries no `payment_method` key — and instead returns a nested object named
// after the channel that was used (confirmed against a live charge: a bank
// transfer came back as `{ bank_transfer: { payer_bank_account: … } }`).
// Reading only `payment_method` meant the channel was always undefined, which is
// why the checkout return page fell back to hardcoding 'bank_transfer'.
const KORAPAY_CHANNEL_KEYS = ['card', 'bank_transfer', 'pay_with_bank', 'mobile_money', 'ussd'];

const deriveKorapayChannel = (data = {}) => {
  const declared = data.payment_method || data.channel;
  if (declared) return String(declared);
  const structural = KORAPAY_CHANNEL_KEYS.find(
    (key) => data[key] && typeof data[key] === 'object',
  );
  return structural || null;
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
        const channel = deriveKorapayChannel(data);
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
            // Raw gateway channel, kept verbatim for reconciliation…
            channel,
            // …and the canonical Order.paymentMethod it maps to. Null when the
            // channel is unreadable — the caller must not invent one.
            paymentMethod: normalizePaymentMethod(channel),
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

// Which paymentDetails.method values mean "a hosted gateway settled this".
const HOSTED_GATEWAYS = { korapay: verifyKorapayCharge, paystack: verifyPaystackTransaction };

/**
 * Decide the canonical Order.paymentMethod for an incoming order.
 *
 * For hosted-gateway payments the browser cannot know the answer: the single
 * "Card / Bank Transfer / USSD" checkout button hands off to Korapay, and only
 * the gateway knows which channel the customer ended up using. So the claim from
 * the client is treated as a hint and re-derived from the gateway here.
 *
 * Fails open by design — the customer's money has already moved by the time this
 * runs, so a gateway hiccup must never cost them the order.
 *
 * @param {string} claimedMethod  canonical method supplied by the caller
 * @param {object|null} paymentDetails  the order's paymentDetails payload
 * @returns {Promise<string>} canonical method to store
 */
const resolveGatewayPaymentMethod = async (claimedMethod, paymentDetails) => {
  const verify = HOSTED_GATEWAYS[paymentDetails?.method];
  const reference = paymentDetails?.reference || paymentDetails?.transactionId;
  if (!verify || !reference) return claimedMethod;

  try {
    const result = await verify(reference);
    // Korapay reports a pre-normalised paymentMethod; Paystack only reports a
    // raw `channel` ('card' / 'bank' / 'ussd' / …), which the aliases fold.
    const derived = result?.success
      ? normalizePaymentMethod(result.data?.paymentMethod || result.data?.channel)
      : null;
    if (derived && derived !== claimedMethod) {
      console.log(
        `[payments] ${reference}: client said "${claimedMethod}", gateway says "${derived}" — storing gateway value`,
      );
    }
    return derived || claimedMethod;
  } catch (err) {
    console.warn(`[payments] Could not re-derive method for ${reference}: ${err.message}`);
    return claimedMethod;
  }
};

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
  resolveGatewayPaymentMethod,
  ACTIVE_GATEWAY,
  createStripeRefund,
  getPaymentStatus,
};