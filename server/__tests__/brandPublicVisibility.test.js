'use strict';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
const test = require('node:test');
const assert = require('node:assert/strict');
const Brand = require('../models/Brand');
const Product = require('../models/Product');
const brandRouter = require('../routes/brand.routes');
const { startRouter, mockAuthUser, ROLE_USERS } = require('./helpers/routeAuthHarness');

const ACTIVE_ID = '000000000000000000000001';
const PENDING_ID = '000000000000000000000002';
const BRANDS = [
  { _id: ACTIVE_ID, name: 'Published', slug: 'published', status: 'active' },
  { _id: PENDING_ID, name: 'Proposal', slug: 'proposal', status: 'pending' },
  { _id: '000000000000000000000003', name: 'Archived', slug: 'archived', status: 'archived' },
  { _id: '000000000000000000000004', name: 'Inactive', slug: 'inactive', status: 'inactive' },
  { _id: '000000000000000000000005', name: 'Suspended', slug: 'suspended', status: 'suspended' },
];

// Only the database boundary is replaced: route, auth, controller and service
// execute normally. Returning fixture rows according to the emitted query makes
// removing a publication constraint expose a real unpublished response.
function matches(row, filter) {
  return Object.entries(filter).every(([key, value]) => {
    if (value && typeof value === 'object' && '$exists' in value) {
      return (row[key] !== undefined) === value.$exists;
    }
    if (value && typeof value === 'object' && '$in' in value) {
      return value.$in.includes(row[key]);
    }
    return String(row[key]) === String(value);
  });
}

function query(value) {
  const result = { then: (resolve, reject) => Promise.resolve(value).then(resolve, reject) };
  for (const method of ['select', 'sort', 'skip', 'limit', 'lean', 'collation']) {
    result[method] = () => result;
  }
  return result;
}

function stubDatabase(t) {
  t.mock.method(Brand, 'find', (filter = {}) => query(BRANDS.filter(row => matches(row, filter))));
  t.mock.method(Brand, 'findOne', filter => query(BRANDS.find(row => matches(row, filter)) || null));
  t.mock.method(Brand, 'findById', id => query(BRANDS.find(row => row._id === id) || null));
  t.mock.method(Brand, 'countDocuments', async filter => BRANDS.filter(row => matches(row, filter)).length);
  t.mock.method(Brand, 'findByIdAndUpdate', () => ({ exec: async () => null }));
  t.mock.method(Product, 'countDocuments', async () => 0);
}

async function request(path, authorization) {
  const app = await startRouter(brandRouter, '/api/brands');
  try {
    const res = await fetch(app.url(`/api/brands${path}`), {
      headers: authorization ? { authorization } : {},
    });
    return { status: res.status, body: await res.json() };
  } finally {
    await app.close();
  }
}

for (const suffix of ['', '?status=pending', '?status=all', '?status=inactive', '?status=active&status=pending']) {
  test(`public discovery ignores publication overrides: ${suffix || 'default'}`, async t => {
    stubDatabase(t);
    const { status, body } = await request(suffix);
    assert.equal(status, 200);
    assert.deepEqual(body.data.brands.map(row => row._id), [ACTIVE_ID]);
    assert.equal(body.data.pagination.total, 1);
    assert.equal(body.data.filters.applied.status, 'active');
  });
}

for (const brand of BRANDS.slice(1)) {
  for (const path of [`/${brand._id}`, `/slug/${brand.slug}`]) {
    test(`public detail conceals ${brand.status}: ${path}`, async t => {
      stubDatabase(t);
      const { status, body } = await request(path);
      assert.equal(status, 404);
      assert.equal(body.message, 'Brand not found');
    });
  }
}

for (const path of [`/${ACTIVE_ID}`, '/slug/published']) {
  test(`public detail still returns published brand: ${path}`, async t => {
    stubDatabase(t);
    const { status, body } = await request(path);
    assert.equal(status, 200);
    assert.equal(body.data.brand._id, ACTIVE_ID);
  });
}

for (const role of ['super_admin', 'admin']) {
  test(`${role} can still list and inspect proposals through protected reads`, async t => {
    stubDatabase(t);
    const authorization = mockAuthUser(t, ROLE_USERS[role]);
    const detail = await request(`/admin/${PENDING_ID}`, authorization);
    assert.equal(detail.status, 200);
    assert.equal(detail.body.data.brand.status, 'pending');
    const listing = await request('/admin', authorization);
    assert.equal(listing.status, 200);
    assert.ok(listing.body.data.brands.some(row => row._id === PENDING_ID));
  });
}

for (const role of [null, 'customer', 'tenant_owner', 'tenant_admin', 'tenant_staff']) {
  test(`protected proposal detail refuses ${role || 'anonymous'}`, async t => {
    stubDatabase(t);
    const authorization = role ? mockAuthUser(t, ROLE_USERS[role]) : undefined;
    const { status } = await request(`/admin/${PENDING_ID}`, authorization);
    assert.equal(status, role ? 403 : 401);
  });
}

test('public filter status counts do not reveal unpublished brands', async t => {
  stubDatabase(t);
  t.mock.method(Brand, 'distinct', async () => []);
  t.mock.method(Brand, 'aggregate', async pipeline => {
    const group = pipeline.find(stage => stage.$group)?.$group;
    if (group?._id !== '$status') return [];
    const rows = BRANDS.filter(row => matches(row, pipeline[0].$match));
    return rows.map(row => ({ _id: row.status, count: 1 }));
  });
  const { status, body } = await request('/filters/options');
  assert.equal(status, 200);
  assert.deepEqual(body.data.filters.statuses, { active: 1 });
});
