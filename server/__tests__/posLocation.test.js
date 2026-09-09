const test = require('node:test');
const assert = require('node:assert/strict');
const Warehouse = require('../models/Warehouse');
const { resolveShopWarehouse } = require('../services/warehouse.service');

test('plain tenant arrays resolve the selected location rather than the default', async (t) => {
  t.mock.method(Warehouse, 'findOne', filter => ({ select: () => ({ lean: async () =>
    filter._id === 'selected' && filter.tenant === 'tenant' ? { _id: 'selected' } : null }) }));
  assert.equal(await resolveShopWarehouse({ posSettings: { shops: [{ _id: 'shop', warehouse: 'selected' }] } }, 'tenant', 'shop'), 'selected');
});

for (const [name, shops, shopId] of [
  ['uncreated wholesale POS', [], 'wholesale'],
  ['unknown POS', [], 'missing'],
  ['inactive POS', [{ _id: 'shop', active: false, warehouse: 'selected' }], 'shop'],
  ['unbound POS', [{ _id: 'shop' }], 'shop'],
]) test(`rejects ${name} without falling back`, async () => {
  await assert.rejects(resolveShopWarehouse({ posSettings: { shops } }, 'tenant', shopId), /POS is missing|Select a stock location/);
});

test('Retail uses its selected location independently of the warehouse default', async (t) => {
  t.mock.method(Warehouse, 'findOne', filter => ({ select: () => ({ lean: async () =>
    filter._id === 'selected' ? { _id: 'selected' } : null }) }));
  assert.equal(await resolveShopWarehouse({ posSettings: { retailWarehouse: 'selected' } }, 'tenant', 'retail'), 'selected');
});

test('rejects unavailable or foreign locations', async (t) => {
  t.mock.method(Warehouse, 'findOne', () => ({ select: () => ({ lean: async () => null }) }));
  await assert.rejects(resolveShopWarehouse({ posSettings: { shops: [{ _id: 'shop', warehouse: 'foreign' }] } }, 'tenant', 'shop'));
});
