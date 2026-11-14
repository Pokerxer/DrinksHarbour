// server/__tests__/whatsappOrderInvoice.test.js
//
// Mock-shape notes (mirrors the repo's t.mock conventions — see
// salesCataloguePricing.test.js / inventoryStockCatalog.test.js): Mongoose
// statics are mocked to return CHAINABLE query objects whose terminal .lean() /
// .session() resolve to the fixture; the awaited value is the fixture itself.
const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const oid = () => new mongoose.Types.ObjectId();
const ADMIN = { _id: oid(), role: 'super_admin' };

// Thenable query stub: .populate()/.session() chain, .lean()/await resolve to val.
const chain = (val) => {
  const q = {
    populate: () => q,
    session: () => q,
    lean: () => Promise.resolve(val),
    then: (res, rej) => Promise.resolve(val).then(res, rej),
    catch: (rej) => Promise.resolve(val).catch(rej),
  };
  return q;
};

function paidReadyOrder({ paymentStatus = 'pending' } = {}) {
  const orderId = oid();
  const order = {
    _id: orderId,
    orderNumber: 'DH-1001',
    user: null,
    items: [{ name: 'Item', subproduct: oid(), size: oid(), quantity: 2, priceAtPurchase: 2000, itemSubtotal: 4000 }],
    subtotal: 4000, discountTotal: 0, shippingFee: 500, totalAmount: 4500, currency: 'NGN',
    shippingAddress: { fullName: 'Ada Obi', email: 'buyer@example.com', phone: '+2348012345678',
      addressLine1: '1 Test Street', state: 'Lagos', city: 'Ikeja', country: 'Nigeria' },
    coupon: null,
    paymentStatus,
    status: 'pending',
    source: 'manual',
    channelSnapshot: null,
    save: async function save() { return this; },
  };
  return order;
}

test('issueInvoice mints a token, initializes a bound charge and stores the invoice', async (t) => {
  const Order = require('../models/Order');
  const order = paidReadyOrder();
  let savedFields = null;
  t.mock.method(Order, 'findById', () => chain(order));
  // order.save writes through the instance; capture via a proxy on save
  const origSave = order.save.bind(order);
  order.save = async () => { savedFields = { invoice: { ...order.invoice } }; return origSave(); };

  const Claim = require('../models/MarketplacePaymentClaim');
  t.mock.method(Claim, 'updateOne', async () => ({}));
  t.mock.method(Claim, 'findById', () => chain(null));

  const trust = require('../services/marketplacePaymentTrust');
  let initArgs = null;
  t.mock.method(trust, 'initialize', async (provider, actor, amount, currency, email, metadata, requestKey, extra) => {
    initArgs = { provider, actor, amount, requestKey, extra };
    return { authorizationUrl: 'https://checkout.korapay.com/x', reference: 'dhm-invoice-1', accessCode: null, amount };
  });

  const whatsapp = require('../services/whatsapp.service');
  const emailService = require('../services/email.service');
  t.mock.method(whatsapp, 'sendWhatsAppLongMessage', async () => ({ success: true }));
  t.mock.method(emailService, 'sendEmail', async () => ({ success: true }));
  const orderAccess = require('../services/orderAccess');
  t.mock.method(orderAccess, 'audit', async () => {});

  const svc = require('../services/whatsappOrderInvoice');
  const out = await svc.issueInvoice(String(order._id), ADMIN);

  assert.strictEqual(initArgs.extra.orderId, String(order._id), 'charge must carry orderId metadata');
  assert.ok(String(initArgs.extra.callbackUrl).includes('/invoice/'), 'gateway redirect must return to the hosted invoice page');
  assert.strictEqual(initArgs.amount, 4500);
  assert.match(initArgs.requestKey, /^dhwo-/);
  assert.ok(order.invoice.token && order.invoice.token.length >= 48, 'unguessable token minted');
  assert.strictEqual(order.invoice.paymentReference, 'dhm-invoice-1');
  assert.strictEqual(order.invoice.provider, 'korapay');
  assert.ok(out.invoiceUrl.includes(`/invoice/${order._id}?token=${order.invoice.token}`));
  assert.strictEqual(out.authorizationUrl, 'https://checkout.korapay.com/x');
  assert.ok(savedFields && savedFields.invoice.paymentReference === 'dhm-invoice-1', 'invoice persisted through save');
});

