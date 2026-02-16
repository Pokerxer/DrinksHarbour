// services/payment.service.js

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const axios = require('axios');
const Order = require('../models/Order');
const { ValidationError, NotFoundError } = require('../utils/errors');

const PAYSTACK_BASE_URL = 'https://api.paystack.co';

/**
 * Initialize Stripe payment intent (without order)
 */
const createStripePaymentIntent = async (amount, currency = 'ngn', metadata = {}) => {
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
 * Initialize Paystack transaction (without order)
 */
const createPaystackTransaction = async (amount, email, metadata = {}) => {
  try {
    const response = await axios.post(
      `${PAYSTACK_BASE_URL}/transaction/initialize`,
      {
        email: email,
        amount: Math.round(amount * 100), // Paystack uses kobo
        metadata: {
          ...metadata,
          createdAt: new Date().toISOString(),
        },
        callback_url: `${process.env.FRONTEND_URL}/payment/verify`,
      },
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
  createStripeRefund,
  getPaymentStatus,
};
