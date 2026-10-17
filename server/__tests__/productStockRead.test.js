'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Product = require('../models/Product');
const SubProduct = require('../models/SubProduct');
const Size = require('../models/Size');
const Tenant = require('../models/Tenant');
const { getProductStock } = require('../services/product-stock.service');
const chain = (data) => ({
  select() {
    return this;
  },
  lean: async () => data,
});
test('cross-tenant size references remain unknown and private pricing fields are not returned', async (t) => {
  t.mock.method(Product, 'exists', async () => ({ _id: 'p' }));
  t.mock.method(SubProduct, 'find', () =>
    chain([
      {
        _id: 'sp',
        tenant: 'a',
        sizes: ['foreign', 'valid'],
        costPrice: 999,
        vendorEmail: 'private@example.com',
      },
    ])
  );
  t.mock.method(Size, 'find', () =>
    chain([
      {
        _id: 'foreign',
        subproduct: 'sp',
        tenant: 'b',
        stock: 99,
        reservedStock: 9,
      },
      {
        _id: 'valid',
        subproduct: 'sp',
        tenant: 'a',
        stock: 4,
        reservedStock: 1,
        availableStock: 3,
        costPrice: 100,
      },
    ])
  );
  t.mock.method(Tenant, 'find', () =>
    chain([{ _id: 'a', name: 'A', contactEmail: 'private@example.com' }])
  );
  const product = await getProductStock('p', 'a');
  assert.deepEqual(product.subProducts[0].sizes[0], { _id: 'foreign' });
  assert.equal(product.subProducts[0].sizes[1].reservedStock, 1);
  assert.doesNotMatch(
    JSON.stringify(product),
    /costPrice|contactEmail|vendorEmail|private@example/
  );
});
test('unknown product is a not-found error, not zero stock', async (t) => {
  t.mock.method(Product, 'exists', async () => null);
  await assert.rejects(getProductStock('missing', 'a'), { statusCode: 404 });
});
test('reservation stock reads scope listing and size queries to the same tenant and listing', async (t) => {
  t.mock.method(Product, 'exists', async () => ({ _id: 'p' }));
  let listingQuery, sizeQuery;
  t.mock.method(SubProduct, 'find', (query) => {
    listingQuery = query;
    return chain([
      {
        _id: 'sp',
        tenant: 'a',
        sku: 'A',
        status: 'active',
        totalStock: 0,
        reservedStock: 0,
        sizes: ['s'],
      },
    ]);
  });
  t.mock.method(Size, 'find', (query) => {
    sizeQuery = query;
    return chain([
      {
        _id: 's',
        subproduct: 'sp',
        tenant: 'a',
        size: '70cl',
        stock: 10,
        reservedStock: 3,
        availableStock: 7,
      },
    ]);
  });
  t.mock.method(Tenant, 'find', () => chain([{ _id: 'a', name: 'Tenant A' }]));
  const product = await getProductStock('p', 'a');
  assert.deepEqual(listingQuery, { product: 'p', tenant: 'a' });
  assert.deepEqual(sizeQuery, {
    _id: { $in: ['s'] },
    $or: [{ subproduct: 'sp', tenant: 'a' }],
  });
  assert.equal(product.subProducts[0].sizes[0].reservedStock, 3);
  assert.equal(
    product.subProducts[0].totalStock,
    undefined,
    'size-backed listings must not use stale aggregate defaults'
  );
  assert.equal(product.subProducts[0].tenant.name, 'Tenant A');
});
test('platform-wide read preserves unknown missing sizes and restricts every size to its owning tenant', async (t) => {
  t.mock.method(Product, 'exists', async () => ({ _id: 'p' }));
  t.mock.method(SubProduct, 'find', () =>
    chain([
      { _id: 'one', tenant: 'a', sizes: ['missing'] },
      {
        _id: 'two',
        tenant: 'b',
        sizes: [],
        totalStock: 8,
        reservedStock: 2,
        availableStock: 6,
      },
    ])
  );
  let query;
  t.mock.method(Size, 'find', (value) => {
    query = value;
    return chain([]);
  });
  t.mock.method(Tenant, 'find', () => chain([]));
  const product = await getProductStock('p', null);
  assert.deepEqual(query.$or, [{ subproduct: 'one', tenant: 'a' }]);
  assert.equal(product.subProducts[0].sizes[0]._id, 'missing');
  assert.equal(product.subProducts[0].sizes[0].stock, undefined);
  assert.equal(product.subProducts[1].reservedStock, 2);
});
