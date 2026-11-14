'use strict';
// The rule this file exists to protect: stock the ledger treats as sellable
// must be sellable on the marketplace. Reproduction of the 2026-11-14 report:
// a tenant added products through the admin UI (the pre-validate hook forces
// tracksBatch:true on every model-created product), stocked them through the
// warehouse adjustment/receipt paths (which create WarehouseStock rows but —
// by the ledger's own "untracked slack" rule — NO WarehouseBatch rows), and
// the marketplace pipeline answered out_of_stock because it sold
// min(freeStock, eligibleBatchQty) = 0. Reservation (salesReservations/allocate)
// and fulfillment (depleteBatchesFefo with no rows → no-op) are batch-agnostic:
// the display pipeline was the only component gating on batches.
//
// Also covers the checkout default-warehouse resolution: a tenant that selected
// marketplace warehouses but never set warehouseSettings.defaultWarehouse (and
// has no isDefault location) must still validate checkout against a selected,
// active warehouse — checkout_warehouse_unavailable is for tenants with
// NEITHER.
//
// Run:
//   DRINKSHARBOUR_DIRECT_TEST_MONGO_URI='mongodb://127.0.0.1:29128/drinks_direct_test_global?replicaSet=storefrontDirect' \
//     node --test __tests__/marketplaceUntrackedStock.mongo.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const uri = process.env.DRINKSHARBOUR_DIRECT_TEST_MONGO_URI;

test('untracked stock (no batch rows) sells as free stock; batch-capped SKUs stay capped', { skip: !uri }, async t => {
  assert.match(uri, /^mongodb:\/\/127\.0\.0\.1:29128\/drinks_direct_test_[\w]+\?replicaSet=storefrontDirect$/);
  await mongoose.connect(uri.replace('?', `_${process.pid}?`), { serverSelectionTimeoutMS: 5000 });
  t.after(async () => { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });

  const Tenant = require('../models/Tenant');
  const Product = require('../models/Product');
  const SubProduct = require('../models/SubProduct');
  const Size = require('../models/Size');
  const Warehouse = require('../models/Warehouse');
  const Batch = require('../models/WarehouseBatch');
  const oid = () => new mongoose.Types.ObjectId();
  const [tenant, product, batchedProduct, subproduct, batchedSub, size, batchedSize, warehouse, other] = Array.from({ length: 9 }, oid);

  await Tenant.collection.insertMany([
    { _id: tenant, slug: 'untracked-stock', warehouseSettings: { marketplaceWarehouses: [warehouse, other] } },
  ]);
  // Products created through the MODEL (like the admin UI does) — the
  // pre-validate hook stamps tracksBatch:true when the field is unset.
  const created = await Product.create([
    { _id: product, name: 'Sunblessed', slug: 'sunblessed-untracked', isAlcoholic: true },
    { _id: batchedProduct, name: 'Batched', slug: 'batched-cap', isAlcoholic: true },
  ], { validateBeforeSave: false });
  void created;
  await Product.collection.updateMany({}, { $set: { tracksBatch: true } });
  await SubProduct.collection.insertMany([
    { _id: subproduct, tenant, product, status: 'active', sku: 'PICKER-1', baseSellingPrice: 12200 },
    { _id: batchedSub, tenant, product: batchedProduct, status: 'active', sku: 'BATCH-1', baseSellingPrice: 5000 },
  ]);
  await Warehouse.collection.insertMany([
    { _id: warehouse, tenant, code: 'WH-A', isActive: true },
    { _id: other, tenant, code: 'WH-B', isActive: true },
  ]);
  await Size.collection.insertMany([
    { _id: size, tenant, subproduct, status: 'active', size: '75cl', stock: 10, availableStock: 10, availability: 'available' },
    { _id: batchedSize, tenant, subproduct: batchedSub, status: 'active', size: '75cl', stock: 10, availableStock: 10, availability: 'available' },
  ]);

  // Stock entered the way the tenant did it: warehouse adjustments — the
  // ledger's "untracked slack" path. NO WarehouseBatch rows for the first SKU.
  const warehouseService = require('../services/warehouse.service');
  const adjust = { quantity: 10, type: 'received', notes: 'manual stock-in' };
  await warehouseService.adjustStock({ warehouseId: String(warehouse), subProduct: String(subproduct), size: String(size), ...adjust }, oid(), String(tenant));
  await warehouseService.adjustStock({ warehouseId: String(other), subProduct: String(subproduct), size: String(size), quantity: 30, type: 'received' }, oid(), String(tenant));
  // The second SKU has batch rows — its cap must keep protecting it.
  await mongoose.connection.db.collection('warehousestocks').insertOne({
    tenant, warehouse, subProduct: batchedSub, size: batchedSize, currentQuantity: 10, reservedQuantity: 0,
  });
  await Batch.collection.insertMany([
    { tenant, warehouse, subProduct: batchedSub, size: batchedSize, batchNumber: 'LIVE', quantity: 4 },
    { tenant, warehouse, subProduct: batchedSub, size: batchedSize, batchNumber: 'OLD', quantity: 6, expiryDate: new Date(0) },
  ]);

  const stock = require('../services/marketplaceWarehouseStock');

  const [offer] = await stock.scopeOffers([{ _id: subproduct, tenant: { _id: tenant, warehouseSettings: { marketplaceWarehouses: [warehouse, other] } }, sizes: [{ _id: size, stock: 40 }] }]);
  assert.equal(offer.sizes[0].stock, 40, 'zero batch rows = untracked slack: the ledger stock sells as free stock, not out_of_stock');

  const [batched] = await stock.scopeOffers([{ _id: batchedSub, tenant: { _id: tenant, warehouseSettings: { marketplaceWarehouses: [warehouse, other] } }, sizes: [{ _id: batchedSize, stock: 10 }] }]);
  assert.equal(batched.sizes[0].stock, 4, 'batches present → eligible (unexpired) quantity still caps the SKU');

  assert.equal(await stock.cartSizeStock({ _id: tenant, warehouseSettings: { marketplaceWarehouses: [warehouse, other] } }, subproduct, { _id: size, status: 'active' }), 40);
});

