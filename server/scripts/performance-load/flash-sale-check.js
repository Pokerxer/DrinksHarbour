'use strict';
// Local temporary fixture only; never loads .env or touches an application DB.
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { searchProducts } = require('../../services/product.service');
const dbName = `drinks_flash_sale_test_${process.pid}`;
async function main() {
  await mongoose.connect(`mongodb://127.0.0.1:27017/${dbName}`, { serverSelectionTimeoutMS: 2000, autoIndex: false });
  const db = mongoose.connection.db;
  const tenant = new mongoose.Types.ObjectId();
  await db.collection('tenants').insertOne({ _id: tenant, name: 'Fixture shop', status: 'approved', subscriptionStatus: 'active', revenueModel: 'commission', commissionPercentage: 13 });
  const now = Date.now();
  const cases = Array.from({ length: 45 }, (_, i) => ({
    name: `Fixture ${String(i).padStart(2, '0')}`,
    isOnSale: i >= 20 || i === 8, saleType: i === 8 ? 'fixed' : 'flash_sale', saleDiscountValue: 15,
    ...(i === 40 ? { saleEndDate: new Date(now - 10000) } : {}),
    ...(i === 41 ? { saleStartDate: new Date(now + 60000) } : {}),
    ...(i === 42 ? { saleType: 'percentage' } : {}),
    ...(i === 43 ? { saleStartDate: new Date(now - 10000), saleEndDate: new Date(now + 60000) } : {}),
    ...(i === 44 ? { isOnSale: false } : {}),
  }));
  for (const item of cases) {
    const product = new mongoose.Types.ObjectId();
    const subproduct = new mongoose.Types.ObjectId();
    await db.collection('products').insertOne({ _id: product, name: item.name, slug: item.name.replaceAll(' ', '-'), status: 'approved', isPublished: true, tags: [], flavors: [], images: [], ...(item.name === 'Fixture 09' ? { platformDiscount: { type: 'percentage', value: 10 } } : {}) });
    await db.collection('subproducts').insertOne({ _id: subproduct, product, tenant, status: 'active', totalStock: 10, ...item });
    await db.collection('sizes').insertOne({ subproduct, size: '750ml', sellingPrice: 5000, costPrice: 3000, stock: 10, availableStock: 10, status: 'active', availability: 'available' });
  }
  const start = performance.now();
  const first = await searchProducts({ saleType: 'flash_sale', sortBy: 'name_asc', limit: 20, fields: 'card', useEmbeddings: false });
  assert.equal(first.products.length, 20);
  assert.equal(first.products[0].name, 'Fixture 20');
  assert.equal(first.pagination.totalResults, 21);
  assert.equal(first.pagination.isExactCount, true);
  const second = await searchProducts({ saleType: 'flash_sale', sortBy: 'name_asc', page: 2, limit: 20, fields: 'card', useEmbeddings: false });
  assert.deepEqual(second.products.map(p => p.name), ['Fixture 43']);
  assert.equal(second.products[0].availableAt[0].isOnSale, true);
  const general = await searchProducts({ onSale: true, sortBy: 'name_asc', limit: 20, fields: 'card', useEmbeddings: false });
  assert.equal(general.products.length, 20, 'general sales must be matched before pagination');
  assert.equal(general.pagination.totalResults, 24);
  assert.equal(general.pagination.isExactCount, true);
  assert.deepEqual(general.products.slice(0, 2).map(p => p.name), ['Fixture 08', 'Fixture 09']);
  console.log(JSON.stringify({ fixtureProducts: cases.length, eligibleSales: 21, firstPageCards: 20, secondPageCards: 1, exactCount: true, elapsedMs: performance.now() - start }));
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (mongoose.connection.readyState === 1) await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});
