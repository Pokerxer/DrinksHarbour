const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const SubProduct = require('../models/SubProduct');
const Size = require('../models/Size');
const Product = require('../models/Product');
const Tenant = require('../models/Tenant');
const Coupon = require('../models/Coupon');
const inventory = require('../services/inventory.service');
const { createOrder } = require('../controllers/order.controller');
const oid = () => new mongoose.Types.ObjectId();
const query = value => ({ select() { return this; }, lean: async () => value });
async function checkout(t, foreign = false) {
  const tenant = oid(), sp = oid(), size = oid(), product = oid();
  t.mock.method(Order, 'countDocuments', async () => 0);
  t.mock.method(SubProduct, 'find', () => query([{ _id: sp, tenant, product, costPrice: 6000, baseSellingPrice: 10000, isOnSale: true, saleType: 'fixed', saleDiscountValue: 1000 }]));
  t.mock.method(Size, 'find', () => query([{ _id: size, tenant: foreign ? oid() : tenant, subproduct: sp, costPrice: 6000, sellingPrice: 10000 }]));
  t.mock.method(Tenant, 'find', () => query([{ _id: tenant, revenueModel: 'commission', commissionPercentage: 13 }]));
  t.mock.method(Product, 'find', () => query([{ _id: product, platformMarkup: 80 }]));
  t.mock.method(Coupon, 'findOne', async () => ({ _id: oid(), allowedUsers: [], firstPurchaseOnly: false, isValid: true, calculateDiscount: () => 1800 }));
  t.mock.method(inventory, 'reserve', async () => ({ success: true }));
  t.mock.method(inventory, 'releaseReserve', async () => {});
  let captured, failure, response;
  const stop = new Error('stop before database write');
  t.mock.method(Order.prototype, 'save', async function () { captured = this.toObject(); throw stop; });
  const res = { status() { return this; }, json(value) { response = value; } };
  await createOrder({ body: { items: [{ productId: product.toString(), subProductId: sp.toString(), sizeId: size.toString(), quantity: 2, price: 1 }],
    customer: { firstName: 'Ada', lastName: 'O', email: 'ada@example.com', phone: '08012345678' },
    shipping: { address: 'Address', city: 'Abuja', state: 'FCT', country: 'Nigeria' },
    paymentMethod: 'bank_transfer', shippingFee: 10000, total: 1, couponCode: 'TEN' } }, res, error => { failure = error; });
  return { captured, failure, response, stop };
}
test('checkout snapshots the actual discounted commission split and calculates its total on the server', async t => {
  const { captured, failure, stop } = await checkout(t);
  assert.equal(failure, stop);
  assert.equal(captured.items[0].priceAtPurchase, 9000);
  assert.equal(captured.items[0].revenueBasisAmount, 16200);
  assert.equal(captured.items[0].tenantRevenueShare, 14094);
  assert.equal(captured.items[0].platformCommission, 2106);
  assert.equal(captured.items[0].revenueRateAtPurchase, 13);
  assert.equal(captured.totalAmount, 26200);
});
test('checkout refuses a foreign tenant size instead of pricing the listing with its data', async t => {
  const { captured, response } = await checkout(t, true);
  assert.equal(captured, undefined);
  assert.match(response.message, /unavailable|belong/i);
});
