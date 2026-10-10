const test = require('node:test');
const assert = require('node:assert/strict');
const {
  historyQuery,
  purchaseRow,
  getWarehouseHistory,
} = require('../services/warehouseHistory.service');
const warehouse = '111111111111111111111111';
const product = '222222222222222222222222';
test('warehouse histories retain tenant and exact location when combining product/date filters', () => {
  const query = historyQuery('t', warehouse, {
    kind: 'transfers',
    product,
    start: '2026-10-01',
    end: '2026-10-03',
  });
  assert.equal(query.tenant, 't');
  assert.deepEqual(query.$or, [
    { sourceWarehouse: warehouse },
    { destinationWarehouse: warehouse },
  ]);
  assert.equal(query['items.subProductId'], product);
  assert.equal(query.createdAt.$lt.toISOString(), '2026-10-04T00:00:00.000Z');
  const receipts = historyQuery('t', warehouse, { kind: 'purchases', product });
  assert.equal(receipts.$or[1].partialReceipts.$elemMatch.warehouseId, warehouse);
  assert.equal(receipts.$or[1].partialReceipts.$elemMatch['items.subProductId'], product);
});
test('purchase attribution includes only this location and excludes cancelled receipts', () => {
  const row = purchaseRow(
    {
      _id: 'po',
      poNumber: 'PO1',
      items: [],
      partialReceipts: [
        {
          warehouseId: warehouse,
          status: 'validated',
          items: [{ subProductId: product, quantityReceived: 4 }],
        },
        {
          warehouseId: 'other',
          status: 'validated',
          items: [{ subProductId: product, quantityReceived: 20 }],
        },
        {
          warehouseId: warehouse,
          status: 'cancelled',
          items: [{ subProductId: product, quantityReceived: 8 }],
        },
      ],
    },
    warehouse,
    product,
  );
  assert.equal(row.quantity, 4);
});
test('foreign or missing warehouses cannot expose document history', async () => {
  await assert.rejects(
    getWarehouseHistory(
      't',
      warehouse,
      {},
      {
        Warehouse: {
          findOne: (query) => {
            assert.deepEqual(query, { _id: warehouse, tenant: 't' });
            return { select: () => ({ lean: async () => null }) };
          },
        },
      },
    ),
    /not found/i,
  );
});
test('invalid dates, reversed ranges and unsupported history kinds are rejected', () => {
  assert.throws(() => historyQuery('t', warehouse, { kind: 'wrong' }), /history/i);
  assert.throws(() => historyQuery('t', warehouse, { start: '2026-02-30' }), /date/i);
  assert.throws(
    () => historyQuery('t', warehouse, { start: '2026-10-03', end: '2026-10-01' }),
    /date/i,
  );
});

test('transfer returns are included through their parent movement regardless of free-text reference', () => {
  const query = historyQuery('t', warehouse, { kind: 'transfer_movements' });
  assert.deepEqual(query.$or[1].parentMovement, { $ne: null });
});

test('history pages scope both rows and count and keep transfer direction and returns', async () => {
  const seen = {};
  const cursor = {};
  for (const method of ['sort', 'skip', 'limit', 'select', 'populate'])
    cursor[method] = (value) => {
      seen[method] = value;
      return cursor;
    };
  cursor.lean = async () => [
    {
      _id: 'tr',
      transferNumber: 'TR1',
      destinationWarehouse: { _id: warehouse, name: 'Here' },
      sourceWarehouse: { _id: 'other', name: 'Other' },
      items: [{ subProductId: product, receivedQty: 10, returnedQty: 3 }],
      total: 700,
    },
  ];
  const result = await getWarehouseHistory(
    't',
    warehouse,
    { kind: 'transfers', page: 2, limit: 5, product },
    {
      Warehouse: { findOne: () => ({ select: () => ({ lean: async () => ({ name: 'Here' }) }) }) },
      StockTransfer: {
        find: (query) => {
          seen.query = query;
          return cursor;
        },
        countDocuments: async (query) => {
          assert.deepEqual(query, seen.query);
          return 12;
        },
      },
    },
  );
  assert.equal(seen.skip, 5);
  assert.equal(seen.limit, 5);
  assert.equal(seen.query.tenant, 't');
  assert.equal(result.rows[0].description, 'Incoming from Other');
  assert.equal(result.rows[0].quantity, 10);
  assert.equal(result.rows[0].returned, 3);
  assert.equal(result.rows[0].amount, 700);
  assert.deepEqual(result.pagination, { page: 2, limit: 5, total: 12, totalPages: 3 });
});

