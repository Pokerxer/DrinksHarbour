const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const SubProduct = require('../models/SubProduct');
const Size = require('../models/Size');
const Product = require('../models/Product');
const Tenant = require('../models/Tenant');
const Coupon = require('../models/Coupon');
const stock = require('../services/storefrontStock');
const { createOrder } = require('../controllers/order.controller');
const oid = () => new mongoose.Types.ObjectId();
const query = value => ({ select() { return this; }, lean: async () => value });
async function checkout(t, { foreign = false, omitSize = false, sellWithoutSizeVariants = false } = {}) {
  const tenant = oid(), sp = oid(), size = oid(), product = oid();
  const sibling = oid(), session = {};
  const rows = new Map([[String(size), { stock: 6, availableStock: 6, reservedStock: 0 }],
    [String(sibling), { stock: 8, availableStock: 8, reservedStock: 0 }]]);
  // Mocked database fixture: real request recovery is covered by the HTTP/Mongo suite.
  t.mock.method(require('../services/marketCheckoutRecovery'), 'recover', async () => null);
  t.mock.method(Order, 'countDocuments', async () => 0);
  t.mock.method(SubProduct, 'find', () => ({
    select(fields) {
      return query([{ _id: sp, tenant, product, costPrice: 90000, baseSellingPrice: 100000, defaultSize: sibling,
        ...(fields.split(' ').includes('sellWithoutSizeVariants') ? { sellWithoutSizeVariants } : {}) }]);
    },
  }));
  t.mock.method(Size, 'find', () => query([{ _id: size, tenant: foreign ? oid() : tenant, subproduct: sp, costPrice: 90000, sellingPrice: 100000, sellingPriceMarkupOverridePct: 25 }]));
  t.mock.method(Tenant, 'find', () => query([{ _id: tenant, revenueModel: 'selling_price_markup', sellingPriceMarkupPercentage: 20, commissionPercentage: 13 }]));
  t.mock.method(Product, 'find', () => query([{ _id: product, platformMarkup: 80 }]));
  t.mock.method(Coupon, 'findOne', async () => ({ _id: oid(), allowedUsers: [], firstPurchaseOnly: false, isValid: true, calculateDiscount: () => 10000 }));
  const parentWrite = t.mock.method(SubProduct, 'updateOne', async (filter, update, options) => {
    assert.equal(filter.tenant, String(tenant));
    assert.equal(filter._id, String(sp));
    assert.equal(options.session, session);
    return { modifiedCount: filter.sellWithoutSizeVariants === true && !sellWithoutSizeVariants ? 0 : 1 };
  });
  t.mock.method(Size, 'exists', () => ({ session: async () => null }));
  const sizeWrite = t.mock.method(Size, 'updateOne', async (filter, { $inc }, options) => {
    assert.equal(filter.tenant, String(tenant));
    assert.equal(filter.subproduct, String(sp));
    assert.equal(options.session, session);
    const row = rows.get(String(filter._id));
    for (const [field, delta] of Object.entries($inc)) row[field] += delta;
    return { modifiedCount: 1 };
  });
  let captured, failure, response;
  const stop = new Error('stop before database write');
  t.mock.method(require('../services/marketplacePaymentTrust'), 'createOrder', async data => { captured = data; await stock.reserveStock(data.items, session); throw stop; });
  const res = { status() { return this; }, json(value) { response = value; } };
  await createOrder({ get: () => 'pricing-test', body: { items: [{ productId: product.toString(), subProductId: sp.toString(), ...(!omitSize ? { sizeId: String(size) } : {}), quantity: 2, price: 1 }],
    customer: { firstName: 'Ada', lastName: 'O', email: 'ada@example.com', phone: '08012345678' },
    shipping: { address: 'Address', city: 'Abuja', state: 'FCT', country: 'Nigeria' },
    paymentMethod: 'bank_transfer', shippingFee: 10000, total: 1, couponCode: 'TEN' } }, res, error => { failure = error; });
  return { captured, failure, response, stop, selected: rows.get(String(size)), sibling: rows.get(String(sibling)), parentWrite, sizeWrite };
}
test('checkout snapshots the selling-price markup split including product override and calculates its total on the server', async t => {
  const { captured, failure, stop, selected, sibling, sizeWrite } = await checkout(t);
  assert.equal(failure, stop);
  assert.equal(captured.items[0].priceAtPurchase, 125000);
  assert.equal(captured.items[0].revenueBasisAmount, 240000);
  assert.equal(captured.items[0].tenantRevenueShare, 200000);
  assert.equal(captured.items[0].platformCommission, 40000);
  assert.equal(captured.items[0].revenueRateAtPurchase, 25);
  assert.equal(captured.totalAmount, 250000);
  assert.deepEqual(selected, { stock: 4, availableStock: 4, reservedStock: 2 });
  assert.deepEqual(sibling, { stock: 8, availableStock: 8, reservedStock: 0 });
  assert.equal(sizeWrite.mock.callCount(), 1);
});
test('checkout refuses a foreign tenant size instead of pricing the listing with its data', async t => {
  const { captured, response } = await checkout(t, { foreign: true });
  assert.equal(captured, undefined);
  assert.match(response.message, /unavailable|belong/i);
});

test('marketplace checkout refuses an omitted variant before any stock write', async t => {
  const { response, captured, parentWrite, sizeWrite } = await checkout(t, { omitSize: true });
  assert.match(response?.message ?? '', /select.*variant/i);
  assert.equal(captured, undefined);
  assert.equal(parentWrite.mock.callCount(), 0);
  assert.equal(sizeWrite.mock.callCount(), 0);
});

test('explicit sizeless checkout reserves only listing stock even with a default Unit row', async t => {
  const { captured, failure, stop, parentWrite, sizeWrite } = await checkout(t, { omitSize: true, sellWithoutSizeVariants: true });
  assert.equal(failure, stop);
  assert.equal(captured.items[0].size, null);
  assert.equal(parentWrite.mock.callCount(), 1);
  assert.equal(parentWrite.mock.calls[0].arguments[0].sellWithoutSizeVariants, true);
  assert.deepEqual(parentWrite.mock.calls[0].arguments[1].$inc, { totalStock: -2, availableStock: -2, reservedStock: 2 });
  assert.equal(sizeWrite.mock.callCount(), 0);
});

test('stock reservation rejects a sizeless line if listing mode changed after checkout validation', async t => {
  t.mock.method(SubProduct, 'updateOne', async filter => ({ modifiedCount: filter.sellWithoutSizeVariants === true ? 0 : 1 }));
  await assert.rejects(stock.reserveStock([{ tenant: oid(), subproduct: oid(), quantity: 1 }], {}), { statusCode: 409 });
});
