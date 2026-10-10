'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const SubProduct = require('../models/SubProduct');
const Size = require('../models/Size');
const ApiKey = require('../models/ApiKey');
const Tenant = require('../models/Tenant');
const catalog = require('../services/storefrontCatalog.service');
const keys = require('../services/apiKey.service');
const tenant = { _id: 'a'.repeat(24) };
function stubReads(t) {
  let calls = 0;
  t.mock.method(SubProduct, 'aggregate', async () => {
    calls++;
    await new Promise(resolve => setImmediate(resolve));
    return [{ rows: [], count: [] }];
  });
  t.mock.method(Size, 'find', () => ({ select() { return this; }, session() { return this; }, lean: async () => [] }));
  return () => calls;
}
test('100 simultaneous same-tenant catalogue reads share one aggregate and then refresh', async t => {
  const calls = stubReads(t);
  const results = await Promise.all(Array.from({ length: 100 }, () => catalog.listProducts(tenant, {})));
  assert.equal(calls(), 1);
  assert.deepEqual(results[0].pagination, { page: 1, limit: 20, total: 0, totalPages: 0 });
  await catalog.listProducts(tenant, {});
  assert.equal(calls(), 2);
});
test('tenant, search and pagination isolate concurrent catalogue work', async t => {
  const calls = stubReads(t);
  await Promise.all([
    catalog.listProducts(tenant, {}),
    catalog.listProducts({ _id: 'b'.repeat(24) }, {}),
    catalog.listProducts(tenant, { q: 'Beer' }),
    catalog.listProducts(tenant, { page: '2' }),
  ]);
  assert.equal(calls(), 4);
});
test('normalized page parameters share work but invalid filters never join a valid read', async t => {
  const calls = stubReads(t);
  const pending = catalog.listProducts(tenant, {});
  await assert.rejects(catalog.listProducts(tenant, { q: ['wine'] }), /Invalid q/);
  await catalog.listProducts(tenant, { page: '1', limit: '20' });
  await pending;
  assert.equal(calls(), 1);
});
test('failed shared catalogue reads release work so later requests can recover', async t => {
  let attempts = 0;
  t.mock.method(SubProduct, 'aggregate', async () => {
    attempts++;
    await new Promise(resolve => setImmediate(resolve));
    if (attempts === 1) throw new Error('database down');
    return [{ rows: [], count: [] }];
  });
  t.mock.method(Size, 'find', () => ({ select() { return this; }, session() { return this; }, lean: async () => [] }));
  const results = await Promise.allSettled([catalog.listProducts(tenant, {}), catalog.listProducts(tenant, {})]);
  assert.equal(results.filter(r => r.status === 'rejected').length, 2);
  await catalog.listProducts(tenant, {});
  assert.equal(attempts, 2);
});
test('key authentication spends one write per request and rechecks the granted scope', async t => {
  t.mock.method(ApiKey, 'findOne', () => ({ lean: async () => ({ tenant: tenant._id, scopes: ['storefront:read'] }) }));
  t.mock.method(Tenant, 'findById', () => ({ lean: async () => ({ ...tenant, plan: 'pro', status: 'approved', subscriptionStatus: 'active' }) }));
  let writes = 0, filter;
  t.mock.method(ApiKey, 'updateOne', async query => { writes++; filter = query; return { modifiedCount: 1 }; });
  await keys.authenticateKey(`dhk_${'a'.repeat(64)}`, 'storefront:read');
  assert.equal(writes, 1);
  assert.equal(filter.revokedAt, null);
  assert.equal(filter.scopes, 'storefront:read');
});
