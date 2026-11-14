// server/services/whatsappOrderInvoice.js
'use strict';
//
// Invoice + payment settlement for manual (WhatsApp) marketplace orders.
//
// The order already exists (created unpaid by platform staff through the
// normal checkout pipeline). This module:
//   1. issues a token-gated invoice with a hosted page URL,
//   2. initializes a gateway charge bound to that order (claim.order), and
//   3. attaches a VERIFIED gateway receipt to the order — the only way a
//      manual order becomes paid. updatePaymentStatus's cash/COD-only
//      mark_paid rule is untouched by design: electronic settlement always
//      carries gateway evidence.
//
// The payer is a guest (or a customer who never authenticates), so the
// verification gate is the invoice TOKEN, not a user session. Claims are
// bound to the order at issuance (claim.order) and every verification
// asserts that binding fail-closed.

const crypto = require('node:crypto');
const mongoose = require('mongoose');
const Claim = require('../models/MarketplacePaymentClaim');
const Order = require('../models/Order');
const { ValidationError, NotFoundError, ConflictError } = require('../utils/errors');

// The active storefront gateway (korapay today, paystack if ever re-enabled).
const activeProvider = () => (require('./payment.service').ACTIVE_GATEWAY === 'paystack' ? 'paystack' : 'korapay');

// Claims from trust.initialize expire in 24h — tuned for one checkout session.
// An invoice may sit unpaid for days, so issuance extends the expiry. Beyond
// that window the claim needs reconciliation; the admin re-issues (new attempt).
const INVOICE_CLAIM_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const verifyFn = (provider) => {
  const service = require('./payment.service');
  return provider === 'paystack' ? service.verifyPaystackTransaction : service.verifyKorapayCharge;
};

function invoiceUrl(order) {
  return `${require('../utils/frontendUrl').frontendBaseUrl()}/invoice/${order._id}?token=${order.invoice.token}`;
}

async function sendInvoiceMessages(order, url) {
  const customer = {
    firstName: order.shippingAddress?.fullName?.split(' ')[0] || '',
    lastName: order.shippingAddress?.fullName?.split(' ').slice(1).join(' ') || '',
    email: order.shippingAddress?.email,
    phone: order.shippingAddress?.phone,
  };
  const text =
    `Hello ${customer.firstName || 'there'},\n\n` +
    `Here is your DrinksHarbour invoice for order ${order.orderNumber}.\n` +
    `Total: ₦${Number(order.totalAmount).toLocaleString()}\n` +
    `Pay securely here: ${url}\n\n` +
    `Thank you for shopping with DrinksHarbour.`;
  // Fire-and-forget per the platform notification convention.
  void Promise.allSettled([
    customer.phone
      ? require('./whatsapp.service').sendWhatsAppLongMessage(customer.phone, text)
      : Promise.resolve(),
    customer.email
      ? require('./email.service').sendEmail({
          to: customer.email,
          subject: `Invoice for order ${order.orderNumber} — DrinksHarbour`,
          text,
          html: `<p>Hello ${customer.firstName || 'there'},</p><p>Your invoice for order <strong>${order.orderNumber}</strong> totals <strong>₦${Number(order.totalAmount).toLocaleString()}</strong>.</p><p><a href="${url}">Pay securely online</a>.</p>`,
        })
      : Promise.resolve(),
  ]).then((results) => {
    results.forEach((r, i) => { if (r.status === 'rejected') console.error(`❌ Invoice message ${i} failed:`, r.reason?.message); });
  });
  return customer;
}

/**
 * Issue (or re-send) the invoice for an unpaid manual order.
 * Idempotent while the bound charge is live; `force` mints a fresh attempt
 * (new reference) when the previous charge expired or failed.
 */
