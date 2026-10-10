const test = require('node:test');
const assert = require('node:assert/strict');
const Movement = require('../models/InventoryMovement');
const inventory = require('../services/inventory.service');
const tenant = '699165839f3308b1baeca8fc';
const matches = (row, query) =>
  Object.entries(query).every(([key, value]) => {
    if (key === '$or') return value.some((branch) => matches(row, branch));
    if (value && typeof value === 'object' && !value._bsontype && '$in' in value)
      return value.$in.includes(row[key]);
    return String(row[key]) === String(value);
  });
test('adjustment scope finds in/out and legacy records with tenant-scoped identical counts', async (t) => {
  const rows = [
    { _id: 'increase', tenant, type: 'adjustment_in', category: 'in' },
    { _id: 'decrease', tenant, type: 'adjustment_out', category: 'out' },
    { _id: 'legacy', tenant, type: 'adjustment', category: 'adjustment' },
    { _id: 'receipt', tenant, type: 'received', category: 'in' },
    { _id: 'other', tenant: '699165839f3308b1baeca8fd', type: 'adjustment_in', category: 'in' },
  ];
  let findQuery, countQuery;
  t.mock.method(Movement, 'find', (query) => {
    findQuery = query;
    return {
      sort() {
        return this;
      },
      skip() {
        return this;
      },
      limit() {
        return this;
      },
      populate() {
        return this;
      },
      lean: async () => rows.filter((row) => matches(row, query)),
    };
  });
  t.mock.method(Movement, 'countDocuments', async (query) => {
    countQuery = query;
    return rows.filter((row) => matches(row, query)).length;
  });
  const result = await inventory.getMovements(tenant, { scope: 'adjustments' });
  assert.deepEqual(
    result.data.movements.map((row) => row._id),
    ['increase', 'decrease', 'legacy'],
  );
  assert.equal(result.data.total, 3);
  assert.strictEqual(findQuery, countQuery);
  const incoming = await inventory.getMovements(tenant, { scope: 'adjustments', category: 'in' });
  assert.deepEqual(
    incoming.data.movements.map((row) => row._id),
    ['increase'],
  );
  await inventory.getMovements(tenant, {
    scope: 'adjustments',
    subProductId: tenant,
    startDate: '2026-10-01T00:00:00Z',
    endDate: '2026-10-05T23:59:59Z',
  });
  assert.strictEqual(findQuery, countQuery);
  assert.equal(String(findQuery.tenant), tenant);
  assert.equal(String(findQuery.subProduct), tenant);
  assert.equal(findQuery.createdAt.$gte.toISOString(), '2026-10-01T00:00:00.000Z');
  assert.equal(findQuery.createdAt.$lte.toISOString(), '2026-10-05T23:59:59.000Z');
});
