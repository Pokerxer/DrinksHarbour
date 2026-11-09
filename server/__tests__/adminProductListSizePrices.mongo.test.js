'use strict';
// Central /product admin list cards must price products by their SIZE rows:
// the min–max across every listing's size sellingPrice, with the listing's
// baseSellingPrice as the fallback when no size carries a price (single-unit
// mode). Mirrors the /sub-products card rule (docs/memory/toolbar-size-price.md).
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { uri, connectVenueMongo } = require('./helpers/venueMongo');

test('getAdminProductList quotes size prices, not base defaults', { skip: !uri }, async t => {
  await connectVenueMongo(t, 'admin_product_size_prices');
  const oid = () => new mongoose.Types.ObjectId();
  const tenant = oid();

  await require('../models/Tenant').collection.insertOne({
    _id: tenant, status: 'approved', subscriptionStatus: 'active', revenueModel: 'commission', commissionPercentage: 0,
  });

  const Product = require('../models/Product');
  const SubProduct = require('../models/SubProduct');
  const Size = require('../models/Size');
  const service = require('../services/product.service');

  const sized = oid();       // sizes at 2500 and 5000 — must win over any base
  const unsized = oid();     // no sizes — base 750 is the quote
  const mixed = oid();       // one priced size (1800) AND a base 9999 — size wins

  await Product.collection.insertMany([
    { _id: sized, name: 'Sized Bottle', slug: 'sized-bottle', type: 'beer', status: 'approved' },
    { _id: unsized, name: 'Plain Bottle', slug: 'plain-bottle', type: 'beer', status: 'approved' },
    { _id: mixed, name: 'Mixed Bottle', slug: 'mixed-bottle', type: 'beer', status: 'approved' },
  ]);

  const sizedSub = oid();
  await SubProduct.collection.insertOne({
    _id: sizedSub, tenant, product: sized, sku: 'SIZED_SUB',
    costPrice: 1000, baseSellingPrice: 10000, status: 'active',
  });
  await Size.collection.insertMany([
    { subproduct: sizedSub, tenant, size: '35cl', sellingPrice: 2500, currency: 'NGN' },
    { subproduct: sizedSub, tenant, size: '75cl', sellingPrice: 5000, currency: 'NGN' },
  ]);

  await SubProduct.collection.insertOne({
    _id: oid(), tenant, product: unsized, sku: 'PLAIN_SUB',
    costPrice: 300, baseSellingPrice: 750, status: 'active',
  });

  const mixedSub = oid();
  await SubProduct.collection.insertOne({
    _id: mixedSub, tenant, product: mixed, sku: 'MIXED_SUB',
    costPrice: 900, baseSellingPrice: 9999, status: 'active',
  });
  await Size.collection.insertOne({
    subproduct: mixedSub, tenant, size: '35cl', sellingPrice: 1800, currency: 'NGN',
  });

  const { products: items } = await service.getAdminProductList({ limit: 100 });
  const byName = Object.fromEntries(items.map(row => [row.name, row]));

  assert.deepEqual(
    { price: byName['Sized Bottle'].price, priceMax: byName['Sized Bottle'].priceMax, currency: byName['Sized Bottle'].priceCurrency },
    { price: 2500, priceMax: 5000, currency: 'NGN' },
    'priced sizes must define the card range'
  );
  assert.equal(byName['Plain Bottle'].price, 750, 'sizeless listing quotes its base price');
  assert.equal(byName['Plain Bottle'].priceMax, undefined);
  assert.equal(byName['Mixed Bottle'].price, 1800, 'a priced size beats the base default');
  assert.equal(byName['Mixed Bottle'].priceMax, undefined);
});
