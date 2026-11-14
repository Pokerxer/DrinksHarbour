// server/__tests__/manualOrder.create.test.js
//
// Manual intake mode: a platform admin transcribes a WhatsApp order through
// POST /api/orders. The admin's JWT must never become the order owner — the
// order belongs to the matched customer (or is a guest), carries
// source/originChannel/placedBy provenance, and suppresses the customer
// confirmation notifications (they fire when the invoice settles).
//
// The repo's convention (see salesOrder.quotation.test.js header) is mocking
// via t.mock — no real DB.
const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const oid = () => new mongoose.Types.ObjectId();

// guestOrderProof.issue signs a token for guest orders — no env in unit tests.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const ADMIN = { _id: oid(), role: 'super_admin' }; // no .tenant → platform staff
const CUSTOMER_USER = { _id: oid(), email: 'buyer@example.com', phone: '+2348012345678' };

function setupMocks(t, { matchedUser = null } = {}) {
  const SubProduct = require('../models/SubProduct');
  const Size = require('../models/Size');
  const Tenant = require('../models/Tenant');
  const Product = require('../models/Product');
  const User = require('../models/User');
  const Coupon = require('../models/Coupon');

  const tenantId = oid();
  const subId = oid();
  const sizeId = oid();
  const productId = oid();

  // createOrder chains .find().select().lean() on every model read — mirror
  // that shape in the mocks.
  t.mock.method(SubProduct, 'find', () => ({ select: () => ({ lean: async () => [{
    _id: subId, tenant: tenantId, product: productId, costPrice: 1000, baseSellingPrice: 2000,
    sellWithoutSizeVariants: false,
  }] }) }));
  t.mock.method(Size, 'find', () => ({ select: () => ({ lean: async () => [{
    _id: sizeId, subproduct: subId, tenant: tenantId, costPrice: 1000, sellingPrice: 2000,
    unitsPerPack: 1,
  }] }) }));
  t.mock.method(Tenant, 'find', () => ({ select: () => ({ lean: async () => [{
    _id: tenantId, name: 'Test Tenant', revenueModel: 'markup', markupPercentage: 50,
  }] }) }));
  t.mock.method(Product, 'find', () => ({ select: () => ({ lean: async () => [] }) }));
  // The tenant-alert loop runs Tenant.findById per resolved tenant — no DB here.
  t.mock.method(Tenant, 'findById', async () => null);

  let foundByPhone = null; let foundByEmail = matchedUser;
  t.mock.method(User, 'findOne', (q) => {
    if (q.email) { const r = foundByEmail; foundByEmail = null; return Promise.resolve(r); }
    if (q.phone) { const r = foundByPhone; foundByPhone = null; return Promise.resolve(r); }
    return Promise.resolve(null);
  });
  t.mock.method(User, 'findById', async () => null); // loyalty path must not run
  t.mock.method(Coupon, 'findOne', async () => { throw new Error('manual orders must not look up coupons'); });

  // generateOrderNumber is destructured at controller load (its real body hits
  // Order.countDocuments), so it must be mocked BEFORE the controller is first
  // required — the first setupMocks call in the file owns that binding.
  const orderUtils = require('../utils/orderUtils');
  t.mock.method(orderUtils, 'generateOrderNumber', async () => 'DH-TEST-0001');

  const trust = require('../services/marketplacePaymentTrust');
  let capturedOrderData = null;
  t.mock.method(trust, 'createOrder', async (data) => {
    capturedOrderData = data;
    return { ...data, $locals: {}, populate: async () => {}, totalAmount: data.totalAmount };
  });

  const firstOrderPerk = require('../services/firstOrderPerk.service');
  let perkUser = 'unset';
  t.mock.method(firstOrderPerk, 'resolveFirstOrderPerk', async ({ user }) => {
    perkUser = user;
    return { eligible: false, payableFee: 3500, waivedAmount: 0, reason: 'not_first_order' };
  });

  // marketContext.enabled() === false short-circuits country resolution, the
  // channelSnapshot path and marketIngress.assertLines in one go.
  const marketContext = require('../services/marketContext');
  t.mock.method(marketContext, 'enabled', () => false);

  // Idempotency recovery would read OrderCheckoutRequest from Mongo.
  const recovery = require('../services/marketCheckoutRecovery');
  t.mock.method(recovery, 'recover', async () => null);

  // The fire-and-forget notification block: stub every transport so nothing
  // touches the network or Mongo after the response is sent.
  const orderAccess = require('../services/orderAccess');
  t.mock.method(orderAccess, 'project', (order) => order);
  const emailService = require('../services/email.service');
  t.mock.method(emailService, 'sendOrderConfirmationToCustomer', async () => ({ success: true }));
  t.mock.method(emailService, 'sendNewOrderNotificationToTenant', async () => ({ success: true }));
  t.mock.method(emailService, 'sendNewOrderNotificationToAdmin', async () => ({ success: true }));
  const sms = require('../services/sms.service');
  t.mock.method(sms, 'sendOrderConfirmationSMS', async () => ({ success: true }));
  const whatsapp = require('../services/whatsapp.service');
  t.mock.method(whatsapp, 'sendOrderConfirmationWhatsApp', async () => ({ success: true }));
  t.mock.method(whatsapp, 'sendNewOrderAlertWhatsApp', async () => ({ success: true }));
  const pos = require('../services/pos.realtime');
  t.mock.method(pos, 'emitToTenantOrders', () => false);

  return { captured: () => capturedOrderData, perkUser: () => perkUser,
    ids: { tenantId, subId, sizeId, productId }, CustomerUser: CUSTOMER_USER };
}

