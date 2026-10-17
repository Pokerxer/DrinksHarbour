const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const SubProduct = require('../models/SubProduct');
const service = require('../services/subproduct.service');
const tenant = new mongoose.Types.ObjectId();
const id = new mongoose.Types.ObjectId().toString();

test('list statistics start with the record read rather than waiting for each other', async t => {
  const started = [], release = [];
  t.mock.method(SubProduct, 'countDocuments', query => {
    started.push(query);
    return new Promise(resolve => release.push(() => resolve(7)));
  });
  const chain = { populate: () => chain, select: () => chain, sort: () => chain,
    skip: () => chain, limit: () => chain, lean: async () => [] };
  t.mock.method(SubProduct, 'find', () => chain);
  const report = service.getMySubProducts(tenant, { limit: 10 });
  await new Promise(resolve => setImmediate(resolve));
  const concurrent = started.length;
  // Release late sequential calls too so a failing test never leaves work hanging.
  for (let i = 0; i < 5; i++) { release.splice(0).forEach(fn => fn()); await new Promise(resolve => setImmediate(resolve)); }
  const result = await report;
  assert.equal(concurrent, 4);
  assert.equal(result.stats.active, 7);
  assert.equal(result.pagination.total, 7);
  assert.ok(started.every(query => String(query.tenant) === String(tenant)));
});

test('detail populates the first scoped document and omits corrupt legacy references', async t => {
  let reads = 0, populated = 0;
  const repairs = [];
  const doc = { _id: id, tenant, shipping: 'corrupt', warehouse: 'invalid', sizes: [] };
  const chain = { populate: () => chain, lean: async () => ({ ...doc }) };
  t.mock.method(SubProduct, 'findOne', query => { reads++; assert.equal(String(query.tenant), String(tenant)); return chain; });
  t.mock.method(SubProduct, 'updateOne', async query => { repairs.push(query); });
  t.mock.method(SubProduct, 'populate', async (record, fields) => {
    populated++;
    assert.equal(record._id, id);
    assert.ok(!fields.some(field => ['shipping', 'warehouse'].includes(field.path)));
    return record;
  });
  const result = await service.getSubProduct(id, tenant);
  assert.equal(reads, 1);
  assert.equal(populated, 1);
  assert.ok(repairs.every(query => String(query.tenant) === String(tenant)));
  assert.equal(result.shipping, null);
  assert.equal(result.warehouse, null);
});

test('lightweight catalog keeps tenant scope, selects list fields and skips unused summary queries', async t => {
  const queries = [], selections = [];
  let populations, ordering;
  t.mock.method(SubProduct, 'countDocuments', async query => { queries.push(query); return 7; });
  const chain = { populate: fields => { populations = fields; return chain; },
    select: fields => { selections.push(fields); return chain; },
    sort: fields => { ordering = fields; return chain; },
    skip: () => chain, limit: () => chain, lean: async () => [] };
  t.mock.method(SubProduct, 'find', query => { queries.push(query); return chain; });
  const result = await service.getMySubProducts(tenant, { limit: 5000, view: 'list' });
  assert.equal(queries.length, 2);
  assert.ok(queries.every(query => String(query.tenant) === String(tenant)));
  assert.ok(selections[0].includes('lowStockThreshold'));
  assert.ok(selections[0].includes('descriptionOverride'));
  assert.ok(!selections[0].includes('shipping'));
  assert.ok(populations.find(field => field.path === 'sizes').select.includes('sellingPrice'));
  assert.ok(!populations.find(field => field.path === 'sizes').select.includes('images'));
  assert.equal(ordering._id, -1);
  assert.equal(result.pagination.total, 7);
  assert.equal(result.stats, undefined);
});