test('multiple products intersect status/date/reference search without losing location scope', () => {
  const second = '333333333333333333333333';
  const q = historyQuery('t', warehouse, {
    kind: 'transfers',
    product: `${product},${second}`,
    status: 'completed',
    search: 'TR(1)',
    start: '2026-10-01',
  });
  assert.equal(q.tenant, 't');
  assert.deepEqual(q.$or, [{ sourceWarehouse: warehouse }, { destinationWarehouse: warehouse }]);
  assert.deepEqual(q['items.subProductId'], { $in: [product, second] });
  assert.equal(q.status, 'completed');
  assert.equal(q.transferNumber.test('TR(1)'), true);
  assert.equal(q.transferNumber.test('TR1'), false);
  assert.equal(q.createdAt.$gte.toISOString(), '2026-10-01T00:00:00.000Z');
  const purchase = historyQuery('t', warehouse, {
    kind: 'purchases',
    product: `${product},${second}`,
    search: 'supplier',
  });
  assert.equal(purchase.$or[1].partialReceipts.$elemMatch.warehouseId, warehouse);
  assert.equal(purchase.$and[0].$or[1].vendorName.test('Supplier'), true);
});
test('selected product quantities sum multiple products at this warehouse only', () => {
  const second = '333333333333333333333333';
  const row = purchaseRow(
    {
      items: [],
      partialReceipts: [
        {
          warehouseId: warehouse,
          items: [
            { subProductId: product, quantityReceived: 4 },
            { subProductId: second, quantityReceived: 6 },
            { subProductId: '444444444444444444444444', quantityReceived: 100 },
          ],
        },
      ],
    },
    warehouse,
    `${product},${second}`,
  );
  assert.equal(row.quantity, 10);
});
test('rejects invalid status, product lists and oversized reference searches', () => {
  assert.throws(() => historyQuery('t', warehouse, { product: `${product},invalid` }), /product/i);
  assert.throws(() => historyQuery('t', warehouse, { status: 'invalid' }), /status/i);
  assert.throws(() => historyQuery('t', warehouse, { search: 'x'.repeat(201) }), /search/i);
});

test('product choices include historical and planned warehouse documents, not just current stock', async () => {
  const { getWarehouseHistoryProducts } = require('../services/warehouseHistory.products');
  const seen = [];
  const distinct = (field, query) => {
    seen.push({ field, query });
    return Promise.resolve([product]);
  };
  const result = await getWarehouseHistoryProducts('t', warehouse, {
    Warehouse: {
      findOne: (query) => {
        assert.deepEqual(query, { _id: warehouse, tenant: 't' });
        return { select: () => ({ lean: async () => ({ _id: warehouse }) }) };
      },
    },
    WarehouseStock: { distinct },
    WarehouseMovement: { distinct },
    StockTransfer: { distinct },
    PurchaseOrder: { distinct },
    SubProduct: {
      find: (query) => {
        assert.equal(query.tenant, 't');
        assert.deepEqual(query._id.$in, [product]);
        return {
          select: () => ({
            populate: () => ({
              lean: async () => [{ _id: product, sku: 'W1', product: { name: 'Historical wine' } }],
            }),
          }),
        };
      },
    },
  });
  assert.equal(seen.length, 4);
  assert.ok(seen.every((item) => item.query.tenant === 't'));
  assert.deepEqual(result, [{ id: product, label: 'Historical wine · W1' }]);
});

test('history product choices reject a foreign warehouse before reading documents', async () => {
  const { getWarehouseHistoryProducts } = require('../services/warehouseHistory.products');
  await assert.rejects(
    getWarehouseHistoryProducts('t', warehouse, {
      Warehouse: { findOne: () => ({ select: () => ({ lean: async () => null }) }) },
      WarehouseStock: {
        distinct: () => {
          throw new Error('Should never query');
        },
      },
    }),
    /not found/i,
  );
});
test('return type and literal reference search intersect transfer movement scope', () => {
  const query = historyQuery('t', warehouse, {
    kind: 'transfer_movements',
    status: 'returned',
    search: '(return)',
  });
  assert.equal(query.warehouse, warehouse);
  assert.equal(query.type, 'returned');
  assert.deepEqual(query.$or[1].parentMovement, { $ne: null });
  assert.equal(query.reference.test('(return)'), true);
  assert.throws(
    () => historyQuery('t', warehouse, { kind: 'purchases', status: 'transfer_out' }),
    /status/i,
  );
});

