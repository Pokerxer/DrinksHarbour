'use strict';
// Dedicated local, disposable database only. Never loads .env or application data.
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { searchProducts, getProductBySlug } = require('../../services/product.service');
const dbName = 'drinks_proximity_test_' + process.pid;
const oid = () => new mongoose.Types.ObjectId();
async function main() {
  await mongoose.connect('mongodb://127.0.0.1:27028/' + dbName, { serverSelectionTimeoutMS: 3000, autoIndex: false });
  const db = mongoose.connection.db;
  const tenants = [
    { _id: oid(), name: 'Near', location: { lat: 0, lon: .1 } },
    { _id: oid(), name: 'Far', location: { lat: 0, lon: 2 } },
    { _id: oid(), name: 'Middle', location: { lat: 0, lon: .2 } },
    { _id: oid(), name: 'Unknown', location: { lat: null, lon: null } },
  ];
  await db.collection('tenants').insertMany(tenants.map(row => ({ ...row, slug: row.name.toLowerCase(),
    status: 'approved', subscriptionStatus: 'active', revenueModel: 'commission', commissionPercentage: 0 })));
  const insert = async (name, entries) => {
    const product = oid();
    await db.collection('products').insertOne({ _id: product, name, slug: name, status: 'approved',
      isPublished: true, platformMarkup: 0, images: [], tags: [], flavors: [] });
    for (const entry of entries) {
      const subproduct = oid(), size = oid();
      await db.collection('subproducts').insertOne({ _id: subproduct, product, tenant: tenants[entry.tenant]._id,
        status: entry.stock === 0 ? 'out_of_stock' : 'active', isPublished: true, sizes: [size],
        isOnSale: entry.sale === true, saleType: 'flash_sale', saleDiscountValue: 20 });
      await db.collection('sizes').insertOne({ _id: size, subproduct, size: '750ml', sellingPrice: entry.price,
        costPrice: 1000, stock: entry.stock ?? 10, availableStock: entry.stock ?? 10,
        status: 'active', availability: entry.stock === 0 ? 'out_of_stock' : 'available', isDefault: true });
    }
    return product;
  };
  await insert('a', [{ tenant: 0, price: 10000 }, { tenant: 1, price: 6000, sale: true }]);
  await insert('b', [{ tenant: 2, price: 15000 }]);
  await insert('c', [{ tenant: 3, price: 6000 }]);
  await insert('d', [{ tenant: 0, price: 5000, stock: 0 }, { tenant: 1, price: 30000 }]);
  const query = { shoppingLocation: { lat: 0, lon: 0 }, useEmbeddings: false, fields: 'card', limit: 2 };
  const first = await searchProducts(query);
  const second = await searchProducts({ ...query, page: 2 });
  assert.deepEqual(first.products.map(p => p.name), ['a', 'b']);
  assert.deepEqual(second.products.map(p => p.name), ['d', 'c']);
  assert.equal(first.pagination.totalResults, 4);
  const flipped = await searchProducts({ ...query, shoppingLocation: { lat: 0, lon: 2 } });
  assert.equal(flipped.products[0].name, 'a'); // A and D share Far; stable Product ID breaks ties.
  const filtered = await searchProducts({ ...query, minPrice: 4500, maxPrice: 5000 });
  assert.equal(filtered.products[0].shoppingOffer.tenantId, String(tenants[1]._id));
  assert.equal(filtered.pagination.totalResults, 1);
  const sale = await searchProducts({ ...query, saleType: 'flash_sale' });
  assert.equal(sale.products[0].shoppingOffer.tenantId, String(tenants[1]._id));
  const detail = await getProductBySlug('a', { shoppingLocation: query.shoppingLocation });
  assert.equal(detail.shoppingOffer.price, first.products[0].shoppingOffer.price);
  const scoped = await searchProducts({ ...query, tenantId: String(tenants[2]._id) });
  assert.deepEqual(scoped.products.map(p => p.name), ['b']);
  for (const product of first.products) {
    assert.equal('_sellerLocation' in product.availableAt[0], false);
    assert.equal('location' in product.availableAt[0].tenant, false);
  }
  const products = [], subproducts = [], sizes = [];
  for (let i = 0; i < 700; i++) {
    const product = oid(), subproduct = oid(), size = oid();
    products.push({ _id: product, name: 'Load ' + i, slug: 'load-' + i, status: 'approved', isPublished: true,
      platformMarkup: 0, images: [], tags: [], flavors: [] });
    subproducts.push({ _id: subproduct, product, tenant: tenants[i % 3]._id, status: 'active', isPublished: true, sizes: [size] });
    sizes.push({ _id: size, subproduct, size: '750ml', sellingPrice: 10000, costPrice: 1000,
      stock: 10, availableStock: 10, status: 'active', availability: 'available' });
  }
  await db.collection('products').insertMany(products);
  await db.collection('subproducts').insertMany(subproducts);
  await db.collection('sizes').insertMany(sizes);
  await db.collection('subproducts').createIndex({ product: 1 });
  await db.collection('sizes').createIndex({ subproduct: 1 });
  const started = performance.now(), heap = process.memoryUsage().heapUsed;
  const load = await searchProducts({ ...query, limit: 24 });
  assert.equal(load.pagination.totalResults, 704);
  console.log(JSON.stringify({ candidates: 704, returned: load.products.length,
    elapsedMs: Math.round(performance.now() - started), heapDeltaMb: +(Math.max(0, process.memoryUsage().heapUsed - heap) / 1048576).toFixed(2),
    assertions: 'pagination, qualifying prices, sale offers, detail parity, tenant scope, hidden coordinates' }));
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (mongoose.connection.readyState === 1) await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});
