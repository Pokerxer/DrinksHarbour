// server/__tests__/warehouseManagers.test.js
// Pins the validation core of PATCH /api/warehouses/:id/managers: every
// proposed manager id must resolve to a User belonging to the caller's own
// tenant. The handler/route wiring (guard, save, populate) follows the same
// conventions as the rest of the file and is exercised by smoke testing; here
// only validateManagerIds is unit-tested, mirroring pickValidSettingUpdates.
const test = require('node:test');
const assert = require('node:assert/strict');

const ctrlPath = require.resolve('../controllers/warehouse.controller');

test('setWarehouseManagers and validateManagerIds are exported', () => {
  delete require.cache[ctrlPath];
  const c = require(ctrlPath);
  assert.equal(typeof c.setWarehouseManagers, 'function');
  assert.equal(typeof c.validateManagerIds, 'function');
});

test('validateManagerIds returns ids that all belong to the tenant', async () => {
  delete require.cache[ctrlPath];
  const { validateManagerIds } = require(ctrlPath);
  const seen = [];
  // Mirrors the mongoose chain shape: find()/select() are sync chainables,
  // lean() is the awaited terminal.
  const User = {
    find: (q) => {
      seen.push(q);
      return {
        select: () => ({ lean: async () => [{ _id: 'u1' }, { _id: 'u2' }] }),
      };
    },
  };
  const ids = await validateManagerIds(['u1', 'u2'], 't1', User);
  assert.deepEqual(ids.map(String), ['u1', 'u2']);
  assert.equal(seen.length, 1);
  assert.equal(seen[0].tenant, 't1');
  assert.deepEqual(seen[0]._id.$in.map(String), ['u1', 'u2']);
});

test('validateManagerIds rejects an id outside the tenant', async () => {
  delete require.cache[ctrlPath];
  const { validateManagerIds } = require(ctrlPath);
  // Only u2 exists in this tenant; u9 does not.
  const User = {
    find: () => ({
      select: () => ({ lean: async () => [{ _id: 'u2' }] }),
    }),
  };
  await assert.rejects(
    validateManagerIds(['u9', 'u2'], 't1', User),
    /not a user of this tenant/i
  );
});

test('validateManagerIds accepts an empty list without querying users', async () => {
  delete require.cache[ctrlPath];
  const { validateManagerIds } = require(ctrlPath);
  let queried = false;
  const User = {
    find: () => {
      queried = true;
      return { select: () => ({ lean: async () => [] }) };
    },
  };
  assert.deepEqual(await validateManagerIds([], 't1', User), []);
  assert.equal(queried, false);
});
