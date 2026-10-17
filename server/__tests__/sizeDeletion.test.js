const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { sizeDeletionStatus, assertSizesDeletable, removedSizes } = require('../services/size-deletion');

const modelNames = ['WarehouseStock', 'InventoryMovement', 'WarehouseMovement',
  'StockMovement', 'WarehouseBatch', 'Order', 'SalesOrder', 'CustomerInvoice', 'Sales', 'PurchaseOrder',
  'StockTransfer', 'VendorBill', 'VendorReturn', 'PurchaseAgreement', 'Cart',
  'ReorderRule', 'VendorPricelist', 'Review', 'KioskScan', 'POSCombo', 'Promotion'];
const size = () => ({ _id: new mongoose.Types.ObjectId(), subproduct: new mongoose.Types.ObjectId(), size: '75cl' });

function references(t, hit) {
  for (const name of modelNames) {
    const Model = require(`../models/${name}`);
    t.mock.method(Model, 'exists', async query => {
      // Every reference path must really exist; otherwise strictQuery can
      // silently turn an eligibility check into the wrong query.
      for (const clause of query.$or || []) {
        for (const path of Object.keys(clause)) assert.ok(Model.schema.path(path), `${name}.${path}`);
      }
      return name === hit ? { _id: 'history' } : null;
    });
  }
}

test('an unused persisted size can be removed', async t => {
  references(t);
  assert.deepEqual(await sizeDeletionStatus(size(), 'tenant'), { allowed: true, reason: null });
});

for (const name of modelNames) {
  test(`keeps sizes referenced by ${name}, even with zero stock`, async t => {
    references(t, name);
    assert.equal((await sizeDeletionStatus(size(), 'tenant')).allowed, false);
    await assert.rejects(assertSizesDeletable([size()], 'tenant'), /Cannot delete/);
  });
}

test('nonzero stock, reservations and sales counters prevent deletion', async () => {
  for (const field of ['stock', 'reservedStock', 'availableStock', 'totalSold', 'totalRevenue']) {
    assert.equal((await sizeDeletionStatus({ ...size(), [field]: 1 }, 'tenant')).allowed, false);
  }
});

test('update removals preserve ids, legacy value matches and an existing unit', () => {
  const a = size();
  const b = { ...size(), size: 'unit' };
  assert.deepEqual(removedSizes([a, b], [{ _id: a._id, size: 'renamed' }]), [b]);
  assert.deepEqual(removedSizes([a], [{ size: '75CL' }]), []);
  assert.deepEqual(removedSizes([a, b], [], true), [a]);
  assert.deepEqual(removedSizes([a], []), [a]);
});

test('direct size deletion refuses history before deleting documents', async t => {
  references(t, 'WarehouseMovement');
  const SubProduct = require('../models/SubProduct');
  const Size = require('../models/Size');
  const row = size();
  let deleted = false;
  t.mock.method(SubProduct, 'findOne', async () => ({ sizes: [row._id], save: async () => {} }));
  t.mock.method(Size, 'findOne', async () => ({ ...row, deleteOne: async () => { deleted = true; } }));
  const service = require('../services/subproduct.service');
  await assert.rejects(service.deleteSize(String(row.subproduct), String(row._id), 'tenant'), /Cannot delete/);
  assert.equal(deleted, false);
});

test('product save refuses a history-bearing removal before persisting edits', async t => {
  references(t, 'PurchaseOrder');
  const SubProduct = require('../models/SubProduct');
  const Size = require('../models/Size');
  const row = size();
  const tenant = new mongoose.Types.ObjectId();
  let saved = false;
  t.mock.method(SubProduct, 'findOne', async query => {
    assert.equal(String(query.tenant), String(tenant));
    return { save: async () => { saved = true; } };
  });
  t.mock.method(Size, 'find', query => {
    assert.equal(String(query.tenant), String(tenant));
    return { lean: async () => [row] };
  });
  const service = require('../services/subproduct.service');
  await assert.rejects(service.updateSubProduct(String(row.subproduct), { sizes: [] }, String(tenant)), /Cannot delete/);
  assert.equal(saved, false);
});

test('unused default size deletes empty stock rows and selects the remaining default', async t => {
  references(t);
  const row = size();
  const remaining = new mongoose.Types.ObjectId();
  const parent = { sizes: [row._id, remaining], defaultSize: row._id, save: t.mock.fn(async () => {}) };
  const SubProduct = require('../models/SubProduct');
  const Size = require('../models/Size');
  const WarehouseStock = require('../models/WarehouseStock');
  t.mock.method(SubProduct, 'findOne', async () => parent);
  const deleted = t.mock.fn(async () => {});
  t.mock.method(Size, 'findOne', async query => {
    assert.equal(query.tenant, 'tenant');
    assert.equal(query.subproduct, String(row.subproduct));
    return { ...row, deleteOne: deleted };
  });
  const cleanup = t.mock.method(WarehouseStock, 'deleteMany', async query => {
    assert.equal(query.tenant, 'tenant');
    assert.equal(query.size, String(row._id));
  });
  const service = require('../services/subproduct.service');
  await service.deleteSize(String(row.subproduct), String(row._id), 'tenant');
  assert.equal(deleted.mock.callCount(), 1);
  assert.equal(cleanup.mock.callCount(), 1);
  assert.deepEqual(parent.sizes, [remaining]);
  assert.equal(parent.defaultSize, remaining);
});

test('eligibility refuses a foreign parent without querying size history', async t => {
  const SubProduct = require('../models/SubProduct');
  const Size = require('../models/Size');
  const lookup = t.mock.method(Size, 'findOne', async () => { throw new Error('must not query size'); });
  t.mock.method(SubProduct, 'findOne', async query => {
    assert.equal(query.tenant, 'tenant');
    return null;
  });
  const service = require('../services/subproduct.service');
  await assert.rejects(service.getSizeDeletionStatus('foreign', 'size', 'tenant'), /not found for this tenant/);
  assert.equal(lookup.mock.callCount(), 0);
});
