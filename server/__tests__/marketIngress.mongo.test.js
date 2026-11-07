'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { uri, connectVenueMongo } = require('./helpers/venueMongo');
test('market ingress rejects new inactive-market orders before stock and filters offers before pagination', { skip: !uri }, async t => {
  await connectVenueMongo(t, 'market_ingress');
  process.env.MARKET_FOUNDATIONS_ENABLED = 'true';
  process.env.JWT_SECRET = 'global-market-fixture-only';
  t.after(() => { delete process.env.MARKET_FOUNDATIONS_ENABLED; });
  const Product = require('../models/Product'), SubProduct = require('../models/SubProduct'), Tenant = require('../models/Tenant'), Order = require('../models/Order');
  const oid = () => new mongoose.Types.ObjectId();
  const a = oid(), b = oid(), beverage = oid(), blocked = oid(), gift = oid(), sp = oid();
  await Tenant.collection.insertMany([a, b].map((_id, index) => ({ _id, name: `Merchant ${index}`, status: 'approved', subscriptionStatus: 'active', revenueModel: 'commission', commissionPercentage: 0 })));
  await Product.collection.insertMany([{ _id: blocked, name: 'A Blocked', type: 'beer' }, { _id: beverage, name: 'B Bottle', type: 'beer' }, { _id: gift, name: 'C Gift', type: 'gift_set' }].map(p => ({ ...p, status: 'approved', isPublished: true })));
  await SubProduct.collection.insertMany([{ _id: sp, product: beverage, tenant: a }, { _id: oid(), product: blocked, tenant: b }, { _id: oid(), product: gift, tenant: b }].map(p => ({ ...p, status: 'active', isPublished: true, availableStock: 20, totalStock: 20, reservedStock: 0, costPrice: 50, baseSellingPrice: 100 })));
  for (const module of ['email', 'sms', 'whatsapp']) {
    const transport = require(`../services/${module}.service`);
    for (const name of Object.keys(transport).filter(k => k.startsWith('send'))) if (typeof transport[name] === 'function') t.mock.method(transport, name, async () => ({ success: true }));
  }
  const express = require('express'), app = express(); app.use(express.json());
  app.use('/orders', require('../routes/order.routes'));
  app.use('/payments', require('../routes/payment.routes'));
  app.use('/wallet', require('../routes/wallet.routes'));
  app.use('/gift-cards', require('../routes/giftcard.routes'));
  app.use((err, req, res, next) => res.status(err.statusCode || 500).json({ message: err.message }));
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  await t.test('unknown market cannot create a COD order or reserve stock by direct HTTP call', async () => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'market-cod-fixture', 'x-market-code': 'GB' }, body: JSON.stringify({
      customer: { firstName: 'Guest', lastName: 'Buyer', email: 'guest@example.test', phone: '08000000000' },
      shipping: { address: 'Address', city: 'Abuja', state: 'FCT', zipCode: '900001', country: 'Nigeria' }, shippingFee: 3000,
      paymentMethod: 'cash_on_delivery', items: [{ productId: String(beverage), subProductId: String(sp), quantity: 1, price: 100, marketCategory: 'gift' }], subtotal: 100, total: 3100,
    }) });
    assert.ok([403, 404].includes(response.status), `expected inactive denial, got ${response.status}: ${await response.text()}`);
    assert.equal(await Order.countDocuments(), 0); assert.equal((await SubProduct.findById(sp).lean()).reservedStock, 0);
  });
  await t.test('unknown market cannot initialize a hosted charge or debit stored value', async subtest => {
    const user = oid();
    await require('../models/User').collection.insertOne({ _id: user, role: 'customer', status: 'active', email: 'buyer@fixture.test', platformWalletBalance: 1000 });
    const token = require('jsonwebtoken').sign({ userId: String(user) }, process.env.JWT_SECRET);
    let initialized = 0;
    const service = require('../services/payment.service');
    for (const method of ['createKorapayCharge', 'createPaystackTransaction', 'createStripePaymentIntent']) {
      t.mock.method(service, method, async () => { initialized++; throw new Error('Provider must not be called'); });
    }
    const card = await require('../models/GiftCard').create({ code:'MARKETTESTCARD', initialAmount:1000, balance:1000, status:'active', purchasedBy:user });
    for (const path of ['/payments/korapay/initialize', '/payments/paystack/initialize', '/payments/stripe/initialize', '/wallet/pay', '/gift-cards/pay-checkout']) {
      await subtest.test(path, async () => {
        const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Idempotency-Key': `market-preflight-${path}`, 'x-market-code': 'GB' }, body: JSON.stringify({ amount: 100, email: 'buyer@fixture.test', code:card.code, items: [{ subProductId: String(sp), quantity: 1 }] }) });
        assert.ok([403, 404].includes(response.status), `expected inactive denial, got ${response.status}: ${await response.text()}`);
      });
    }
    assert.equal(initialized, 0);
    assert.equal((await require('../models/User').findById(user).lean()).platformWalletBalance, 1000);
    assert.equal((await require('../models/GiftCard').findById(card._id).lean()).balance,1000);
    assert.equal(await require('../models/CheckoutDebit').countDocuments(),0);
    assert.equal(await require('../models/MarketplacePaymentClaim').countDocuments(),0);
  });
  await t.test('active-market collection works and deactivation preserves exact-key recovery without another financial effect', async () => {
    const Country=require('../models/CountryConfiguration'), User=require('../models/User');
    await Country.collection.insertOne({code:'NG',name:'Nigeria',currency:'NGN',locale:'en-NG',timezones:['Africa/Lagos'],active:true,version:1,capabilities:{marketplace:true,storefront:true,erm:true}});
    await require('../models/SalesChannel').collection.insertOne({tenant:null,kind:'marketplace',market:'NG',code:'SYNTHETIC_NG',currency:'NGN',version:1,active:true,legalOwner:{type:'platform',reference:'synthetic-only'},paymentOwner:{type:'platform',reference:'synthetic-only',provider:'korapay',account:'platform'},allowedPaymentOwners:[{type:'platform',reference:'synthetic-only',provider:'wallet',account:'platform'}],pricingPolicy:{code:'SYNTHETIC_TERMS',version:1,termsReference:'synthetic-contract'}});
    const user=oid();await User.collection.insertOne({_id:user,role:'customer',status:'active',email:'recover@fixture.test',platformWalletBalance:1000});
    const token=require('jsonwebtoken').sign({userId:String(user)},process.env.JWT_SECRET);
    let calls=0;t.mock.method(require('../services/payment.service'),'createKorapayCharge',async(amount,email,metadata,options)=>{calls++;return {reference:options.reference,authorizationUrl:'https://fixture.invalid/recover'};});
    const call=async(path,key)=>{const response=await fetch(`http://127.0.0.1:${server.address().port}${path}`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json','Idempotency-Key':key,'x-market-code':'NG'},body:JSON.stringify({amount:100,email:'recover@fixture.test'})});return {status:response.status,body:await response.json()};};
    const hosted=await call('/payments/korapay/initialize','recover-provider');assert.equal(hosted.status,200);assert.equal(calls,1);
    const debit=await call('/wallet/pay','recover-wallet');assert.equal(debit.status,200);assert.equal((await User.findById(user).lean()).platformWalletBalance,900);
    await Country.collection.updateOne({code:'NG'},{$set:{active:false}});
    assert.equal((await call('/payments/korapay/initialize','new-denied')).status,403);
    assert.equal((await call('/wallet/pay','new-wallet-denied')).status,403);
    const hostedReplay=await call('/payments/korapay/initialize','recover-provider');assert.equal(hostedReplay.status,200);assert.equal(hostedReplay.body.data.reference,hosted.body.data.reference);assert.equal(calls,1);
    const debitReplay=await call('/wallet/pay','recover-wallet');assert.equal(debitReplay.status,200);assert.equal(debitReplay.body.data.transactionId,debit.body.data.transactionId);assert.equal((await User.findById(user).lean()).platformWalletBalance,900);
  });
  await t.test('ineligible first result cannot occupy a page or leak through nested seller rows', async () => {
    const catalog = require('../services/marketCatalog');
    const rows = await Product.aggregate(catalog.productPipeline([{ $sort: { name: 1 } }, { $facet: { rows: [{ $limit: 1 }, { $lookup: { from: 'subproducts', localField: '_id', foreignField: 'product', as: 'offers' } }], count: [{ $count: 'total' }] } }], { beverage: [a], gift: [b], food: [] }));
    assert.equal(rows[0].count[0].total, 2); assert.equal(String(rows[0].rows[0]._id), String(beverage));
    assert.deepEqual(rows[0].rows[0].offers.map(row => String(row.tenant)), [String(a)]);
  });
});
