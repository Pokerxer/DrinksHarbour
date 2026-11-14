'use strict';
// subproduct-deletion.js — a SubProduct with transactional history must be
// refused hard deletion (ConflictError, "archive instead"), while a clean one
// is deleted together with its Size docs and derived records.
//
// Regression context (2026-11-13): deleting a SubProduct used to hard-delete
// its Size docs unconditionally — including sizes referenced by InventoryMovement
// rows — and three orphan Size docs survived an out-of-band parent deletion
// (barcode investigation 6009803813156).

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { uri, connectVenueMongo } = require('./helpers/venueMongo');
const SubProduct = require('../models/SubProduct');
const Product = require('../models/Product');
const Size = require('../models/Size');
const InventoryMovement = require('../models/InventoryMovement');
const { deleteSubProduct, archiveSubProduct, restoreSubProduct } = require('../services/subproduct.service');
const { ConflictError } = require('../utils/errors');

const oid = () => new mongoose.Types.ObjectId();

async function seedListing(t, { withHistory = false } = {}) {
  await connectVenueMongo(t, 'spdeletehist');
  const tenant = oid();
  const product = oid();
  await Product.collection.insertOne({ _id: product, name: 'Guard test product', status: 'approved', tenantCount: 1, subProducts: [] });

  const subProduct = oid();
  const size = oid();
  await SubProduct.collection.insertOne({
    _id: subProduct, tenant, product, sku: 'GUARD-1', status: 'active',
    sizes: [size], defaultSize: size, totalStock: 0, availableStock: 0, costPrice: 100,
    baseSellingPrice: 200,
  });
  await Size.collection.insertOne({
    _id: size, tenant, subproduct: subProduct, size: '75cl',
    stock: 0, sellingPrice: 200, costPrice: 100,
  });

  if (withHistory) {
    await InventoryMovement.create({
      tenant, subProduct, product, size,
      type: 'received', category: 'in',
      quantity: 4, quantityBefore: 0, quantityAfter: 4,
      performedBy: oid(),
    });
  }

  return { subProduct: String(subProduct), size, product, tenant: String(tenant) };
}

test('deleteSubProduct refuses a listing with inventory history and points at archive', { skip: !uri }, async (t) => {
  const { subProduct, tenant } = await seedListing(t, { withHistory: true });
  await assert.rejects(
    () => deleteSubProduct(subProduct, tenant),
    (err) => {
      assert.ok(err instanceof ConflictError);
      assert.match(err.message, /history/i);
      assert.match(err.message, /archive/i);
      return true;
    }
  );
  // Nothing was destroyed
  assert.ok(await SubProduct.exists({ _id: subProduct }));
  assert.ok(await Size.exists({ subproduct: subProduct }));
});

test('deleteSubProduct removes a clean listing together with its sizes and derived records', { skip: !uri }, async (t) => {
  const { subProduct, size, product, tenant } = await seedListing(t);

  await deleteSubProduct(subProduct, tenant);

  assert.equal(await SubProduct.exists({ _id: subProduct }), null);
  assert.equal(await Size.exists({ _id: size }), null);
  const productDoc = await Product.findById(product).lean();
  assert.equal(productDoc.tenantCount, 0);
});

test('archiveSubProduct marks its sizes unavailable and restore recomputes them', { skip: !uri }, async (t) => {
  const { subProduct, size, tenant } = await seedListing(t);
  // give the size stock so restore recomputes availability from it
  await Size.updateOne({ _id: size }, { $set: { stock: 30, availableStock: 30 } });

  const archived = await archiveSubProduct(subProduct, tenant);
  assert.equal(archived.subProduct.status, 'archived');
  const archivedSize = await Size.findById(size).lean();
  assert.equal(archivedSize.availability, 'discontinued');

  const restored = await restoreSubProduct(subProduct, tenant);
  assert.equal(restored.subProduct.stockStatus, 'in_stock');
  const restoredSize = await Size.findById(size).lean();
  assert.equal(restoredSize.availability, 'available');
});
