// __tests__/cartSyncDedup.mongo.test.js
//
// The rule this file exists to protect: saving or merging a cart can NEVER
// inflate a line's quantity. The 2026-11-14 report: one Jameson from Wyn City
// turned into 2 "on its own" after a while — syncCart runs addToCart per
// payload entry, so a payload holding the same offer under TWO ids (a legacy
// `-default` id from a stale guest mirror + the current colorless id — the
// pre-2026-11-13 cart-identity scheme) summed 1+1=2; and two overlapping
// syncCart calls (merge + debounced save) interleave clear/add/add.
//
// Run:
//   DRINKSHARBOUR_DIRECT_TEST_MONGO_URI='mongodb://127.0.0.1:29128/drinks_direct_test_global?replicaSet=storefrontDirect' \
//     node --test __tests__/cartSyncDedup.mongo.test.js

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const uri = process.env.DRINKSHARBOUR_DIRECT_TEST_MONGO_URI;

test('syncCart collapses duplicate offers in the payload and writes each line once', { skip: !uri }, async t => {
  assert.match(uri, /^mongodb:\/\/127\.0\.0\.1:29128\/drinks_direct_test_[\w]+\?replicaSet=storefrontDirect$/);
  await mongoose.connect(uri.replace('?', `_${process.pid}_sync?`), { serverSelectionTimeoutMS: 8000 });
  t.after(async () => { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });

  const oid = () => new mongoose.Types.ObjectId();
  const [user, tenant, product, subproduct, size, warehouse] = Array.from({ length: 6 }, oid);
  await mongoose.connection.db.collection('tenants').insertOne({
    _id: tenant, slug: 'sync-tenant', status: 'approved', subscriptionStatus: 'active',
    revenueModel: 'commission', commissionPercentage: 13,
  });
  await mongoose.connection.db.collection('products').insertOne({ _id: product, slug: 'jameson-sync', status: 'approved', tracksBatch: false, type: 'spirit' });
  await mongoose.connection.db.collection('subproducts').insertOne({ _id: subproduct, tenant, product, status: 'active', sku: 'JAM-1', baseSellingPrice: 9000 });
  await mongoose.connection.db.collection('sizes').insertOne({ _id: size, tenant, subproduct, status: 'active', size: '70cl', stock: 50, availableStock: 50, availability: 'available', sellingPrice: 9000, costPrice: 5000 });
  await mongoose.connection.db.collection('warehouses').insertOne({ _id: warehouse, tenant, code: 'WH', isActive: true });
  await mongoose.connection.db.collection('warehousestocks').insertOne({ tenant, warehouse, subProduct: subproduct, size, currentQuantity: 50, reservedQuantity: 0 });

  const cartService = require('../services/cart.service');
  const item = {
    productId: String(product), subProductId: String(subproduct), sizeId: String(size),
    tenantId: String(tenant), quantity: 1, price: 9000, size: '70cl', vendor: 'Wyn City', color: '',
  };

  // The payload a stale guest mirror produces: the SAME offer under the legacy
  // id scheme AND the current one.
  const result = await cartService.syncCart(String(user), [
    { ...item },                                        // current-scheme entry
    { ...item, vendor: 'Wyn City', size: '70cl' },      // same offer again (drifted mirror)
  ]);
  assert.equal(result.cart.items.length, 1, `one offer = one line (got ${result.cart.items.length})`);
  assert.equal(result.cart.items[0].quantity, 1, 'quantity must not sum across duplicate payload entries');
  assert.equal(result.results.added, 1);
});
