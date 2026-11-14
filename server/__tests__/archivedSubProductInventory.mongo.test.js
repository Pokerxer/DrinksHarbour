'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { uri, connectVenueMongo } = require('./helpers/venueMongo');
const SubProduct = require('../models/SubProduct');
const Product = require('../models/Product');
const Brand = require('../models/Brand');
const Size = require('../models/Size');
const WarehouseStock = require('../models/WarehouseStock');
const { getMySubProducts } = require('../services/subproduct.service');
const { getInventoryValuation, getLowStockItems } = require('../services/inventory.service');
const { getAllStock, getWarehouseStock, getStockByWarehouse } = require('../services/warehouse.service');
const { getProductStock } = require('../services/product-stock.service');
const { getSalesCatalogue } = require('../services/sales-catalogue');
const { smartSearch } = require('../services/scanMatch.service');

test('archive filtering and current stock totals use the listing lifecycle for all its sizes', { skip: !uri }, async (t) => {
  await connectVenueMongo(t, 'archives');
  const oid = () => new mongoose.Types.ObjectId();
  const tenant = oid();
  const fallbackTenant = oid();
  const warehouse = oid();
  const product = oid();
  const brand = oid();
  await Brand.collection.insertOne({ _id: brand, name: 'Test brand', tradingAs: ['Harbourmark'] });
  await Product.collection.insertOne({ _id: product, name: 'Test product', brand, status: 'approved' });

  async function seed(owner, sku, status, quantities, ledger) {
    const subProduct = oid();
    const sizes = quantities.map(() => oid());
    await SubProduct.collection.insertOne({
      _id: subProduct, tenant: owner, product, sku, sizes,
      ...(status ? { status } : {}),
      totalStock: quantities.reduce((sum, quantity) => sum + quantity, 0),
      stockStatus: 'low_stock', costPrice: 100,
    });
    await Size.collection.insertMany(sizes.map((_id, i) => ({
      _id, tenant: owner, subproduct: subProduct, size: `${i + 1}L`,
      stock: quantities[i], costPrice: 100, sellingPrice: 200,
    })));
    if (ledger) {
      await WarehouseStock.collection.insertMany(sizes.map((size, i) => ({
        tenant: owner, subProduct, warehouse, size, currentQuantity: quantities[i],
      })));
    }
    return subProduct;
  }

  const active = await seed(tenant, 'ACTIVE', 'active', [2], true);
  const archived = await seed(tenant, 'ARCHIVED', 'archived', [3, 5], true);
  await seed(tenant, 'ARCHIVED-NO-LEDGER', 'archived', [9], false);
  await seed(fallbackTenant, 'LEGACY', undefined, [4], false);
  await seed(fallbackTenant, 'LEGACY-ARCHIVED', 'archived', [6], false);

  const normal = await getMySubProducts(tenant, { view: 'list', limit: 1 });
  assert.equal(normal.pagination.total, 1);
  assert.deepEqual(normal.subProducts.map(row => row.sku), ['ACTIVE']);
  const archiveList = await getMySubProducts(tenant, { view: 'list', status: 'archived' });
  assert.equal(archiveList.pagination.total, 2);
  assert.equal(archiveList.subProducts.find(row => row.sku === 'ARCHIVED').sizes.length, 2);
  const mixed = await getMySubProducts(tenant, { view: 'list', includeArchived: true });
  assert.equal(mixed.pagination.total, 3);

  await t.test('the purchase catalogue excludes archive rows before counting and paging', async () => {
    const catalogue = await getSalesCatalogue(tenant, { limit: 1, facets: 'true' });
    assert.equal(catalogue.pagination.total, 1);
    assert.deepEqual(catalogue.subProducts.map(row => row.sku), ['ACTIVE']);
    const archivedSearch = await getSalesCatalogue(tenant, { search: 'ARCHIVED' });
    assert.deepEqual(archivedSearch.subProducts, []);
  });

  await t.test('a fuzzy brand match in the purchase picker returns only current listings', async () => {
    const results = await smartSearch('Harbourmark', { tenantId: tenant, getSubProducts: getMySubProducts });
    assert.deepEqual(results.map(row => row.sku), ['ACTIVE']);
  });

  await t.test('an existing purchase order displays its archived listing and recorded size', async () => {
    const orderId = oid();
    const size = archiveList.subProducts.find(row => row.sku === 'ARCHIVED').sizes[0];
    await require('../models/PurchaseOrder').collection.insertOne({
      _id: orderId,
      tenant,
      items: [{
        subProductId: archived,
        subProductName: 'Recorded bottle',
        sizeId: size._id,
        sizeName: size.size,
        quantity: 3,
      }],
    });
    let response;
    const res = { status: () => res, json: body => { response = body; } };
    await require('../controllers/purchaseOrder.controller').getPurchaseOrder(
      { params: { id: orderId }, user: { tenant } },
      res,
      error => { throw error; },
    );
    const [line] = response.data.items;
    assert.equal(line.subProductId.sku, 'ARCHIVED');
    assert.equal(String(line.sizeId._id), String(size._id));
    assert.equal(line.subProductName, 'Recorded bottle');
    assert.equal(line.orderedQty, 3);
  });

  const stock = await getAllStock(tenant, {}, { includeUnstocked: true });
  assert.deepEqual(stock.map(row => row.subProductId), [String(active)]);
  assert.deepEqual((await getWarehouseStock(warehouse, tenant)).map(row => row.currentQuantity), [2]);
  assert.deepEqual(await getStockByWarehouse(archived, tenant), []);
  assert.deepEqual((await getProductStock(product, tenant)).subProducts.map(row => row.sku), ['ACTIVE']);
  assert.deepEqual((await getLowStockItems(tenant)).map(row => row.sku), ['ACTIVE']);
  assert.deepEqual(await getInventoryValuation(tenant), {
    totalItems: 1, totalUnits: 2, totalValue: 200, totalRetailValue: 400, potentialProfit: 200,
  });
  const fallback = await getInventoryValuation(fallbackTenant);
  assert.equal(fallback.totalUnits, 4);
  assert.equal(fallback.totalValue, 400);

  await SubProduct.collection.updateOne({ _id: active }, { $set: { status: 'archived' } });
  await seed(tenant, 'NO-LEDGER', 'active', [9], false);
  assert.equal((await getInventoryValuation(tenant)).totalUnits, 0);
  await SubProduct.collection.updateOne({ _id: archived }, { $set: { status: 'active' } });
  assert.equal((await getInventoryValuation(tenant)).totalUnits, 8);
  assert.equal(await WarehouseStock.countDocuments({ tenant }), 3);
});