test('transfer totals use every matching document and do not depend on the paged rows', async () => {
  const docs = Array.from({ length: 3 }, (_, index) => ({
    _id: `tr${index}`,
    sourceWarehouse: { _id: warehouse },
    destinationWarehouse: { _id: 'other', name: 'Other' },
    total: 100,
    items: [{ quantity: 1, transferredQty: 1, costPrice: 100 }],
  }));
  const queries = [];
  const chain = (values) => {
    const cursor = {};
    for (const method of ['sort', 'skip', 'limit', 'select', 'populate'])
      cursor[method] = () => cursor;
    cursor.lean = async () => values;
    return cursor;
  };
  const result = await getWarehouseHistory(
    't',
    warehouse,
    { kind: 'transfers', page: 2, limit: 1 },
    {
      Warehouse: { findOne: () => ({ select: () => ({ lean: async () => ({ name: 'Here' }) }) }) },
      StockTransfer: {
        find: (query) => {
          queries.push(query);
          return chain(queries.length === 1 ? [docs[1]] : docs);
        },
        countDocuments: async () => 3,
      },
    },
  );
  assert.equal(result.rows.length, 1);
  assert.deepEqual(queries[0], queries[1]);
  assert.equal(result.transferTotals.currencies[0].outgoingValue, 300);
  assert.equal(result.transferTotals.currencies[0].outgoingQuantity, 3);
});

test('purchase totals use all matching orders while rows remain paginated and returns stay tenant-scoped', async () => {
  const order = {
    _id: 'po',
    warehouse,
    items: [
      { subProductId: product, quantity: 10, receivedQty: 8, returnedQty: 2, totalCost: 1000 },
    ],
  };
  const seen = [];
  const cursor = (orders) => {
    const c = { lean: async () => orders };
    for (const method of ['select', 'sort', 'skip', 'limit']) c[method] = () => c;
    return c;
  };
  let finds = 0;
  const result = await getWarehouseHistory(
    't',
    warehouse,
    { kind: 'purchases', page: 2, limit: 1, product },
    {
      Warehouse: { findOne: () => ({ select: () => ({ lean: async () => ({ name: 'Here' }) }) }) },
      PurchaseOrder: {
        find: (query) => {
          seen.push(query);
          return cursor(++finds === 1 ? [order] : [order, { ...order, _id: 'po2' }]);
        },
        countDocuments: async () => 2,
      },
      VendorReturn: {
        find: (query) => {
          assert.equal(query.tenant, 't');
          assert.deepEqual(query.purchaseOrder.$in, ['po', 'po2']);
          assert.equal(query.stockAdjusted, true);
          return cursor([
            {
              purchaseOrder: 'po',
              warehouse,
              stockAdjusted: true,
              status: 'confirmed',
              items: [{ subProductId: product, quantity: 2, amount: 200 }],
            },
          ]);
        },
      },
    },
  );
  assert.deepEqual(seen[0], seen[1]);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].purchasedQuantity, 8);
  assert.equal(result.purchaseTotals.currencies[0].receivedQuantity, 20);
  assert.equal(result.purchaseTotals.currencies[0].netReceivedQuantity, 16);
  assert.equal(result.pagination.page, 2);
});

test('stock history totals ignore pagination and use the same tenant warehouse filters', async () => {
  const rows = [
    { _id: 'one', type: 'received', quantity: 10, balanceAfter: 10 },
    { _id: 'two', type: 'adjusted', quantity: 7, balanceBefore: 10, balanceAfter: 7 },
  ];
  let calls = 0;
  let filter;
  const cursor = (documents) => {
    const result = { lean: async () => documents };
    for (const method of ['sort', 'skip', 'limit', 'select', 'populate'])
      result[method] = () => result;
    return result;
  };
  const result = await getWarehouseHistory(
    'tenant',
    warehouse,
    { kind: 'movements', page: 2, limit: 1, product },
    {
      Warehouse: { findOne: () => ({ select: () => ({ lean: async () => ({ name: 'Here' }) }) }) },
      WarehouseMovement: {
        find: (query) => {
          if (!filter) filter = query;
          else assert.deepEqual(query, filter);
          return cursor(++calls === 1 ? [rows[1]] : rows);
        },
        countDocuments: async () => 2,
      },
    },
  );
  assert.equal(filter.tenant, 'tenant');
  assert.equal(filter.warehouse, warehouse);
  assert.equal(filter.subProduct, product);
  assert.equal(result.rows[0].stockChange, -3);
  assert.equal(result.rows[0].balanceBefore, 10);
  assert.equal(result.movementTotals.incomingQuantity, 10);
  assert.equal(result.movementTotals.outgoingQuantity, 3);
  assert.equal(result.movementTotals.netQuantity, 7);
  assert.equal(result.movementTotals.records, 2);
});