function reqBody(overrides = {}) {
  return {
    customer: { firstName: 'Ada', lastName: 'Obi', email: 'buyer@example.com', phone: '+2348012345678' },
    shipping: { address: '1 Test Street', lga: 'Ikeja', city: 'Ikeja', state: 'Lagos', country: 'Nigeria', zipCode: '' },
    paymentMethod: 'bank_transfer',
    items: [{ subProductId: overrides.subProductId, sizeId: overrides.sizeId, quantity: 2 }],
    shippingFee: 3500,
    total: 7500,
    manualOrder: { originChannel: 'whatsapp' },
  };
}

test('manual order: admin JWT does not become the order owner; customer is matched', async (t) => {
  const m = setupMocks(t, { matchedUser: CUSTOMER_USER });
  const { createOrder } = require('../controllers/order.controller');
  const req = { body: reqBody({ subProductId: String(m.ids.subId), sizeId: String(m.ids.sizeId) }), user: ADMIN, get: () => 'idem-key-1' };
  let json; let code;
  const res = { status(c) { code = c; return { json: (b) => { json = b; } }; }, json(b) { json = b; } };
  await createOrder(req, res, (e) => { throw e; });

  assert.strictEqual(code, 201);
  const data = m.captured();
  assert.strictEqual(String(data.user), String(CUSTOMER_USER._id), 'order.user must be the matched customer');
  assert.strictEqual(data.source, 'manual');
  assert.strictEqual(data.originChannel, 'whatsapp');
  assert.strictEqual(String(data.placedBy), String(ADMIN._id));
  assert.strictEqual(data.paymentStatus, 'pending');
  assert.strictEqual(data.paymentMethod, 'bank_transfer');
});

test('manual order with no customer match is a guest order', async (t) => {
  const m = setupMocks(t, { matchedUser: null });
  const { createOrder } = require('../controllers/order.controller');
  const req = { body: reqBody({ subProductId: String(m.ids.subId), sizeId: String(m.ids.sizeId) }), user: ADMIN, get: () => 'idem-key-2' };
  let code;
  const res = { status(c) { code = c; return { json: (b) => {} }; }, json: () => {} };
  await createOrder(req, res, (e) => { throw e; });
  assert.strictEqual(code, 201);
  assert.strictEqual(m.captured().user, null);
});

test('manual order rejected for tenant-scoped actors and non-admin roles', async (t) => {
  const m = setupMocks(t);
  const { createOrder } = require('../controllers/order.controller');
  const tenantActor = { _id: oid(), role: 'tenant_owner', tenant: oid() };
  const res = { status: () => ({ json: () => {} }), json: () => {} };
  await assert.rejects(
    () => createOrder({ body: reqBody({ subProductId: String(m.ids.subId), sizeId: String(m.ids.sizeId) }), user: tenantActor, get: () => 'k' }, res, (e) => { throw e; }),
    /platform admin/i,
  );
});

