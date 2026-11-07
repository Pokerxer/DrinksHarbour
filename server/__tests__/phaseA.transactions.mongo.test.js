'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const mongoose = require('mongoose'), express = require('express'), jwt = require('jsonwebtoken');
const uri = process.env.DRINKSHARBOUR_PHASE_A_TEST_MONGO_URI;
test('Phase A real HTTP ownership and durable financial concurrency', { skip: !uri }, async t => {
  assert.match(uri, /^mongodb:\/\/127\.0\.0\.1:29129\/drinks_phase_a_test_[\w]+\?replicaSet=phaseA$/);
  await mongoose.connect(uri.split('?')[0] + '?directConnection=true', { serverSelectionTimeoutMS: 5000 });
  try { await mongoose.connection.db.admin().command({ replSetGetStatus: 1 }); }
  catch (e) { if (e.code !== 94) throw e; await mongoose.connection.db.admin().command({ replSetInitiate: { _id: 'phaseA', members: [{ _id: 0, host: '127.0.0.1:29129' }] } }); }
  await mongoose.disconnect(); await mongoose.connect(uri.replace('?', `_${process.pid}?`), { serverSelectionTimeoutMS: 15000 });
  t.after(async () => { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });
  process.env.JWT_SECRET = 'phase-a-local-fixture-only';
  process.env.GIFTCARD_QR_SECRET = 'phase-a-local-gift-only';
  const Order = require('../models/Order'), User = require('../models/User'), Tenant = require('../models/Tenant');
  const Claim = require('../models/MarketplacePaymentClaim'), trust = require('../services/marketplacePaymentTrust');
  const Wallet = require('../models/PlatformWalletTransaction');
  const oid = () => new mongoose.Types.ObjectId(); const a = oid(), b = oid(), customer = oid(), stranger = oid(), merchant = oid(), merchantB = oid(), admin = oid(), product = oid(), sp = oid();
  await Promise.all([Order.init(), Claim.init()]);
  for (const [id, role, tenant] of [[customer, 'customer'], [stranger, 'customer'], [merchant, 'tenant_admin', a], [merchantB, 'tenant_admin', b], [admin, 'super_admin']]) {
    await User.collection.insertOne({ _id: id, role, tenant, email: `${id}@example.test`, status: 'active', platformWalletBalance: 1000 });
  }
  await Tenant.collection.insertMany([a, b].map((id, n) => ({ _id: id, name: `Merchant ${n}`, slug: `merchant-${n}`, status: 'approved', subscriptionStatus: 'active', revenueModel: 'commission', commissionPercentage: 0 })));
  await require('../models/Product').collection.insertOne({ _id: product, name: 'Bottle', status: 'approved' });
  await require('../models/SubProduct').collection.insertOne({ _id: sp, product, tenant: a, status: 'active', isPublished: true, availableStock: 20, totalStock: 20, reservedStock: 0, costPrice: 50, baseSellingPrice: 100 });
  const data = (n = 1) => ({ user: customer, orderNumber: `PHASE-${n}`, paymentMethod: 'wallet', paymentStatus: 'pending', status: 'pending', currency: 'NGN', totalAmount: 100, subtotal: 100,
    shippingAddress: { fullName: 'Customer', email: 'customer@example.test', addressLine1: 'Address', city: 'Abuja', state: 'FCT', country: 'Nigeria' },
    items: [{ product, subproduct: sp, tenant: a, quantity: 1, priceAtPurchase: 100, itemSubtotal: 100, tenantRevenueShare: 100, platformCommission: 0 }] });
  for (const module of ['email', 'sms', 'whatsapp']) {
    const transport = require(`../services/${module}.service`);
    for (const name of Object.keys(transport).filter(k => k.startsWith('send'))) if (typeof transport[name] === 'function') t.mock.method(transport, name, async () => ({ success: true }));
  }
  const app = express(); app.use(express.json({ verify(req, res, bytes) { req.rawBody = bytes; } }));
  app.use('/orders', require('../routes/order.routes')); app.use('/payments', require('../routes/payment.routes'));
  app.use('/wallet', require('../routes/wallet.routes')); app.use('/gift-cards', require('../routes/giftCard.routes'));
  app.use((err, req, res, next) => res.status(err.statusCode || 500).json({ message: err.message }));
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const call = async (path, actor, body, headers = {}, method) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, { method: method || (body === undefined ? 'GET' : 'POST'), headers: { 'Content-Type': 'application/json',
      ...(actor ? { Authorization: `Bearer ${jwt.sign({ userId: String(actor) }, process.env.JWT_SECRET)}` } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  };
  let walletReceipt, paid;
  await t.test('parallel wallet payment retries debit once with one receipt', async () => {
    const results = await Promise.all([1, 2].map(() => call('/wallet/pay', customer, { amount: 100 }, { 'Idempotency-Key': 'wallet-one' })));
    assert.deepEqual(results.map(r => r.status), [200, 200]);
    assert.equal(results[0].body.data.transactionId, results[1].body.data.transactionId);
    assert.equal((await User.findById(customer).lean()).platformWalletBalance, 900);
    walletReceipt = results[0].body.data.transactionId;
  });
  await t.test('parallel receipt checkout creates one order and one stock reservation', async () => {
    if (!walletReceipt) walletReceipt = String((await Wallet.findOne({ userId: customer }).lean())._id);
    const actor = { _id: customer, role: 'customer' };
    const results = await Promise.all([1, 2].map(n => trust.createOrder(data(n), [], { method: 'wallet', transactionId: walletReceipt }, actor)));
    assert.equal(String(results[0]._id), String(results[1]._id)); paid = results[0];
    assert.equal(await Order.countDocuments(), 1);
    assert.equal((await require('../models/SubProduct').findById(sp).lean()).reservedStock, 1);
    assert.equal(paid.paymentStatus, 'paid'); assert.equal(paid.status, 'confirmed');
    await assert.rejects(trust.createOrder({ ...data(3), items: [{ ...data().items[0], quantity: 2 }] }, [], { method: 'wallet', transactionId: walletReceipt }, actor), e => e.statusCode === 409);
  });
  await t.test('a historical wallet receipt already stored on an order cannot fund a new order', async () => {
    const tx = await Wallet.create({ userId: customer, type: 'debit', source: 'online_checkout', amount: 100, balanceAfter: 700, createdBy: customer });
    await Order.create({ ...data(91), paymentStatus: 'paid', paymentDetails: { method: 'wallet', transactionId: String(tx._id) } });
    await assert.rejects(trust.createOrder(data(92), [], { method: 'wallet', transactionId: String(tx._id) }, { _id: customer, role: 'customer' }), e => e.statusCode === 409);
  });
  await t.test('private payment HTTP reads and attachment require correct owner', async () => {
    assert.equal((await call(`/payments/status/${paid._id}`, stranger)).status, 404);
    const owned = await call(`/payments/status/${paid._id}`, customer);
    assert.equal(owned.status, 200); assert.equal(owned.body.data.paymentDetails, undefined);
    assert.equal((await call('/payments/attach-to-order', stranger, { orderId: String(paid._id), paymentData: { method: 'wallet', transactionId: walletReceipt } })).status, 404);
    assert.equal((await call('/payments/refund', customer, { orderId: String(paid._id) })).status, 403);
  });
  let mixed; const foreignSp = oid();
  await t.test('merchant list detail receipt and number lookups redact foreign data', async () => {
    mixed = await Order.create({ ...data(20), receiptNumber: 'PHASE-RECEIPT', paymentDetails: { transactionId: 'SECRET' },
      items: [...data().items, { product, subproduct: foreignSp, tenant: b, quantity: 1, priceAtPurchase: 200, itemSubtotal: 200, costPrice: 70 }], totalAmount: 330, subtotal: 300, shippingFee: 30 });
    for (const path of [`/orders/${mixed._id}`, '/orders/number/PHASE-20', '/orders/receipt/PHASE-RECEIPT']) {
      const res = await call(path, merchant); assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.equal(res.body.data.order.items.length, 1); assert.equal(res.body.data.order.totalAmount, 100);
      assert.equal(JSON.stringify(res.body).includes('SECRET'), false);
    }
    const list = await call('/orders', merchant); assert.equal(list.status, 200);
    assert.equal((await call(`/orders?subProductId=${foreignSp}`, merchant)).body.data.orders.length, 0);
    assert.ok(list.body.data.orders.every(o => o.items.length === 1));
    const otherView = await call(`/orders/${mixed._id}`, merchantB);
    assert.equal(otherView.status, 200); assert.equal(otherView.body.data.order.items.length, 1);
    assert.equal(otherView.body.data.order.totalAmount, 200); assert.equal(otherView.body.data.order.shippingFee, 0);
    const foreignOrder = await Order.create({ ...data(94), items: [{ product, tenant: b, quantity: 1, priceAtPurchase: 200, itemSubtotal: 200 }], totalAmount: 200 });
    assert.equal((await call(`/orders/${foreignOrder._id}`, merchant)).status, 404);
    assert.equal((await call(`/payments/status/${foreignOrder._id}`, merchant)).status, 404);
    assert.equal((await call(`/orders/${foreignOrder._id}/cancel`, merchant, {})).status, 404);
    assert.equal((await call('/orders/my-orders', customer)).status, 200);
    const customerView = await call(`/orders/${mixed._id}`, customer); assert.equal(customerView.body.data.order.items.length, 2);
    assert.equal(JSON.stringify(customerView.body).includes('costPrice'), false);
    assert.equal((await call(`/orders/${mixed._id}`, stranger)).status, 404);
    assert.equal((await call(`/orders/number/PHASE-20?email=customer@example.test`, stranger)).status, 404);
    assert.equal((await call(`/orders/${mixed._id}/cancel`, merchant, {})).status, 409);
  });
  await t.test('provider verification binds exact account owner amount currency reference purpose and expiry', async () => {
    const axios = require('axios'); let reply;
    t.mock.method(axios, 'get', async () => ({ data: { status: true, data: reply } }));
    const reference = 'dhm-fixture';
    await Claim.create({ _id: `paystack:platform:${reference}`, provider: 'paystack', reference, user: customer, amount: 100, currency: 'NGN', state: 'ready', expiresAt: new Date(Date.now() + 60000) });
    const correct = { reference, status: 'success', amount: 10000, currency: 'NGN', metadata: { kind: 'marketplace_order', userId: String(customer), paymentAccount: 'platform' } };
    for (const patch of [{ amount: 9900 }, { currency: 'GBP' }, { reference: 'other' }, { status: 'pending' }, { metadata: { ...correct.metadata, paymentAccount: 'MERCHANT' } }, { metadata: { ...correct.metadata, userId: String(stranger) } }]) {
      reply = { ...correct, ...patch };
      await assert.rejects(trust.evidence({ method: 'paystack', reference }, { _id: customer }, data()), e => e.statusCode === 409);
    }
    reply = correct;
    assert.equal((await trust.evidence({ method: 'paystack', reference }, { _id: customer }, data())).receipt.amount, 100);
    assert.equal((await call(`/payments/paystack/verify/${reference}`, stranger)).status, 404);
    assert.equal((await call(`/payments/paystack/verify/${reference}`, null)).status, 401);
    await Claim.updateOne({ reference }, { $set: { expiresAt: new Date(0) } });
    await assert.rejects(trust.evidence({ method: 'paystack', reference }, { _id: customer }, data()), /expired/);
  });
  await t.test('one checkout key cannot start a second funding method', async () => {
    const response = await call('/gift-cards/pay-checkout', customer, { code: 'IGNORED', amount: 100 }, { 'Idempotency-Key': 'wallet-one' });
    assert.equal(response.status, 409);
  });
  await t.test('gift-card parallel debit is once-only and redemption receipts are checkout-specific', async () => {
    const Gift = require('../models/GiftCard');
    const card = await Gift.create({ code: 'PHASEAGIFT', initialAmount: 500, balance: 500, status: 'active' });
    const responses = await Promise.all([1, 2].map(() => call('/gift-cards/pay-checkout', customer, { code: 'PHASEAGIFT', amount: 100 }, { 'Idempotency-Key': 'gift-one' })));
    assert.deepEqual(responses.map(r => r.status), [200, 200]);
    assert.equal(responses[0].body.data.transactionId, responses[1].body.data.transactionId);
    assert.equal((await Gift.findById(card._id).lean()).balance, 400);
    const tx = responses[0].body.data.transactionId;
    const bought = await trust.createOrder(data(50), [], { method: 'gift_card', transactionId: tx }, { _id: customer, role: 'customer' });
    assert.equal(bought.paymentStatus, 'paid');
    const unrelated = await require('../models/GiftCardTransaction').create({ giftCardId: card._id, type: 'redeem', amount: 100, balanceAfter: 300, createdBy: customer });
    await assert.rejects(trust.evidence({ method: 'gift_card', transactionId: String(unrelated._id) }, { _id: customer }, data()), e => e.statusCode === 404);
  });
  await t.test('a receipt cannot attach to another order; late success cannot reacquire released stock', async () => {
    const pending = await trust.createOrder({ ...data(60), paymentMethod: 'cash_on_delivery', status: 'confirmed' }, [], null, { _id: customer }, 'pending-order');
    const before = (await require('../models/SubProduct').findById(sp).lean()).reservedStock;
    assert.equal((await call('/payments/attach-to-order', customer, { orderId: String(pending._id), paymentData: { method: 'wallet', transactionId: walletReceipt } })).status, 409);
    await require('../services/orderStatus.service').applyOrderStatus(pending, 'cancelled', { actorId: customer });
    const debit = await call('/wallet/pay', customer, { amount: 100 }, { 'Idempotency-Key': 'late-receipt' });
    const details = { method: 'wallet', transactionId: debit.body.data.transactionId };
    assert.equal((await call('/payments/attach-to-order', customer, { orderId: String(pending._id), paymentData: details })).status, 409);
    assert.equal((await Order.findById(pending._id).lean()).status, 'cancelled');
    assert.equal((await require('../models/SubProduct').findById(sp).lean()).reservedStock, before - 1);
    assert.equal((await Claim.findOne({ order: pending._id }).lean()).state, 'needs_review');
  });
  await t.test('mixed merchant status and payment actions cannot mutate the parent', async () => {
    for (const [endpoint, body] of [['status', { status: 'shipped' }], ['payment', { action: 'mark_paid' }], ['payment', { action: 'mark_refunded' }]]) {
      const res = await call(`/orders/${mixed._id}/${endpoint}`, merchant, body, {}, 'PUT');
      assert.equal(res.status, 409, JSON.stringify(res.body));
    }
    assert.equal((await Order.findById(mixed._id).lean()).status, 'pending');
  });
  await t.test('hosted frontend contract survives signed callback and order-create replay with one accounting entry', async () => {
    const axios = require('axios'); let trusted, reference;
    process.env.KORAPAY_SECRET_KEY = 'fixture-only-korapay';
    t.mock.method(axios, 'post', async (url, body) => { trusted = body.metadata; reference = body.reference; return { data: { status: true, data: { reference, checkout_url: 'https://checkout.example.test' } } }; });
    t.mock.method(axios, 'get', async () => ({ data: { status: true, data: { reference, status: 'success', amount: 3100, currency: 'NGN', metadata: trusted, payment_method: 'card' } } }));
    const init = await call('/payments/korapay/initialize', customer, { amount: 3100, email: 'buyer@example.test', metadata: { kind: 'wallet_fund', userId: String(stranger) } }, { 'Idempotency-Key': 'hosted-one' });
    assert.equal(init.status, 200, JSON.stringify(init.body));
    assert.equal(trusted.kind, 'marketplace_order'); assert.equal(trusted.userId, String(customer));
    const again = await call('/payments/korapay/initialize', customer, { amount: 3100, email: 'buyer@example.test' }, { 'Idempotency-Key': 'hosted-one' });
    assert.equal(again.body.data.reference, reference);
    const event = { event: 'charge.success', data: { reference } };
    const signature = require('node:crypto').createHmac('sha256', process.env.KORAPAY_SECRET_KEY).update(JSON.stringify(event.data)).digest('hex');
    assert.equal((await call('/payments/webhooks/korapay', null, event, { 'x-korapay-signature': signature })).status, 200);
    const body = { customer: { firstName: 'Buyer', lastName: 'One', email: 'buyer@example.test', phone: '08000000000' },
      shipping: { address: 'Address', city: 'Abuja', state: 'FCT', zipCode: '900001', country: 'Nigeria' }, shippingFee: 3000,
      paymentMethod: 'card', paymentDetails: { method: 'korapay', reference }, status: 'processing', paymentStatus: 'paid',
      items: [{ productId: String(product), subProductId: String(sp), quantity: 1, price: 100 }], subtotal: 100, total: 3100 };
    const created = await call('/orders', customer, body, { 'Idempotency-Key': 'hosted-order-one' });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal(created.body.data.order.paymentStatus, 'paid');
    const replay = await call('/orders', customer, body, { 'Idempotency-Key': 'hosted-order-one' });
    assert.equal(replay.status, 200); assert.equal(replay.body.data.order._id, created.body.data.order._id);
    await call('/payments/webhooks/korapay', null, event, { 'x-korapay-signature': signature });
    assert.equal(await require('../models/JournalEntry').countDocuments({ refDoc: created.body.data.order._id, entryType: 'sales_revenue' }), 1);
    assert.equal((await call('/payments/webhooks/korapay', null, event, { 'x-korapay-signature': 'bad' })).status, 401);
    const balanceBefore = (await User.findById(customer).lean()).platformWalletBalance;
    assert.equal((await call('/wallet/fund/verify', customer, { reference })).status, 409);
    assert.equal((await User.findById(customer).lean()).platformWalletBalance, balanceBefore);
    const unfunded = await require('../models/GiftCard').create({ initialAmount: 500, purchasedBy: customer, balance: 0, status: 'pending_payment', paymentRef: 'other-gift-reference' });
    assert.equal((await call('/gift-cards/purchase/verify', customer, { reference, giftCardId: String(unfunded._id) })).status, 409);
    delete process.env.KORAPAY_SECRET_KEY;
  });
  await t.test('stored-value funding credits and issues once after purpose-bound verification', async () => {
    const axios = require('axios'); const saved = new Map();
    t.mock.method(axios, 'post', async (url, body) => { saved.set(body.reference, body); return { data: { status: true, data: { reference: body.reference, checkout_url: 'https://checkout.example.test' } } }; });
    t.mock.method(axios, 'get', async url => { const body = saved.get(url.split('/').pop()); return { data: { status: true, data: { ...body, status: 'success', amount: body.amount, metadata: body.metadata } } }; });
    const service = require('../services/storedValueFunding');
    await service.initialize({ user: customer, amount: 500, reference: 'wallet-funding-fixture', kind: 'wallet_fund', email: 'buyer@example.test' });
    const before = (await User.findById(customer).lean()).platformWalletBalance;
    await assert.rejects(service.wallet('wallet-funding-fixture', stranger), e => e.statusCode === 409);
    const responses = await Promise.all([1, 2].map(() => call('/wallet/fund/verify', customer, { reference: 'wallet-funding-fixture' })));
    assert.deepEqual(responses.map(r => r.status), [200, 200]);
    assert.equal((await User.findById(customer).lean()).platformWalletBalance, before + 500);
    assert.equal(await Wallet.countDocuments({ paymentRef: 'wallet-funding-fixture' }), 1);
    const card = await require('../models/GiftCard').create({ initialAmount: 500, balance: 0, purchasedBy: customer, status: 'pending_payment', paymentRef: 'gift-funding-fixture' });
    await service.initialize({ user: customer, amount: 500, reference: 'gift-funding-fixture', kind: 'gift_card_purchase', target: card._id, email: 'buyer@example.test' });
    const issues = await Promise.all([1, 2].map(() => call('/gift-cards/purchase/verify', customer, { reference: 'gift-funding-fixture', giftCardId: String(card._id) })));
    assert.deepEqual(issues.map(r => r.status), [200, 200]);
    assert.equal((await require('../models/GiftCard').findById(card._id).lean()).balance, 500);
    assert.equal(await require('../models/GiftCardTransaction').countDocuments({ giftCardId: card._id, type: 'issue' }), 1);
  });
  await t.test('authorized refund is once-only and does not restock merchandise', async () => {
    const target = await Order.create({ ...data(80), paymentStatus: 'paid', status: 'confirmed', paymentReference: 'pi_phase_a', paymentMethod: 'card' });
    await Claim.create({ _id: 'stripe:platform:pi_phase_a', provider: 'stripe', reference: 'pi_phase_a', user: customer, amount: 100, currency: 'NGN', state: 'allocated', order: target._id });
    const stock = await require('../models/SubProduct').findById(sp).lean(); let calls = 0;
    process.env.STRIPE_SECRET_KEY = 'sk_test_phase_a_fixture';
    t.mock.method(require('stripe').resources.Refunds.prototype, 'create', async (args, options) => { calls++; assert.equal(options.idempotencyKey, `refund:${target._id}`); return { id: 're_fixture', status: 'succeeded', amount: 10000, currency: 'ngn' }; });
    const responses = await Promise.all([1, 2].map(() => call('/payments/refund', admin, { orderId: String(target._id) })));
    assert.equal(responses.filter(r => r.status === 200).length >= 1, true);
    assert.equal(calls, 1);
    assert.equal((await call('/payments/refund', admin, { orderId: String(target._id) })).status, 200);
    assert.equal(calls, 1);
    const after = await require('../models/SubProduct').findById(sp).lean();
    assert.equal(after.totalStock, stock.totalStock); assert.equal(after.reservedStock, stock.reservedStock);
    delete process.env.STRIPE_SECRET_KEY;
  });
  await t.test('guest COD creation retries once and its signed proof authorizes only that order', async () => {
    const body = { customer: { firstName: 'Guest', lastName: 'Buyer', email: 'guest@example.test', phone: '08000000000' },
      shipping: { address: 'Address', city: 'Abuja', state: 'FCT', zipCode: '900001', country: 'Nigeria' }, shippingFee: 3000,
      paymentMethod: 'cash_on_delivery', items: [{ productId: String(product), subProductId: String(sp), quantity: 1, price: 100 }], subtotal: 100, total: 3100 };
    const responses = await Promise.all([1, 2].map(() => call('/orders', null, body, { 'Idempotency-Key': 'guest-cod-one' })));
    assert.deepEqual(responses.map(r => r.status).sort(), [200, 201]);
    const orderId = responses[0].body.data.order._id;
    assert.equal(responses[1].body.data.order._id, orderId);
    assert.equal(responses[0].body.data.order.paymentStatus, 'pending');
    const proof = responses[0].body.data.guestAccessToken;
    assert.equal((await call(`/orders/${orderId}`, null, undefined, { 'X-Order-Access': proof })).status, 200);
    assert.equal((await call(`/orders/${paid._id}`, null, undefined, { 'X-Order-Access': proof })).status, 404);
    assert.equal((await call(`/orders/${orderId}?email=guest@example.test`, null)).status, 404);
  });
  await t.test('COD collection can be recorded by an authorized operator after delivery', async () => {
    const cod = await trust.createOrder({ ...data(95), paymentMethod: 'cash_on_delivery', status: 'confirmed' }, [], null, { _id: customer }, 'cod-collection');
    const status = require('../services/orderStatus.service');
    await status.applyOrderStatus(cod, 'shipped', { actorId: merchant, tenantId: a });
    await status.applyOrderStatus(cod, 'delivered', { actorId: merchant, tenantId: a });
    const collected = await call(`/orders/${cod._id}/payment`, merchant, { action: 'mark_paid', reference: 'cash-received' }, {}, 'PUT');
    assert.equal(collected.status, 200, JSON.stringify(collected.body));
    assert.equal((await Order.findById(cod._id).lean()).paymentStatus, 'paid');
  });
  await t.test('forged public order lifecycle cannot settle or reserve inventory', async () => {
    const body = { customer: { firstName: 'Guest', lastName: 'Buyer', email: 'guest@example.test', phone: '08000000000' },
      shipping: { address: 'Address', city: 'Abuja', state: 'FCT', zipCode: '900001', country: 'Nigeria' },
      paymentMethod: 'cash_on_delivery', items: [{ productId: String(product), subProductId: String(sp), quantity: 1, price: 100 }], subtotal: 100, total: 100 };
    const before = await Order.countDocuments();
    for (const status of ['confirmed', 'shipped', 'delivered', 'refunded']) {
      assert.equal((await call('/orders', null, { ...body, status, paymentStatus: 'paid' })).status, 400);
    }
    assert.equal(await Order.countDocuments(), before);
  });
});