async function issueInvoice(orderId, actor, { force = false } = {}) {
  if (!actor?._id) throw new ValidationError('Issuer required');
  const order = await Order.findById(orderId).populate('items.tenant', 'name');
  if (!order) throw new NotFoundError('Order not found');
  if (order.paymentStatus === 'paid') throw new ConflictError('Order is already paid');
  if (['cancelled', 'refunded'].includes(order.status)) throw new ConflictError('Order is cancelled');
  if (order.source !== 'manual') throw new ValidationError('Invoices are issued for manual orders');

  const provider = activeProvider();
  const claimId = (reference) => `${provider}:platform:${reference}`;

  if (!order.invoice?.token) {
    order.invoice = { token: crypto.randomBytes(24).toString('hex'), attempt: 0 };
  }

  // Live charge → re-send the same link (no new money movement).
  if (!force && order.invoice.paymentReference) {
    const existing = await Claim.findById(claimId(order.invoice.paymentReference)).lean();
    if (existing && ['ready', 'initializing'].includes(existing.state) &&
        existing.expiresAt && new Date(existing.expiresAt) > new Date()) {
      const url = invoiceUrl(order);
      await sendInvoiceMessages(order, url);
      await require('./orderAccess').audit(order, actor, 'whatsapp_order_invoice_resent');
      return { order, invoiceUrl: url, authorizationUrl: existing.initialization?.authorizationUrl || null, resendOnly: true };
    }
  }

  const attempt = force ? (order.invoice.attempt || 0) + 1 : (order.invoice.attempt || 0) || 1;
  const requestKey = `dhwo-${order._id}-v${attempt}`;
  const result = await require('./marketplacePaymentTrust').initialize(
    provider, actor, order.totalAmount, order.currency,
    order.shippingAddress?.email, {
      customerName: order.shippingAddress?.fullName,
      customerPhone: order.shippingAddress?.phone,
    }, requestKey, { orderId: String(order._id) },
  );

  // Bind the claim to THIS order (webhook + verification both assert it) and
  // extend the claim window to invoice timescales.
  await Claim.updateOne(
    { _id: claimId(result.reference) },
    { $set: { order: order._id, expiresAt: new Date(Date.now() + INVOICE_CLAIM_TTL_MS) } },
  );

  order.invoice = {
    ...order.invoice,
    token: order.invoice.token,
    issuedAt: new Date(),
    issuedBy: actor._id,
    provider,
    paymentReference: result.reference,
    attempt,
  };
  await order.save();
  const url = invoiceUrl(order);
  const customer = await sendInvoiceMessages(order, url);
  await require('./orderAccess').audit(order, actor, 'whatsapp_order_invoice_issued');
  console.log(`🧾 Invoice issued for ${order.orderNumber} → ${customer.email || customer.phone} (attempt ${attempt})`);
  return { order, invoiceUrl: url, authorizationUrl: result.authorizationUrl || null, resendOnly: false };
}

