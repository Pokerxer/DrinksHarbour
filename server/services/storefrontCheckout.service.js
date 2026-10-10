'use strict';
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const Checkout = require('../models/IntegrationCheckout');
const Order = require('../models/Order');
const cart = require('./storefrontCart.service');
const stock = require('./storefrontStock');
const gateway = require('./storefrontGateway');
const { normalizeCart, onlyKeys, id } = require('./storefrontPricing');
const { ValidationError, ConflictError, NotFoundError } = require('../utils/errors');
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
  return value;
}
function prepareCheckout(tenant, key, input, token) {
  if (typeof token !== 'string' || !/^[\w.-]{8,128}$/.test(token)) throw new ValidationError('Idempotency-Key must contain 8–128 letters, numbers, dots, dashes or underscores');
  normalizeCart(input);
  onlyKeys(input.customer, ['firstName', 'lastName', 'email', 'phone']);
  for (const field of ['firstName', 'lastName', 'email', 'phone']) {
    if (typeof input.customer[field] !== 'string' || !input.customer[field].trim() || input.customer[field].length > 150) throw new ValidationError(`Invalid customer ${field}`);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.customer.email)) throw new ValidationError('Invalid customer email');
  let url;
  try { url = new URL(input.returnUrl); } catch { throw new ValidationError('Invalid return URL'); }
  if (url.username || url.password || (url.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))) {
    throw new ValidationError('Use an HTTPS return URL');
  }
  if (url.href.length > 2000) throw new ValidationError('Return URL is too long');
  if ((input.shippingMethod || 'standard') !== 'pickup' && (typeof input.shipping?.address !== 'string' || !input.shipping.address.trim() || typeof input.shipping?.city !== 'string' || !input.shipping.city.trim())) {
    throw new ValidationError('Shipping address and city are required');
  }
  return { _id: digest(`${id(tenant)}:${id(key)}:${token}`), tenant: tenant._id, apiKey: key._id,
    fingerprint: digest(JSON.stringify(canonical(input))), email: input.customer.email.trim(), returnUrl: url.href };
}
const owner = (tenant, key, value) => ({ _id: value, tenant: tenant._id, apiKey: key._id });
const privateFields = '+fingerprint +email +returnUrl +authorizationUrl';
function publicCheckout(row) {
  return { id: row._id, orderId: id(row.order), orderNumber: row.orderNumber, total: row.total,
    currency: 'NGN', status: row.state, reference: row.reference,
    authorizationUrl: row.state === 'ready' ? row.authorizationUrl : null };
}
async function createCheckout(tenant, key, input, token) {
  const prepared = prepareCheckout(tenant, key, input, token);
  let row;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      row = await Checkout.findOne(owner(tenant, key, prepared._id)).select(privateFields).session(session).lean();
      if (row) {
        if (row.fingerprint !== prepared.fingerprint) throw new ConflictError('Idempotency-Key already used for a different checkout');
        return;
      }
      gateway.assertConfigured();
      const quote = await cart.quoteCart(tenant, input, session);
      const orderId = new mongoose.Types.ObjectId();
      const orderNumber = `WEB-${crypto.randomUUID()}`;
      row = { ...prepared, order: orderId, orderNumber, total: quote.total, amountKobo: Math.round(quote.total * 100),
        reference: `dhw-${prepared._id}`, state: 'pending' };
      await stock.reserveStock(quote.orderItems, session);
      const c = input.customer, s = input.shipping || {};
      await Order.insertMany([{ _id: orderId, integrationCheckout: row._id, tenant: tenant._id, orderNumber,
        items: quote.orderItems, subtotal: quote.subtotal, shippingFee: quote.shippingFee, totalAmount: quote.total,
        currency: 'NGN', paymentMethod: 'card', paymentStatus: 'pending', paymentReference: row.reference,
        shippingMethod: input.shippingMethod || 'standard', ageVerifiedAtOrderTime: input.ageVerified === true,
        shippingAddress: { fullName: `${c.firstName.trim()} ${c.lastName.trim()}`, email: row.email, phone: c.phone.trim(),
          addressLine1: s.address, city: s.city, lga: s.lga, state: s.state, country: s.country || 'Nigeria', postalCode: s.postalCode,
          ...(s.coordinates ? { coordinates: { latitude: s.coordinates.latitude, longitude: s.coordinates.longitude } } : {}) },
        platformCommissionTotal: quote.orderItems.reduce((sum, i) => sum + i.platformCommission, 0),
        fulfillmentStatus: { [id(tenant)]: 'pending' }, status: 'pending', source: 'web' }], { session });
      await Checkout.create([row], { session });
    });
  } catch (error) {
    if (error.code !== 11000) throw error;
    row = await Checkout.findOne(owner(tenant, key, prepared._id)).select(privateFields).lean();
    if (!row || row.fingerprint !== prepared.fingerprint) throw new ConflictError('Checkout is already being created; retry with the same Idempotency-Key');
  } finally { await session.endSession(); }
  if (row.state !== 'pending') return { ...publicCheckout(row), replayed: true };
  // A single worker calls Paystack. Never re-initialize an uncertain attempt:
  // keep its reference and reconcile through verify/webhook instead.
  const claimed = await Checkout.findOneAndUpdate({ ...owner(tenant, key, row._id), state: 'pending' },
    { $set: { state: 'initializing', initializedAt: new Date() } }, { new: true }).select(privateFields).lean();
  if (!claimed) return { ...await getCheckout(tenant, key, row._id), replayed: true };
  try {
    const payment = await gateway.initialize(claimed);
    const result = await Checkout.updateOne({ ...owner(tenant, key, row._id), state: 'initializing' },
      { $set: { state: 'ready', authorizationUrl: payment.authorizationUrl } });
    if (!result.modifiedCount) return getCheckout(tenant, key, row._id);
    return publicCheckout({ ...row, state: 'ready', authorizationUrl: payment.authorizationUrl });
  } catch (error) {
    await Checkout.updateOne({ ...owner(tenant, key, row._id), state: 'initializing' }, { $set: { state: 'uncertain' } });
    // Returning the persistent handle lets a website recover without creating
    // another charge. The UI must only redirect when authorizationUrl exists.
    return publicCheckout({ ...row, state: 'uncertain' });
  }
}
async function findCheckout(tenant, key, value) {
  if (typeof value !== 'string' || !/^[a-f\d]{64}$/.test(value)) throw new ValidationError('Invalid checkout ID');
  const row = await Checkout.findOne(owner(tenant, key, value)).select(privateFields).lean();
  if (!row) throw new NotFoundError('Checkout not found');
  return row;
}
async function getCheckout(tenant, key, value) {
  const row = await findCheckout(tenant, key, value);
  const order = await Order.findOne({ _id: row.order, tenant: tenant._id, integrationCheckout: row._id })
    .select('status paymentStatus').lean();
  return { ...publicCheckout(row), orderStatus: order?.status || null, paymentStatus: order?.paymentStatus || 'pending' };
}
async function verifyCheckout(tenant, key, value) {
  const row = await findCheckout(tenant, key, value);
  if (!['paid', 'cancelled', 'needs_review'].includes(row.state)) {
    const payment = await gateway.verify(row.reference);
    if (payment.status === 'success') await require('./storefrontSettlement').settlePayment(row.reference, payment);
  }
  return getCheckout(tenant, key, value);
}
module.exports = { prepareCheckout, publicCheckout, createCheckout, findCheckout, getCheckout, verifyCheckout };
