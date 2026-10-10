'use strict';
const { Types } = require('mongoose');
const crypto = require('node:crypto');
const oid = number => new Types.ObjectId(number.toString(16).padStart(24, '0'));
const secret = index => `dhk_${crypto.createHash('sha256').update(`local-load-${index}`).digest('hex')}`;
const tenantId = index => oid(1000 + index);
async function seed(connection) {
  await connection.dropDatabase();
  const products = Array.from({ length: 200 }, (_, i) => ({ _id: oid(10000 + i), name: `Benchmark beverage ${String(i).padStart(3, '0')}`,
    slug: `benchmark-beverage-${i}`, type: 'wine', status: 'approved', isPublished: true, isAlcoholic: true, abv: 12,
    description: 'Synthetic catalogue description. '.repeat(30), shortDescription: 'Local load test fixture',
    images: [{ url: 'https://example.invalid/bottle.png', alt: 'Fixture' }], volumeMl: 750, originCountry: 'Nigeria' }));
  const tenants = [], offers = [], sizes = [], keys = [];
  for (let tenant = 0; tenant < 100; tenant++) {
    tenants.push({ _id: tenantId(tenant), name: `Test tenant ${tenant}`, slug: `load-tenant-${tenant}`, status: 'approved', plan: 'pro', subscriptionStatus: 'active' });
    for (let p = 0; p < 200; p++) {
      const offerId = oid(100000 + tenant * 200 + p);
      offers.push({ _id: offerId, tenant: tenantId(tenant), product: products[p]._id, sku: `T${tenant}-P${p}`, status: p % 10 === 0 ? 'inactive' : 'active',
        isPublished: p % 5 !== 0, baseSellingPrice: 1000 + p, costPrice: 500, availableStock: 100, sellWithoutSizeVariants: false });
      for (let size = 0; size < 2; size++) sizes.push({ _id: oid(200000 + (tenant * 200 + p) * 2 + size), tenant: tenantId(tenant), subproduct: offerId,
        size: size ? '150cl' : '75cl', volumeMl: size ? 1500 : 750, unitsPerPack: 1, status: 'active', availability: 'available',
        sellingPrice: (1000 + p) * (size + 1), costPrice: 500, availableStock: 100, maxOrderQuantity: 10 });
    }
  }
  // 700 keys per tenant; each request index maps to its own key. At most 36
  // uses/key across the full experiment, safely below the unchanged 60/minute.
  for (let tenant = 0; tenant < 50; tenant++) for (let i = 0; i < 700; i++) {
    const value = secret(tenant * 700 + i);
    keys.push({ tenant: tenantId(tenant), hash: crypto.createHash('sha256').update(value).digest('hex'), scopes: ['storefront:read'],
      revokedAt: null, expiresAt: new Date('2099-01-01'), rateWindow: 0, rateCount: 0, name: 'Local load test' });
  }
  for (const [collection, rows] of Object.entries({ products, tenants, subproducts: offers, sizes, apikeys: keys })) {
    for (let i = 0; i < rows.length; i += 2000) await connection.collection(collection).insertMany(rows.slice(i, i + 2000));
  }
  for (const model of ['Product', 'SubProduct', 'Size', 'Tenant', 'ApiKey']) await require(`../../models/${model}`).createIndexes();
}
module.exports = { seed, secret, tenantId };