test('checkout falls back to a selected active warehouse when no default is configured', { skip: !uri }, async t => {
  assert.match(uri, /^mongodb:\/\/127\.0\.0\.1:29128\/drinks_direct_test_[\w]+\?replicaSet=storefrontDirect$/);
  await mongoose.connect(uri.replace('?', `_${process.pid}_checkout?`), { serverSelectionTimeoutMS: 5000 });
  t.after(async () => { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });

  const Tenant = require('../models/Tenant');
  const Product = require('../models/Product');
  const SubProduct = require('../models/SubProduct');
  const Size = require('../models/Size');
  const Warehouse = require('../models/Warehouse');
  const Stock = require('../models/WarehouseStock');
  const oid = () => new mongoose.Types.ObjectId();
  const [tenant, noSelection, product, subproduct, size, warehouse] = Array.from({ length: 6 }, oid);

  // Selected warehouses, but NO warehouseSettings.defaultWarehouse and no
  // isDefault: true location — the exact picker-only configuration.
  await Tenant.collection.insertMany([
    { _id: tenant, slug: 'picker-only', status: 'approved', subscriptionStatus: 'active', revenueModel: 'commission', commissionPercentage: 13,
      warehouseSettings: { marketplaceWarehouses: [warehouse] } },
    { _id: noSelection, slug: 'nothing-selected', status: 'approved', subscriptionStatus: 'active', revenueModel: 'commission', commissionPercentage: 13 },
  ]);
  await Product.collection.insertOne({ _id: product, slug: 'picker-only-product', tracksBatch: false, type: 'wine' });
  await SubProduct.collection.insertMany([
    { _id: subproduct, tenant, product, status: 'active', sku: 'CHECKOUT-1', baseSellingPrice: 12200, isOnSale: false },
  ]);
  await Warehouse.collection.insertOne({ _id: warehouse, tenant, code: 'WH-A', isActive: true });
  await Stock.collection.insertOne({ tenant, warehouse, subProduct: subproduct, size, currentQuantity: 10, reservedQuantity: 0 });
  await Size.collection.insertOne({ _id: size, tenant, subproduct, status: 'active', size: '75cl', stock: 10, availableStock: 10, availability: 'available', lowStockThreshold: 6, maxOrderQuantity: 0 });

  const cartService = require('../services/cart.service');
  const item = { subProductId: String(subproduct), sizeId: String(size), quantity: 3, price: 12200 };

  const [result] = await cartService.validateCartItems([item], { checkout: true });
  assert.equal(result.status, 'ok', `checkout must validate against the selected warehouse (got ${result.status}: ${result.stockStatus})`);
  assert.equal(result.maxQuantity, 10);

  // A tenant with NEITHER a default NOR any selected warehouse keeps the
  // explicit unavailable answer.
  const missingSub = oid();
  const missingSize = oid();
  const missingProduct = oid();
  await Product.collection.insertOne({ _id: missingProduct, slug: 'no-selection-product', tracksBatch: false, type: 'wine' });
  await SubProduct.collection.insertOne({ _id: missingSub, tenant: noSelection, product: missingProduct, status: 'active', baseSellingPrice: 1000 });
  await Size.collection.insertOne({ _id: missingSize, tenant: noSelection, subproduct: missingSub, status: 'active', size: '75cl', stock: 10, availableStock: 10, availability: 'available', lowStockThreshold: 6, maxOrderQuantity: 0 });
  const [none] = await cartService.validateCartItems([{ subProductId: String(missingSub), sizeId: String(missingSize), quantity: 1, price: 1000 }], { checkout: true });
  assert.equal(none.stockStatus, 'checkout_warehouse_unavailable');
  assert.equal(none.available, false);
});
