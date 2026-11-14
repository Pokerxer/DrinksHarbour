'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('checkout reserves the whole line at the tenant default, even outside the marketplace selection', async t => {
  const Tenant = require('../models/Tenant');
  const Warehouse = require('../models/Warehouse');
  const stock = require('../services/storefrontLocationStock');
  const { createMappedOrder } = require('../services/storefrontLocationOrders');
  const [tenant, defaultWarehouse, selected, subproduct, size, product] =
    Array.from({ length: 6 }, () => new mongoose.Types.ObjectId());
  const session = {};
  t.mock.method(Tenant, 'find', () => ({
    select: () => ({ session: () => ({ lean: async () => [{
      _id: tenant, warehouseSettings: { defaultWarehouse, marketplaceWarehouses: [selected] },
    }] }) }),
  }));
  t.mock.method(Warehouse, 'find', filter => {
    assert.deepEqual(filter.tenant.$in.map(String), [String(tenant)]);
    assert.equal(filter.isActive, true);
    return { select: () => ({ sort: () => ({ session: () => ({
      lean: async () => [{ _id: defaultWarehouse, tenant }],
    }) }) }) };
  });
  const stop = new Error('reservation observed');
  t.mock.method(stock, 'reserve', async (items, _order, reservationSession) => {
    assert.deepEqual(items.map(item => [String(item.warehouse), item.quantity]), [[String(defaultWarehouse), 3]]);
    assert.equal(reservationSession, session);
    throw stop;
  });
  await assert.rejects(createMappedOrder({ items: [{ tenant, warehouse: selected, subproduct, size, product, quantity: 3 }] },
    [{ _id: tenant }], { session }), error => error === stop);
});

test('an inactive or foreign configured default never falls back to an active warehouse marked default', async t => {
  const Warehouse = require('../models/Warehouse');
  const { resolveDefaults } = require('../services/marketplaceDefaultWarehouse');
  const [tenant, configured, other, legacyTenant, legacy, foreign] =
    Array.from({ length: 6 }, () => new mongoose.Types.ObjectId());
  t.mock.method(Warehouse, 'find', () => {
    const query = {
      select: () => query, sort: () => query, session: () => query,
      lean: async () => [
        { _id: configured, tenant: foreign, isDefault: true },
        { _id: other, tenant, isDefault: true },
        { _id: legacy, tenant: legacyTenant, isDefault: true },
      ],
    };
    return query;
  });
  const defaults = await resolveDefaults([
    { _id: tenant, warehouseSettings: { defaultWarehouse: configured } },
    { _id: legacyTenant },
  ]);
  assert.equal(defaults.has(String(tenant)), false);
  assert.equal(defaults.get(String(legacyTenant)), legacy);
});

test('required default warehouse checkout fails before falling back to another location', async t => {
  const Tenant = require('../models/Tenant');
  const Warehouse = require('../models/Warehouse');
  const Channel = require('../models/StorefrontChannel');
  const { createMappedOrder } = require('../services/storefrontLocationOrders');
  const tenant = new mongoose.Types.ObjectId();
  t.mock.method(Tenant, 'find', () => ({
    select: () => ({ session: () => ({ lean: async () => [{ _id: tenant, storefrontIntegrationEnabled: true }] }) }),
  }));
  t.mock.method(Warehouse, 'find', () => {
    const query = { select: () => query, sort: () => query, session: () => query, lean: async () => [] };
    return query;
  });
  t.mock.method(Channel, 'find', () => assert.fail('Checkout cannot fall back to an integration warehouse'));
  await assert.rejects(createMappedOrder({ items: [{ tenant }] }, [], { session: {}, requireDefaultWarehouse: true }),
    /active default warehouse/i);
});
