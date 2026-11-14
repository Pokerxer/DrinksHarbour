'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const mongoose = require('mongoose');
const Size = require('../models/Size');
const SubProduct = require('../models/SubProduct');
const Product = require('../models/Product');
const Tenant = require('../models/Tenant');
const service = require('../services/subproduct.service');
const { uri, connectVenueMongo } = require('./helpers/venueMongo');

test('archived listing sizes release a reused barcode without moving stock or identity', { skip: !uri }, async (t) => {
  await connectVenueMongo(t, 'archive_barcodes');
  const tenant = new mongoose.Types.ObjectId();
  const otherTenant = new mongoose.Types.ObjectId();
  await Tenant.collection.insertOne({ _id: tenant, status: 'approved', subscriptionStatus: 'active' });
  await Size.createIndexes();
  let sequence = 0;

  async function listing(status = 'active', owner = tenant) {
    const product = new mongoose.Types.ObjectId();
    const sku = `BARCODE-TEST-${++sequence}`;
    await Product.collection.insertOne({ _id: product, name: sku, status: 'approved', type: 'beer' });
    return SubProduct.create({
      product, tenant: owner, status, sku, costPrice: 100, baseSellingPrice: 150,
      isPublished: false, visibleInOnlineStore: false,
    });
  }
  function sizeInput(barcode, extra = {}) {
    return { size: '750ml', sellingPrice: 150, costPrice: 100, barcode, ...extra };
  }
  const id = (doc) => String(doc._id);
  const tenantId = String(tenant);
  const add = (parent, barcode, extra) => service.addSize(id(parent), sizeInput(barcode, extra), String(parent.tenant));
  async function archivedCopy(size) {
    return Size.findById(size._id).select('+archivedBarcode').lean();
  }

  await t.test('size creation can reuse a barcode after archiving its previous listing', async () => {
    const oldListing = await listing();
    const replacement = await listing();
    const unrelated = await listing('active', otherTenant);
    const code = '0000012345678';
    const oldSize = await add(oldListing, code, { stock: 7 });
    const foreign = await add(unrelated, code);
    await service.archiveSubProduct(id(oldListing), tenantId);
    const newSize = await add(replacement, code);

    assert.equal(newSize.barcode, code);
    const old = await archivedCopy(oldSize);
    assert.equal(old.barcode, undefined);
    assert.equal(old.archivedBarcode, code);
    assert.equal(old.stock, 7);
    assert.equal(String(old.subproduct), id(oldListing));
    assert.equal((await Size.findById(foreign._id)).barcode, code);
    const archiveDetail = await service.getSubProduct(id(oldListing), tenantId);
    assert.equal(archiveDetail.sizes[0].archivedBarcode, code);

    await service.restoreSubProduct(id(oldListing), tenantId);
    assert.equal((await archivedCopy(oldSize)).archivedBarcode, code);
    assert.equal((await archivedCopy(oldSize)).barcode, undefined);
    assert.equal(String((await Size.findOne({ tenant, barcode: code }))._id), id(newSize));
    await assert.rejects(add(await listing(), code), /already in use/i);
  });

  await t.test('editing a size can take a barcode from a legacy archive', async () => {
    const oldListing = await listing('archived');
    const replacement = await listing();
    const code = '0000098765432';
    const { insertedId } = await Size.collection.insertOne({
      tenant, subproduct: oldListing._id, size: '750ml', barcode: code,
    });
    const newSize = await add(replacement);
    const updated = await service.updateSize(id(replacement), id(newSize), { barcode: code }, tenantId);
    assert.equal(updated.barcode, code);
    assert.equal((await archivedCopy({ _id: insertedId })).archivedBarcode, code);
  });

  await t.test('the full listing editor can save a reused barcode on an existing size', async () => {
    const oldListing = await listing('archived');
    const replacement = await listing();
    const code = '0000022222222';
    await Size.collection.insertOne({ tenant, subproduct: oldListing._id, size: '750ml', barcode: code });
    const size = await add(replacement);
    const saved = await service.updateSubProduct(id(replacement), {
      sizes: [{ ...sizeInput(code), _id: id(size) }],
    }, tenantId);
    assert.equal(saved.sizes[0].barcode, code);
    assert.equal(String((await Size.findOne({ tenant, barcode: code }))._id), id(size));
  });

  await t.test('a new listing can claim a legacy archived barcode in the create flow', async () => {
    const oldListing = await listing('archived');
    const code = '0000055555555';
    await Size.collection.insertOne({ tenant, subproduct: oldListing._id, size: '750ml', barcode: code });
    const product = new mongoose.Types.ObjectId();
    await Product.collection.insertOne({ _id: product, name: 'New barcode test product', status: 'approved', type: 'beer' });
    const created = await service.createSubProduct({
      product: String(product), costPrice: 100, baseSellingPrice: 150,
      status: 'draft', isPublished: false, visibleInOnlineStore: false,
      sizes: [sizeInput(code)],
    }, tenantId, { _id: new mongoose.Types.ObjectId(), role: 'tenant_owner' });
    assert.equal(created.sizes[0].barcode, code);
    assert.equal(String((await Size.findOne({ tenant, barcode: code })).subproduct), id(created));
  });

  await t.test('the listing editor replaces and clears a barcode while omitted fields preserve it', async () => {
    const parent = await listing();
    const original = '0000090000001';
    const replacement = '0000090000002';
    const size = await add(parent, original);
    const save = barcode => service.updateSubProduct(id(parent), {
      sizes: [{ ...sizeInput(barcode), _id: id(size) }],
    }, tenantId);

    await save(` ${replacement} `);
    assert.equal((await archivedCopy(size)).barcode, replacement);
    await save(undefined);
    assert.equal((await archivedCopy(size)).barcode, replacement);
    await save('   ');
    assert.equal((await archivedCopy(size)).barcode, undefined);
    assert.equal((await add(await listing(), replacement)).barcode, replacement);

    await service.updateSize(id(parent), id(size), { barcode: original }, tenantId);
    await service.updateSize(id(parent), id(size), { barcode: '' }, tenantId);
    assert.equal((await archivedCopy(size)).barcode, undefined);
  });

  await t.test('a transactional size write can reuse a barcode', async () => {
    const oldListing = await listing('archived');
    const replacement = await listing();
    const code = '0000044444444';
    await Size.collection.insertOne({ tenant, subproduct: oldListing._id, size: '750ml', barcode: code });
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await Size.create([{ ...sizeInput(code), tenant, subproduct: replacement._id }], { session });
      });
    } finally {
      await session.endSession();
    }
    assert.equal(String((await Size.findOne({ tenant, barcode: code })).subproduct), id(replacement));
  });

  await t.test('a rolled-back size write leaves the archived record intact', async () => {
    const oldListing = await listing('archived');
    const replacement = await listing();
    const code = '0000077777777';
    const { insertedId } = await Size.collection.insertOne({
      tenant, subproduct: oldListing._id, size: '750ml', barcode: code,
    });
    const session = await mongoose.startSession();
    try {
      await assert.rejects(session.withTransaction(async () => {
        await Size.create([{ ...sizeInput(code), tenant, subproduct: replacement._id }], { session });
        throw new Error('Abort fixture');
      }), /Abort fixture/);
    } finally {
      await session.endSession();
    }
    const old = await archivedCopy({ _id: insertedId });
    assert.equal(old.barcode, code);
    assert.equal(old.archivedBarcode, undefined);
  });

  await t.test('competing assignments produce only one current owner', async () => {
    const oldListing = await listing('archived');
    const code = '0000033333333';
    await Size.collection.insertOne({ tenant, subproduct: oldListing._id, size: '750ml', barcode: code });
    const first = await listing();
    const second = await listing();
    const results = await Promise.allSettled([add(first, code), add(second, code)]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(await Size.countDocuments({ tenant, barcode: code }), 1);
  });

  await t.test('a size update cannot reassign another tenant’s archive', async () => {
    const foreign = await listing('archived', otherTenant);
    const replacement = await listing();
    const code = '0000066666666';
    const archived = await add(foreign, code);
    const size = await add(replacement);
    await assert.rejects(service.updateSize(
      id(replacement), id(size), { barcode: code, tenant: otherTenant }, tenantId,
    ), { statusCode: 403 });
    assert.equal((await archivedCopy(archived)).barcode, code);
    assert.equal((await archivedCopy(size)).barcode, undefined);
  });
});
