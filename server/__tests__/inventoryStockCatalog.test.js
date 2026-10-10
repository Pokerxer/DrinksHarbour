const test = require('node:test');
const assert = require('node:assert/strict');
const WarehouseStock = require('../models/WarehouseStock');
const WarehouseBatch = require('../models/WarehouseBatch');
const SubProduct = require('../models/SubProduct');
const { getAllStock } = require('../services/warehouse.service');

function fixture(t) {
  const cursor = (rows) => {
    const q = { populate: () => q, select: () => q, lean: async () => rows };
    return q;
  };
  t.mock.method(WarehouseStock, 'find', (query) => {
    assert.deepEqual(query, { tenant: 'tenant' });
    return cursor(
      [0, -3, 8].map((quantity, i) => ({
        _id: `row${i}`,
        currentQuantity: quantity,
        subProduct: { _id: 'existing', sku: 'EX', imagesOverride: [{ url: 'https://example.com/tenant.jpg' }], product: { name: 'Existing', images: [{ url: 'https://example.com/catalogue.jpg' }] } },
        size: { _id: `size${i}`, size: '75cl', costPrice: 10 },
        warehouse: { _id: `wh${i}`, name: `Warehouse ${i}` },
      })),
    );
  });
  t.mock.method(WarehouseBatch, 'find', () => cursor([]));
  const seen = [];
  t.mock.method(SubProduct, 'find', (query) => {
    assert.deepEqual(query, { tenant: 'tenant' });
    const q = cursor([
      {
        _id: 'existing',
        sku: 'EX',
        product: { name: 'Existing' },
        sizes: [
          { _id: 'size0', size: '75cl' },
          { _id: 'size1', size: '75cl' },
          { _id: 'size2', size: '75cl' },
          { _id: 'newsize', size: '1L' },
        ],
      },
      {
        _id: 'new',
        sku: 'NEW',
        costPrice: 12,
        baseSellingPrice: 20,
        product: { name: 'Never stocked', images: [{ url: 'https://example.com/new.jpg' }], category: { _id: 'cat', name: 'Wine' } },
        sizes: [{ _id: 'new75', size: '75cl', sellingPrice: 25, unitsPerPack: 6 }],
      },
      { _id: 'noSizes', sku: 'BASE', product: { name: 'No sizes' }, sizes: [] },
    ]);
    q.populate = (value) => {
      seen.push(value);
      return q;
    };
    return q;
  });
  return seen;
}
test('stock catalog includes nonpositive warehouse quantities and missing product sizes at zero', async (t) => {
  const seen = fixture(t);
  const rows = await getAllStock('tenant', {}, { includeUnstocked: true });
  assert.equal(rows.length, 6);
  assert.equal(rows[0].productImage, 'https://example.com/tenant.jpg');
  assert.deepEqual(
    rows.slice(0, 3).map((row) => row.currentQuantity),
    [0, -3, 8],
  );
  assert.equal(rows.filter((row) => row.sizeId === 'size0').length, 1);
  const added = rows.find((row) => row.subProductId === 'new');
  assert.equal(added.currentQuantity, 0);
  assert.equal(added.warehouseId, '');
  assert.equal(added.warehouseName, 'Unassigned');
  assert.equal(added.flags.outOfStock, true);
  assert.equal(added.productName, 'Never stocked');
  assert.equal(added.productImage, 'https://example.com/new.jpg');
  assert.equal(added.categoryName, 'Wine');
  assert.equal(added.costPrice, 12);
  assert.equal(added.sellingPrice, 25);
  assert.equal(added.unitsPerPack, 6);
  assert.equal(rows.find((row) => row.subProductId === 'noSizes').currentQuantity, 0);
  assert.deepEqual(seen.find((value) => value.path === 'sizes').match, { tenant: 'tenant' });
});
test('warehouse analysis remains ledger-only unless catalog completion is explicitly requested', async (t) => {
  fixture(t);
  const rows = await getAllStock('tenant');
  assert.equal(rows.length, 3);
  assert.deepEqual(
    rows.map((row) => row.currentQuantity),
    [0, -3, 8],
  );
  assert.equal(rows[1].flags.outOfStock, true);
});
test('no-size catalog rows honor an explicit tenant-owned warehouse assignment without creating quantity', async (t) => {
  fixture(t);
  const seen = [];
  t.mock.method(SubProduct, 'find', () => {
    const q = {
      select: () => q,
      populate: (value) => { seen.push(value); return q; },
      lean: async () => [{ _id: 'assignedNoSize', sku: 'NS', product: { name: 'No size assigned' }, sizes: [], warehouse: { _id: 'wh', name: 'Wyn City', tenant: 'tenant' } }],
    };
    return q;
  });
  const rows = await getAllStock('tenant', {}, { includeUnstocked: true });
  const assigned = rows.find(row => row.subProductId === 'assignedNoSize');
  assert.equal(assigned.warehouseId, 'wh');
  assert.equal(assigned.warehouseName, 'Wyn City');
  assert.equal(assigned.currentQuantity, 0);
  assert.equal(assigned.sizeId, '');
  assert.deepEqual(seen.find(value => value.path === 'warehouse').match, { tenant: 'tenant' });
});
test('catalog placeholders never accept a warehouse owned by another tenant', async (t) => {
  fixture(t);
  t.mock.method(SubProduct, 'find', () => {
    const q = {
      select: () => q, populate: () => q,
      lean: async () => [{ _id: 'crossTenant', sku: 'NO', sizes: [], warehouse: { _id: 'foreign', name: 'Private warehouse', tenant: 'other' } }],
    };
    return q;
  });
  const rows = await getAllStock('tenant', {}, { includeUnstocked: true });
  const placeholder = rows.find(row => row.subProductId === 'crossTenant');
  assert.equal(placeholder.warehouseId, '');
  assert.equal(placeholder.warehouseName, 'Unassigned');
});
test('stock report carries all remaining FIFO layer value including quarantined stock, while preserving next-issue price', async (t) => {
  fixture(t);
  t.mock.method(WarehouseStock, 'find', () => {
    const q = { select: () => q, populate: () => q, lean: async () => [{ _id: 'row', currentQuantity: 20, reservedQuantity: 4, subProduct: { _id: 'p', costPrice: 80, product: { name: 'Wine' } }, size: { _id: 's' }, warehouse: { _id: 'w' } }] };
    return q;
  });
  t.mock.method(WarehouseBatch, 'find', query => {
    assert.equal(query.tenant, 'tenant');
    assert.equal(query.quarantined, undefined, 'quarantined units still carry inventory cost');
    const q = { select: () => q, lean: async () => [
      { warehouse: 'w', subProduct: 'p', size: 's', quantity: 5, unitCost: 100, receivedDate: '2026-01-01' },
      { warehouse: 'w', subProduct: 'p', size: 's', quantity: 15, unitCost: 200, receivedDate: '2026-02-01', quarantined: true },
    ] };
    return q;
  });
  const [report] = await getAllStock('tenant', { valuationMethod: 'fifo' });
  assert.equal(report.costPrice, 100);
  assert.equal(report.stockValue, 3500);
  assert.equal(report.valuationUnitCost, 175);
  assert.equal(report.reservedQuantity, 4);
  assert.equal(report.estimatedQuantity, 0);
});
