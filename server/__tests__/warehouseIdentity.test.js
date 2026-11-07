const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Warehouse = require('../models/Warehouse');
const SubProduct = require('../models/SubProduct');
const { resolveWarehouseReference } = require('../services/subproductWarehouse');

test('warehouse assignments validate tenant ownership without editing location metadata', async t => {
  const id = new mongoose.Types.ObjectId();
  const tenant = new mongoose.Types.ObjectId();
  t.mock.method(Warehouse, 'findOne', async query => {
    assert.equal(String(query.tenant), String(tenant));
    assert.equal(String(query._id), String(id));
    assert.equal(query.isActive, true);
    return { _id: id };
  });
  assert.equal(await resolveWarehouseReference(String(id), null, tenant), id);
  assert.equal(await resolveWarehouseReference({ _id: id, name: 'untrusted rename' }, null, tenant), id);
  t.mock.method(Warehouse, 'findOne', async () => null);
  await assert.rejects(resolveWarehouseReference(id, null, tenant), /belong to this tenant/);
  await assert.rejects(resolveWarehouseReference({ location: 'new storage' }, null, tenant), /existing warehouse/);
});

test('product creation rejects legacy location editing before any catalogue writes', async t => {
  const Product = require('../models/Product');
  t.mock.method(Product, 'findOne', () => { throw new Error('catalogue accessed before warehouse validation'); });
  await assert.rejects(require('../services/subproduct.service').createSubProduct({
    product: String(new mongoose.Types.ObjectId()), costPrice: 100,
    warehouse: { location: 'mutate shared location' },
  }, String(new mongoose.Types.ObjectId()), { role: 'tenant_owner' }), /Select an existing warehouse/);
});

// Regression: a product form must never delete or edit a shared location.
for (const warehouse of [{}, { location: '', zone: '', aisle: '', shelf: '', bin: '' }, null]) {
  test(`saving product warehouse ${JSON.stringify(warehouse)} preserves shared warehouse`, async t => {
    const id = new mongoose.Types.ObjectId();
    const wid = new mongoose.Types.ObjectId();
    const tenant = new mongoose.Types.ObjectId();
    const parent = { _id: id, warehouse: wid, tenant, save: async () => {} };
    t.mock.method(SubProduct, 'findOne', async () => parent);
    const chain = { populate: () => chain, lean: async () => parent };
    t.mock.method(SubProduct, 'findById', () => chain);
    t.mock.method(Warehouse, 'findByIdAndDelete', async () => {
      throw new Error('product save attempted physical warehouse deletion');
    });
    const result = await require('../services/subproduct.service').updateSubProduct(String(id), { warehouse }, String(tenant));
    assert.equal(result.warehouse, warehouse === null ? null : wid);
  });
}

test('warehouse model rejects query hard deletes before hitting the database', async () => {
  mongoose.set('bufferTimeoutMS', 20);
  for (const operation of ['deleteOne', 'deleteMany', 'findOneAndDelete']) {
    await assert.rejects(Warehouse[operation]({ _id: new mongoose.Types.ObjectId() }).exec(), /deactivat|archive/i);
  }
});

test('warehouse model rejects document hard deletion', async () => {
  const warehouse = new Warehouse({ tenant: new mongoose.Types.ObjectId(), name: 'Historical', code: 'WH-1' });
  await assert.rejects(warehouse.deleteOne(), /deactivat|archive/i);
});

for (const hasStock of [false, true]) {
  test(`warehouse deletion retains identity and stock records (stock=${hasStock})`, async t => {
    const WarehouseStock = require('../models/WarehouseStock');
    const id = new mongoose.Types.ObjectId();
    const tenant = new mongoose.Types.ObjectId();
    const wh = { _id: id, tenant, isDefault: false, isActive: true };
    t.mock.method(WarehouseStock, 'exists', async () => hasStock ? { _id: id } : null);
    t.mock.method(Warehouse, 'findOne', async () => wh);
    t.mock.method(Warehouse, 'findOneAndDelete', async () => { throw new Error('must never physically delete'); });
    t.mock.method(WarehouseStock, 'deleteMany', async () => { throw new Error('must preserve stock rows'); });
    t.mock.method(Warehouse, 'findOneAndUpdate', async (query, update) => {
      assert.equal(String(query.tenant), String(tenant));
      assert.equal(String(query._id), String(id));
      Object.assign(wh, update.$set);
      return wh;
    });
    const remove = require('../services/warehouse.service').deleteWarehouse;
    if (hasStock) await assert.rejects(remove(id, tenant), /stock/i);
    else {
      await remove(id, tenant);
      assert.equal(wh.isActive, false);
      assert.equal(wh._id, id);
    }
  });
}
