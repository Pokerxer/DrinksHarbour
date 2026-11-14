'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('warehouse settings accept a selected marketplace location and allow clearing it', () => {
  const { pickValidSettingUpdates } = require('../controllers/warehouse.controller');
  const warehouse = new mongoose.Types.ObjectId().toString();
  const key = 'warehouseSettings.marketplaceWarehouse';
  assert.deepEqual(pickValidSettingUpdates({ marketplaceWarehouse: warehouse }), { [key]: warehouse });
  assert.deepEqual(pickValidSettingUpdates({ marketplaceWarehouse: '' }), { [key]: null });
  assert.deepEqual(pickValidSettingUpdates({ marketplaceWarehouse: 'invalid' }), {});
});

test('marketplace stock projection precedes stock filters even with market eligibility disabled', () => {
  const { constrainStockLookups } = require('../services/marketplaceWarehouseStock');
  const match = { $match: { stock: { $gt: 0 } } };
  const input = [{ $lookup: { from: 'sizes', as: 'sizes', pipeline: [match] } }];
  const output = constrainStockLookups(input);
  assert.equal(output[0].$lookup.pipeline.at(-1), match);
  assert.ok(output[0].$lookup.pipeline.some(stage => stage.$set?.stock));
  assert.deepEqual(input[0].$lookup.pipeline, [match]);
});

test('populated offers use their own selected stock and zero missing or retired variants', async t => {
  const Stock = require('../models/WarehouseStock');
  const { scopeOffers } = require('../services/marketplaceWarehouseStock');
  const [tenant, warehouse, second, listing, size, missing, retired] = Array.from({ length: 7 }, () => new mongoose.Types.ObjectId());
  t.mock.method(Stock, 'aggregate', async pipeline => {
    assert.deepEqual(pipeline[0].$match.$or, [{ tenant, warehouse: { $in: [warehouse, second] }, subProduct: listing, size: { $in: [size, missing, retired] } }]);
    return [
      { tenant, warehouse, subProduct: listing, size, stock: 4 },
      { tenant, warehouse: second, subProduct: listing, size, stock: 3 },
      { tenant, warehouse, subProduct: listing, size: retired, stock: 2 },
    ];
  });

  const selectedOffer = {
    _id: listing, tenant: { _id: tenant, warehouseSettings: { marketplaceWarehouses: [warehouse, second] } },
    availableStock: 19,
    sizes: [{ _id: size, stock: 12 }, { _id: missing, stock: 5 }, { _id: retired, stock: 2, status: 'discontinued' }],
  };
  const legacyOffer = { tenant: { _id: new mongoose.Types.ObjectId() }, availableStock: 9 };
  const [selected, legacy] = await scopeOffers([selectedOffer, legacyOffer]);
  assert.deepEqual(selected.sizes.map(variant => variant.stock), [7, 0, 0]);
  assert.equal(selected.availableStock, 7);
  assert.equal(legacy.availableStock, 9);
  assert.equal(selectedOffer.availableStock, 19);
});

test('settings accept multiple warehouse IDs and reject duplicates', () => {
  const { pickValidSettingUpdates } = require('../controllers/warehouse.controller');
  const ids = Array.from({ length: 2 }, () => String(new mongoose.Types.ObjectId()));
  assert.deepEqual(pickValidSettingUpdates({ marketplaceWarehouses: ids }), { 'warehouseSettings.marketplaceWarehouses': ids });
  assert.deepEqual(pickValidSettingUpdates({ marketplaceWarehouses: [ids[0], ids[0].toUpperCase()] }), {});
});