/** Hash-compare so token length never leaks through timing. */
function tokenMatches(invoice, provided) {
  const a = crypto.createHash('sha256').update(String(invoice?.token || '')).digest();
  const b = crypto.createHash('sha256').update(String(provided || '')).digest();
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Public, token-gated payload for the hosted invoice page. */
async function publicInvoice(orderId, token) {
  const order = await Order.findById(orderId)
    .populate('items.tenant', 'name')
    .populate('items.size', 'displayName size')
    .lean();
  if (!order || !tokenMatches(order.invoice, token)) throw new NotFoundError('Invoice not found');

  let pay = null;
  let payState = order.paymentStatus === 'paid' ? 'paid' : 'unpaid';
  if (payState === 'unpaid' && order.invoice?.paymentReference) {
    const row = await Claim.findById(`${order.invoice.provider || 'korapay'}:platform:${order.invoice.paymentReference}`).lean();
    if (row && row.state === 'ready' && row.expiresAt && new Date(row.expiresAt) > new Date()) {
      pay = { authorizationUrl: row.initialization?.authorizationUrl || null };
      payState = 'ready';
    } else if (row) {
      payState = 'stale'; // admin must re-issue
    }
  }

  const items = (order.items || []).map((i) => ({
    name: i.productName || i.name || 'Item',
    size: i.size?.displayName || i.size?.size || null,
    tenant: i.tenant?.name || null,
    quantity: i.quantity,
    unitPrice: i.priceAtPurchase,
    itemSubtotal: i.itemSubtotal,
  }));

  return {
    orderId: String(order._id),
    orderNumber: order.orderNumber,
    customer: {
      name: order.shippingAddress?.fullName || '',
      phone: order.shippingAddress?.phone || '',
    },
    items,
    subtotal: order.subtotal,
    discountTotal: order.discountTotal,
    shippingFee: order.shippingFee,
    totalAmount: order.totalAmount,
    currency: order.currency,
    paymentStatus: order.paymentStatus,
    issuedAt: order.invoice?.issuedAt || null,
    pay,
    payState,
  };
}

/** Shared settlement core — verified gateway receipt → paid order. */
async function settleWithReceipt(order, provider, reference) {
  const claim = await Claim.findById(`${provider}:platform:${reference}`).lean();
  if (!claim || claim.provider !== provider || claim.account !== 'platform') {
    throw new NotFoundError('Payment not found');
  }
  // Fail closed: only a claim BOUND to this order at issuance can settle it.
  if (!claim.order || String(claim.order) !== String(order._id)) {
    throw new NotFoundError('Payment not found');
  }
  const actor = { _id: claim.user }; // the platform issuer who initialized the charge
  const proof = await require('./marketplacePaymentTrust').evidence(
    { method: provider, reference }, actor, order,
  );

  const session = await mongoose.startSession();
  let saved;
  try {
    await session.withTransaction(async () => {
      saved = await Order.findById(order._id).session(session);
      if (saved.paymentStatus === 'paid') {
        if (saved.paymentReference !== reference) throw new ConflictError('Order already has another receipt');
        return; // idempotent replay
      }
      if (['cancelled', 'refunded', 'failed'].includes(saved.status) || saved.paymentStatus !== 'pending') {
        await Claim.updateOne({ _id: proof.identity },
          { $set: { state: 'needs_review', issue: 'Late payment after stock release' } }, { session });
        return;
      }
      await require('./marketplacePaymentTrust').claimReceipt(proof, saved, session);
      saved.set({
        paymentStatus: 'paid',
        status: 'confirmed',
        paidAt: proof.receipt.paidAt,
        paymentDetails: proof.receipt,
        paymentReference: proof.receipt.reference,
      });
      saved.$locals.deferAccounting = true;
      await saved.save({ session });
    });
  } finally {
    await session.endSession();
  }
  if (saved.paymentStatus !== 'paid') throw new ConflictError('Late payment requires reconciliation; stock was not reacquired');
  await require('./accounting.orders').captureOrderAccounting(saved);
  return saved;
}

/** Verify a gateway charge and attach it to the manual order. */
async function verifyAndAttach(orderId, reference) {
  if (typeof reference !== 'string' || !reference) throw new ValidationError('Payment reference required');
  const order = await Order.findById(orderId);
  if (!order) throw new NotFoundError('Order not found');
  const provider = order.invoice?.provider || activeProvider();
  const saved = await settleWithReceipt(order, provider, reference);
  await notifyPaid(saved, {
    firstName: saved.shippingAddress?.fullName?.split(' ')[0] || '',
    lastName: saved.shippingAddress?.fullName?.split(' ').slice(1).join(' ') || '',
    email: saved.shippingAddress?.email,
    phone: saved.shippingAddress?.phone,
  });
  return saved;
}

/** Webhook branch — marketWebhook.settle routes manual orders here. */
async function settleFromWebhook(order, provider, reference) {
  return settleWithReceipt(order, provider, reference);
}

/** Post-settlement customer receipt (mirrors checkout's confirmation block). */
async function notifyPaid(order, customer) {
  try {
    await Promise.allSettled([
      require('./email.service').sendOrderConfirmationToCustomer(order, customer),
      require('./sms.service').sendOrderConfirmationSMS(order, customer),
      require('./whatsapp.service').sendOrderConfirmationWhatsApp(order, customer),
    ]);
    await require('./orderAccess').audit(order, { _id: order.placedBy, role: 'super_admin' }, 'whatsapp_order_paid');
  } catch (err) {
    console.error('❌ Manual-order paid notifications failed:', err.message);
  }
}

module.exports = { issueInvoice, publicInvoice, verifyAndAttach, settleFromWebhook, notifyPaid };
