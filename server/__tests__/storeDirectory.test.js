'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Tenant = require('../models/Tenant');
const { getStores } = require('../controllers/store.controller');

async function queryDirectory(t, query) {
  const captured = {};
  const chain = { select() { return this; }, sort(sort) { captured.sort = sort; return this; },
    skip(skip) { captured.skip = skip; return this; }, limit() { return this; }, lean: async () => [] };
  t.mock.method(Tenant, 'find', filter => { captured.filter = filter; return chain; });
  t.mock.method(Tenant, 'countDocuments', async filter => { captured.countFilter = filter; return 0; });
  const res = { status() { return this; }, json(body) { captured.body = body; } };
  await getStores({ query }, res, error => { throw error; });
  return captured;
}

test('directory searches a location across city and both state fields while requiring approval', async t => {
  const { filter, countFilter } = await queryDirectory(t, { location: ' Abuja ' });
  assert.equal(filter.status, 'approved');
  assert.deepEqual(filter.$or, [
    { 'address.city': { $regex: 'Abuja', $options: 'i' } },
    { 'address.state': { $regex: 'Abuja', $options: 'i' } },
    { canonicalState: { $regex: 'Abuja', $options: 'i' } },
  ]);
  assert.deepEqual(countFilter, filter);
});
test('directory sorts the entire query before pagination with a stable identity tie breaker', async t => {
  const result = await queryDirectory(t, { sort: 'name_desc', page: '2' });
  assert.deepEqual(result.sort, { name: -1, _id: 1 });
  assert.equal(result.skip, 16);
});
test('directory treats name search as literal text, not a regular expression', async t => {
  const { filter } = await queryDirectory(t, { search: ' A+B (Shop) ' });
  assert.equal(filter.name.$regex, 'A\\+B \\(Shop\\)');
});
test('legacy state and city filters remain available and unknown sort falls back safely', async t => {
  const { filter, sort } = await queryDirectory(t, { state: 'Lagos', city: 'Ikeja', sort: '$where' });
  assert.equal(filter['address.city'].$regex, 'Ikeja');
  assert.equal(filter.$or[0]['address.state'].$regex, 'Lagos');
  assert.deepEqual(sort, { productCount: -1, name: 1, _id: 1 });
});
