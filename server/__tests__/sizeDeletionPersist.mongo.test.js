'use strict';
// Reproduction: remove a size row from the sub-product edit form and save.
// The client PATCHes the flat transformed payload (sizes minus the removed row).
// After the save, the removed Size document must be gone from the database and
// from subProduct.sizes — it must not resurface after a reload.
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { uri, connectVenueMongo } = require('./helpers/venueMongo');

test('updateSubProduct deletes no-stock size rows omitted from the payload', { skip: !uri }, async t => {
  await connectVenueMongo(t, 'size_delete_persist');
  const oid = () => new mongoose.Types.ObjectId();
  const tenant = oid();
  const product = oid();
  const actor = { _id: oid(), role: 'tenant_owner', tenant };

  await require('../models/Tenant').collection.insertOne({
    _id: tenant, status: 'approved', subscriptionStatus: 'active', revenueModel: 'commission', commissionPercentage: 0,
  });
  await require('../models/Product').collection.insertOne({
    _id: product, name: 'Synthetic bottle', type: 'beer', status: 'approved', platformMarkup: 0,
  });

  const SubProduct = require('../models/SubProduct');
  const Size = require('../models/Size');
  const service = require('../services/subproduct.service');
  const sp = await SubProduct.create({
    tenant, product, sku: 'SIZE_DELETE_PERSIST', costPrice: 500, baseSellingPrice: 1000,
    status: 'draft', isPublished: false,
  });

  // First save — creates both size rows exactly as the form posts them (no _id yet).
  await service.updateSubProduct(String(sp._id), {
    product: String(product),
    sku: 'SIZE_DELETE_PERSIST',
    costPrice: 500,
    baseSellingPrice: 1000,
    sellWithoutSizeVariants: false,
    sizes: [
      { size: '35cl', displayName: '35cl', sizeCategory: 'standard', basePrice: 1000, costPrice: 500, stock: 0, currency: 'NGN', markupPercentage: 25, roundUp: '100', saleDiscountPercentage: 0, isDefault: true, rank: 1 },
      { size: '75cl', displayName: '75cl', sizeCategory: 'standard', basePrice: 1800, costPrice: 900, stock: 0, currency: 'NGN', markupPercentage: 25, roundUp: '100', saleDiscountPercentage: 0, isDefault: false, rank: 2 },
    ],
  }, String(tenant), actor);

  const afterCreate = await Size.find({ subproduct: sp._id }).lean();
  assert.equal(afterCreate.length, 2, 'both sizes should exist after first save');
  const dropped = afterCreate.find(s => s.size === '75cl');

  // Second save — the tenant removed the 75cl row in the edit form. The payload
  // (shape of transformFormData) now carries only the kept row, including its _id.
  const kept = afterCreate.find(s => s.size === '35cl');
  await service.updateSubProduct(String(sp._id), {
    product: String(product),
    sku: 'SIZE_DELETE_PERSIST',
    costPrice: 500,
    baseSellingPrice: 1000,
    sellWithoutSizeVariants: false,
    sizes: [{
      _id: String(kept._id),
      size: '35cl', displayName: '35cl', sizeCategory: 'standard', basePrice: 1000, costPrice: 500,
      stock: 0, currency: 'NGN', markupPercentage: 25, roundUp: '100', saleDiscountPercentage: 0,
      isDefault: true, rank: 1,
    }],
  }, String(tenant), actor);

  const afterDelete = await Size.find({ subproduct: sp._id }).lean();
  assert.equal(afterDelete.length, 1, 'removed size must be deleted from the database');
  assert.equal(afterDelete[0].size, '35cl');

  const reloaded = await SubProduct.findById(sp._id).lean();
  assert.deepEqual(reloaded.sizes.map(String), [String(kept._id)], 'subProduct.sizes must not reference the deleted size');
  assert.notEqual(String(reloaded.defaultSize || ''), String(dropped._id), 'defaultSize must not point at the deleted size');
});

test('deleteSize deletes a no-stock size from the database and refuses a size with stock', { skip: !uri }, async t => {
  await connectVenueMongo(t, 'size_delete_endpoint');
  const oid = () => new mongoose.Types.ObjectId();
  const tenant = oid();
  const product = oid();
  const actor = { _id: oid(), role: 'tenant_owner', tenant };

  await require('../models/Tenant').collection.insertOne({
    _id: tenant, status: 'approved', subscriptionStatus: 'active', revenueModel: 'commission', commissionPercentage: 0,
  });
  await require('../models/Product').collection.insertOne({
    _id: product, name: 'Synthetic bottle', type: 'beer', status: 'approved', platformMarkup: 0,
  });

  const SubProduct = require('../models/SubProduct');
  const Size = require('../models/Size');
  const WarehouseStock = require('../models/WarehouseStock');
  const service = require('../services/subproduct.service');
  const sp = await SubProduct.create({
    tenant, product, sku: 'SIZE_DELETE_ENDPOINT', costPrice: 500, baseSellingPrice: 1000,
    status: 'draft', isPublished: false,
  });

  const empty = await Size.create({ subproduct: sp._id, product, tenant, size: '35cl', displayName: '35cl', stock: 0, reservedStock: 0, availableStock: 0, sellingPrice: 1000, costPrice: 500 });
  const stocked = await Size.create({ subproduct: sp._id, product, tenant, size: '75cl', displayName: '75cl', stock: 4, reservedStock: 0, availableStock: 4, sellingPrice: 1800, costPrice: 900 });
  await SubProduct.updateOne({ _id: sp._id }, { sizes: [empty._id, stocked._id] });

  // Allowed: no stock, no history — the edit page's immediate delete may run.
  await service.deleteSize(String(sp._id), String(empty._id), String(tenant), actor);
  assert.equal(await Size.exists({ _id: empty._id }), null, 'Size document must be deleted from the database');
  assert.equal(await WarehouseStock.exists({ size: empty._id }), null);
  const afterDelete = await SubProduct.findById(sp._id).lean();
  assert.deepEqual(afterDelete.sizes.map(String), [String(stocked._id)], 'subProduct.sizes must drop the deleted size');

  // Blocked: the stocked size must survive its delete attempt.
  await assert.rejects(
    () => service.deleteSize(String(sp._id), String(stocked._id), String(tenant), actor),
    /Cannot delete/
  );
  assert.ok(await Size.exists({ _id: stocked._id }), 'Stocked size must remain in the database');
});
