'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const uri = process.env.DRINKSHARBOUR_DIRECT_TEST_MONGO_URI;

test('marketplace reads and reserves only eligible stock at the selected tenant warehouse', { skip: !uri }, async t => {
  assert.match(uri, /^mongodb:\/\/127\.0\.0\.1:29128\/drinks_direct_test_[\w]+\?replicaSet=storefrontDirect$/);
  await mongoose.connect(uri.replace('?', `_${process.pid}?`), { serverSelectionTimeoutMS: 5000 });
  t.after(async () => { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });
  const Tenant = require('../models/Tenant');
  const Product = require('../models/Product');
  const SubProduct = require('../models/SubProduct');
  const Size = require('../models/Size');
  const Warehouse = require('../models/Warehouse');
  const Stock = require('../models/WarehouseStock');
  const Batch = require('../models/WarehouseBatch');
  const oid = () => new mongoose.Types.ObjectId();
  const [tenant, legacy, warehouse, other, product, subproduct, size, legacySize, missing] = Array.from({ length: 9 }, oid);
  await Tenant.collection.insertMany([{ _id: tenant, slug: 'warehouse-test', warehouseSettings: { defaultWarehouse: warehouse, marketplaceWarehouse: warehouse } }, { _id: legacy, slug: 'warehouse-legacy' }]);
  await Product.collection.insertOne({ _id: product, tracksBatch: true });
  await SubProduct.collection.insertOne({ _id: subproduct, tenant, product });
  await Warehouse.collection.insertMany([{ _id: warehouse, tenant, code: 'SELECTED', isActive: true }, { _id: other, tenant, code: 'OTHER', isActive: true }]);
  await Size.collection.insertMany([
    { _id: size, tenant, subproduct, status: 'active', stock: 40, availableStock: 38, availability: 'available' },
    { _id: missing, tenant, subproduct, status: 'active', stock: 40, availableStock: 40, availability: 'available' },
    { _id: legacySize, tenant: legacy, stock: 9, availableStock: 8, availability: 'available' },
  ]);
  await Stock.collection.insertMany([
    { tenant, warehouse, subProduct: subproduct, size, currentQuantity: 10, reservedQuantity: 2 },
    { tenant, warehouse: other, subProduct: subproduct, size, currentQuantity: 30 },
    { tenant: legacy, warehouse, subProduct: subproduct, size: missing, currentQuantity: 40 },
  ]);
  await Batch.collection.insertMany([
    { tenant, warehouse, subProduct: subproduct, size, batchNumber: 'LIVE', quantity: 5 },
    { tenant, warehouse, subProduct: subproduct, size, batchNumber: 'OLD', quantity: 3, expiryDate: new Date(0) },
    { tenant, warehouse: other, subProduct: subproduct, size, batchNumber: 'OTHER', quantity: 30 },
  ]);

  const context = require('../services/marketContext');
  const catalog = require('../services/marketCatalog');
  const stock = require('../services/marketplaceWarehouseStock');
  const pipeline = [
    { $match: { _id: product } },
    { $lookup: { from: 'subproducts', localField: '_id', foreignField: 'product', as: 'offers', pipeline: [
      { $lookup: { from: 'sizes', localField: '_id', foreignField: 'subproduct', as: 'sizes', pipeline: [
        { $match: { stock: { $gt: 0 } } },
      ] } },
    ] } },
  ];
  const browse = () => context.runMarket('NG', () => catalog.productAggregate(pipeline), { marketplaceStock: true });
  const storedProduct = (await browse())[0];
  assert.deepEqual(storedProduct.offers[0].sizes.map(s => s.availableStock), [5]);
  assert.equal((await catalog.productAggregate(pipeline))[0].offers[0].sizes.length, 2);

  const [offer] = await stock.scopeOffers([{ _id: subproduct, tenant: { _id: tenant, warehouseSettings: { marketplaceWarehouse: warehouse } },
    sizes: [{ _id: size, stock: 40 }, { _id: missing, stock: 40 }] }]);
  assert.deepEqual(offer.sizes.map(s => s.stock), [5, 0]);
  assert.equal(await stock.cartSizeStock({ _id: tenant, warehouseSettings: { marketplaceWarehouse: warehouse } }, subproduct, { _id: size }), 5);
  assert.equal(await stock.cartSizeStock({ _id: legacy }, subproduct, { _id: legacySize }), undefined);

  const create = require('../services/storefrontLocationOrders').createMappedOrder;
  await assert.rejects(create({ items: [{ tenant, subproduct, size, product, quantity: 6 }] }, [{ _id: tenant }]), /batch|stock/i);

  await Tenant.collection.updateOne({ _id: tenant }, { $set: { 'warehouseSettings.marketplaceWarehouses': [warehouse, other] } });
  assert.deepEqual((await browse())[0].offers[0].sizes.map(s => s.availableStock), [35]);

  await Warehouse.collection.updateOne({ _id: warehouse }, { $set: { isActive: false } });
  assert.deepEqual((await browse())[0].offers[0].sizes.map(s => s.availableStock), [30]);
  await Warehouse.collection.updateOne({ _id: other }, { $set: { isActive: false } });
  assert.equal((await browse())[0].offers[0].sizes.length, 0);
  await assert.rejects(create({ items: [{ tenant, subproduct, size, product, quantity: 1 }] }, [{ _id: tenant }]), /active default warehouse/i);
});
