'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Banner = require('../models/Banner');
const service = require('../services/banner.service');
const own = 'a'.repeat(24), foreign = 'b'.repeat(24), id = 'c'.repeat(24);
test('banner detail queries include tenant authority instead of a bare ID', async t => {
  let filter;
  const chain = { populate() { return this; }, then(resolve) { resolve(null); } };
  t.mock.method(Banner, 'findOne', value => { filter = value; return chain; });
  t.mock.method(Banner, 'findById', () => { throw new Error('Unscoped lookup'); });
  await assert.rejects(service.getBannerById(id, { tenant: own }), /Banner not found/);
  assert.deepEqual(filter, { _id: id, tenant: own });
});
test('update and deletion cannot find foreign banner documents', async t => {
  const filters = [];
  t.mock.method(Banner, 'findOne', async value => { filters.push(value); return null; });
  t.mock.method(Banner, 'findById', () => { throw new Error('Unscoped lookup'); });
  await assert.rejects(service.updateBanner(id, { title: 'Attack', tenant: foreign }, own, { tenant: own }), /Banner not found/);
  await assert.rejects(service.deleteBanner(id, { tenant: own }), /Banner not found/);
  assert.equal(filters.length, 2);
  for (const filter of filters) assert.equal(filter.tenant, own);
});
test('bulk status writes only update IDs in the authenticated tenant', async t => {
  let filter;
  t.mock.method(Banner, 'updateMany', async value => { filter = value; return { modifiedCount: 0 }; });
  await service.bulkUpdateBannerStatus([id], 'paused', own, { tenant: own });
  assert.deepEqual(filter, { _id: { $in: [id] }, tenant: own });
});

test('daily trends reject a foreign banner before reading analytics', async t => {
  let filter;
  t.mock.method(Banner, 'exists', async value => { filter = value; return null; });
  await assert.rejects(service.getBannerTrends({ bannerId: id, tenant: own }), /Banner not found/);
  assert.deepEqual(filter, { _id: id, tenant: own });
});