test('a super_admin whose JWT carries a tenant snapshot can still create manual orders', async (t) => {
  // Regression: the seeded platform admin (admin@drinksharbour.com) belongs to
  // Wyn City, so its JWT embeds a tenant object. Platform-ness is role-based
  // (mirrors orderAccess.platform), NOT tenant absence.
  const m = setupMocks(t, { matchedUser: null });
  const { createOrder } = require('../controllers/order.controller');
  const adminWithTenant = { _id: oid(), role: 'super_admin', tenant: { _id: oid(), slug: 'wyncity' } };
  const req = { body: reqBody({ subProductId: String(m.ids.subId), sizeId: String(m.ids.sizeId) }), user: adminWithTenant, get: () => 'idem-key-tenant-admin' };
  let code;
  const res = { status(c) { code = c; return { json: (b) => {} }; }, json: () => {} };
  await createOrder(req, res, (e) => { throw e; });
  assert.strictEqual(code, 201);
  assert.strictEqual(m.captured().user, null); // guest — the tenant snapshot is not the customer
  assert.strictEqual(m.captured().source, 'manual');
});

test('manual order must use the invoice payment method and no coupons', async (t) => {
  const m = setupMocks(t, { matchedUser: CUSTOMER_USER });
  const { createOrder } = require('../controllers/order.controller');
  const res = { status: () => ({ json: () => {} }), json: () => {} };
  const body = reqBody({ subProductId: String(m.ids.subId), sizeId: String(m.ids.sizeId) });
  body.paymentMethod = 'wallet';
  await assert.rejects(
    () => createOrder({ body, user: ADMIN, get: () => 'k' }, res, (e) => { throw e; }),
    /invoiced/i,
  );
});

test('manual order accepts and normalizes printLines', async (t) => {
  const m = setupMocks(t, { matchedUser: null });
  const { createOrder } = require('../controllers/order.controller');
  const body = reqBody({ subProductId: String(m.ids.subId), sizeId: String(m.ids.sizeId) });
  body.manualOrder = {
    originChannel: 'whatsapp',
    printLines: [
      { lineType: 'section', name: '  Wines  ' },
      { lineType: 'product', productIndex: 0, description: 'chilled' },
      { lineType: 'note', name: 'note', description: 'deliver before Friday' },
      { lineType: 'bogus', name: 'dropped' },                       // invalid type → dropped
      { lineType: 'product', productIndex: 99 },                     // out of bounds → clamped to null
      { lineType: 'product', productIndex: -3 },                     // negative → clamped to null
    ],
  };
  const req = { body, user: ADMIN, get: () => 'idem-pl-1' };
  let code;
  const res = { status(c) { code = c; return { json: () => {} }; }, json: () => {} };
  await createOrder(req, res, (e) => { throw e; });
  assert.strictEqual(code, 201);
  const pl = m.captured().printLines;
  assert.strictEqual(pl.length, 5, 'invalid lineType dropped');
  assert.strictEqual(pl[0].lineType, 'section');
  assert.strictEqual(pl[0].name, 'Wines');
  assert.strictEqual(pl[1].description, 'chilled');
  assert.strictEqual(pl[2].lineType, 'note');
  assert.strictEqual(pl[3].productIndex, null, 'out-of-bounds productIndex clamped');
  assert.strictEqual(pl[4].productIndex, null, 'negative productIndex clamped');
});

test('non-manual orders reject printLines entirely', async (t) => {
  const m = setupMocks(t, { matchedUser: CUSTOMER_USER });
  const { createOrder } = require('../controllers/order.controller');
  const body = reqBody({ subProductId: String(m.ids.subId), sizeId: String(m.ids.sizeId) });
  delete body.manualOrder;
  body.printLines = [{ lineType: 'section', name: 'x' }];
  const res = { status: () => ({ json: () => {} }), json: () => {} };
  await assert.rejects(
    () => createOrder({ body, user: ADMIN, get: () => 'k' }, res, (e) => { throw e; }),
  );
});