test('issueInvoice reuses a live charge (idempotent re-send)', async (t) => {
  const Order = require('../models/Order');
  const order = paidReadyOrder();
  order.invoice = { token: 't'.repeat(48), issuedAt: new Date(), provider: 'korapay',
    paymentReference: 'dhm-invoice-1', attempt: 1, issuedBy: ADMIN._id };
  t.mock.method(Order, 'findById', () => chain(order));

  const Claim = require('../models/MarketplacePaymentClaim');
  t.mock.method(Claim, 'findById', (id) => chain(String(id).includes('dhm-invoice-1')
    ? { _id: id, state: 'ready', expiresAt: new Date(Date.now() + 3600_000), order: order._id }
    : null));

  const trust = require('../services/marketplacePaymentTrust');
  let called = 0;
  t.mock.method(trust, 'initialize', async () => { called += 1; throw new Error('must not re-initialize a live charge'); });

  const whatsapp = require('../services/whatsapp.service');
  t.mock.method(whatsapp, 'sendWhatsAppLongMessage', async () => ({ success: true }));
  const emailService = require('../services/email.service');
  t.mock.method(emailService, 'sendEmail', async () => ({ success: true }));
  const orderAccess = require('../services/orderAccess');
  t.mock.method(orderAccess, 'audit', async () => {});

  const svc = require('../services/whatsappOrderInvoice');
  const out = await svc.issueInvoice(String(order._id), ADMIN);
  assert.strictEqual(called, 0);
  assert.strictEqual(out.resendOnly, true);
  assert.strictEqual(out.authorizationUrl, null); // mock claim has no initialization
});

test('publicInvoice hides the pay button without a valid token', async (t) => {
  const Order = require('../models/Order');
  const order = paidReadyOrder();
  order.invoice = { token: 'secret'.repeat(8), provider: 'korapay', paymentReference: 'dhm-invoice-1', attempt: 1 };
  t.mock.method(Order, 'findById', () => chain(order));
  const Claim = require('../models/MarketplacePaymentClaim');
  t.mock.method(Claim, 'findById', () => chain({ state: 'ready', expiresAt: new Date(Date.now() + 3600_000), initialization: { authorizationUrl: 'https://checkout.korapay.com/x' } }));

  const svc = require('../services/whatsappOrderInvoice');
  const good = await svc.publicInvoice(String(order._id), 'secret'.repeat(8));
  assert.strictEqual(good.payState, 'ready');
  assert.strictEqual(good.pay.authorizationUrl, 'https://checkout.korapay.com/x');
  await assert.rejects(() => svc.publicInvoice(String(order._id), 'wrong-token'), /not found/i);
});

test('verifyAndAttach marks the order paid only with a claim bound to this order', async (t) => {
  const Order = require('../models/Order');
  const order = paidReadyOrder();
  order.invoice = { token: 'secret'.repeat(8), provider: 'korapay', paymentReference: 'dhm-invoice-1', attempt: 1 };
  // Plain-object stand-in with the mongoose surface settleWithReceipt touches:
  // .set() (Object.assign), $locals (deferAccounting), .save().
  const orderDoc = {
    ...order,
    $locals: {},
    set(patch) { Object.assign(this, patch); return this; },
    save: async function save() { return this; },
  };
  t.mock.method(Order, 'findById', () => chain(orderDoc));

  const Claim = require('../models/MarketplacePaymentClaim');
  const claimRow = { _id: 'korapay:platform:dhm-invoice-1', provider: 'korapay', account: 'platform',
    user: ADMIN._id, order: order._id, amount: 4500, currency: 'NGN', state: 'ready',
    expiresAt: new Date(Date.now() + 3600_000) };
  t.mock.method(Claim, 'findById', (id) => chain(id === claimRow._id ? claimRow : null));

  const trust = require('../services/marketplacePaymentTrust');
  const receipt = { method: 'korapay', reference: 'dhm-invoice-1', transactionId: 'kps-1',
    amount: 4500, currency: 'NGN', paidAt: new Date(), channel: 'bank_transfer' };
  t.mock.method(trust, 'evidence', async () => ({ identity: claimRow._id, claim: claimRow, receipt }));
  let claimReceiptCalled = 0;
  t.mock.method(trust, 'claimReceipt', async () => { claimReceiptCalled += 1; return null; });

  // settleWithReceipt opens a transaction; no DB in unit tests — fake session.
  t.mock.method(mongoose, 'startSession', async () => ({
    withTransaction: async (fn) => fn(),
    endSession: async () => {},
  }));

  const accounting = require('../services/accounting.orders');
  t.mock.method(accounting, 'captureOrderAccounting', async () => {});

  const whatsapp = require('../services/whatsapp.service');
  const emailService = require('../services/email.service');
  const sms = require('../services/sms.service');
  t.mock.method(whatsapp, 'sendOrderConfirmationWhatsApp', async () => ({ success: true }));
  t.mock.method(emailService, 'sendOrderConfirmationToCustomer', async () => ({ success: true }));
  t.mock.method(sms, 'sendOrderConfirmationSMS', async () => ({ success: true }));
  const orderAccess = require('../services/orderAccess');
  t.mock.method(orderAccess, 'audit', async () => {});

  const svc = require('../services/whatsappOrderInvoice');
  const saved = await svc.verifyAndAttach(String(order._id), 'dhm-invoice-1');
  assert.strictEqual(saved.paymentStatus, 'paid');
  assert.strictEqual(saved.status, 'confirmed');
  assert.strictEqual(saved.paymentReference, 'dhm-invoice-1');
  assert.strictEqual(claimReceiptCalled, 1);

  // A claim bound to ANOTHER order must be rejected fail-closed.
  const other = { ...claimRow, order: oid() };
  t.mock.method(Claim, 'findById', () => chain(other));
  await assert.rejects(() => svc.verifyAndAttach(String(order._id), 'dhm-invoice-1'), /not found|another/i);
});
