const test = require('node:test');
const assert = require('node:assert/strict');
const Warehouse = require('../models/Warehouse');
const Pricelist = require('../models/Pricelist');
const { resolveShopPricelist } = require('../services/pricelist.service');

test('pricelist lookup starts before the warehouse read finishes', async (t) => {
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  let listsStarted = false;
  t.mock.method(Warehouse, 'findOne', () => ({ select() { return this; }, lean: () => pending }));
  t.mock.method(Pricelist, 'find', (filter) => { assert.deepEqual(filter, { tenant: 'tenant' }); listsStarted = true; return { lean: async () => [{ _id: 'default', isDefault: true }] }; });
  const result = resolveShopPricelist({}, 'tenant');
  await Promise.resolve();
  await Promise.resolve();
  const startedBeforeWarehouse = listsStarted;
  release({ _id: 'warehouse' });
  assert.equal((await result).resolved._id, 'default');
  assert.equal(startedBeforeWarehouse, true);
});
