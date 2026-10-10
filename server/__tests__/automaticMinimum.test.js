const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  automaticMinimum,
  freshMinimum,
} = require('../services/restock/minimum');
const now = new Date('2026-10-10T10:00:00Z');
const policy = (values, extra = {}) =>
  automaticMinimum({
    values,
    forecast: {
      method: 'historical_baseline',
      daily: Array(90).fill(values.reduce((a, b) => a + b, 0) / values.length),
    },
    fallback: 10,
    lead: { days: 7, source: 'planning_default' },
    now,
    ...extra,
  });
test('minimum grows with sales speed and delivery time', () => {
  assert.equal(policy(Array(40).fill(1)).units, 9);
  assert.equal(policy(Array(40).fill(3)).units, 27);
  assert.equal(
    policy(Array(40).fill(1), {
      lead: { days: 21, source: 'purchase_history' },
    }).units,
    23,
  );
});
test('variability adds a safety buffer without counting lead demand twice', () => {
  const stable = policy(Array(40).fill(1)),
    variable = policy(Array.from({ length: 40 }, (_, i) => (i % 2 ? 2 : 0)));
  assert.ok(variable.units > stable.units);
  assert.equal(stable.safetyUnits, 2);
});
test('missing or ambiguous history keeps fallback instead of inventing demand', () => {
  assert.equal(policy([]).status, 'learning');
  assert.equal(policy([]).units, 10);
  assert.equal(
    policy(Array(40).fill(1), { incomplete: true }).status,
    'incomplete',
  );
  assert.equal(policy(Array(40).fill(0)).status, 'learning');
});
test('downward changes are bounded and repeated same-day refresh does not compound', () => {
  const previous = {
    version: 'dh-stock-min-v1',
    units: 40,
    calculatedAt: '2026-10-09T10:00:00Z',
    validUntil: '2026-10-11T10:00:00Z',
  };
  const first = policy(Array(40).fill(1), { previous });
  assert.equal(first.units, 30);
  assert.equal(policy(Array(40).fill(1), { previous: first }).units, 30);
  assert.equal(freshMinimum(previous, new Date('2026-10-12')), null);
});
test('saved automatic minimum drives stock-only flags until it expires', () => {
  const { normalizeStock } = require('../services/tenantProductInsights.stock');
  const { computeStockFlags } = require('../services/warehouseStock.helpers');
  const automaticMinimum = {
    ...policy(Array(40).fill(3)),
    calculatedAt: now,
    validUntil: new Date(now.getTime() + 86400000),
  };
  const row = {
    currentQuantity: 20,
    reservedQuantity: 0,
    minStockLevel: 10,
    automaticMinimum,
  };
  assert.equal(
    normalizeStock({ lowStockThreshold: 10 }, [row], [], now).stock[0]
      .threshold,
    27,
  );
  assert.equal(computeStockFlags(row, {}, now).lowStock, true);
  assert.equal(
    computeStockFlags(row, {}, new Date(now.getTime() + 2 * 86400000)).lowStock,
    false,
  );
});
test('policy writes are scoped, optimistic, and never create stock records', async () => {
  const { persistMinimums } = require('../services/restock/minimum-storage');
  let ops;
  const Stock = {
    bulkWrite: async (value) => {
      ops = value;
    },
  };
  await persistMinimums(
    'tenant',
    {
      lines: [
        {
          stockRecordId: 'stock',
          warehouseId: 'w',
          subProductId: 'p',
          sizeId: 's',
          minimumPolicy: policy(Array(40).fill(1)),
          previousMinimumAt: 'old',
        },
        { stockRecordId: 'unknown', minimumPolicy: { status: 'learning' } },
      ],
    },
    Stock,
  );
  assert.equal(ops.length, 1);
  assert.deepEqual(ops[0].updateOne.filter, {
    _id: 'stock',
    tenant: 'tenant',
    warehouse: 'w',
    subProduct: 'p',
    size: 's',
    'automaticMinimum.calculatedAt': 'old',
  });
  assert.equal(ops[0].updateOne.upsert, false);
  assert.equal(ops[0].updateOne.update.$set.minStockLevel, undefined);
});
test('delivery history uses exact destination and size, not another warehouse supplier', () => {
  const { minimumLead } = require('../services/restock/minimum-lead');
  const line = { subProductId: 'p', sizeId: 's', warehouseId: 'shop' };
  const history = [1, 2, 3].map((i) => ({
    transferId: String(i),
    subProductId: 'p',
    sizeId: 's',
    sourceWarehouseId: 'hub',
    destinationWarehouseId: 'shop',
    transitDays: 2,
  }));
  assert.deepEqual(minimumLead(line, { purchases: [] }, { history }, now), {
    days: 2,
    source: 'transfer_history',
  });
  assert.deepEqual(
    minimumLead(
      { ...line, sizeId: 'other' },
      { purchases: [] },
      { history },
      now,
    ),
    { days: 7, source: 'planning_default' },
  );
});
test('planning persists only explicitly authorized full demand refreshes', async () => {
  const { createPlanningService } = require('../services/restock/service');
  let writes = 0;
  const reader = async () => ({
    products: [],
    warehouses: [],
    snapshots: new Map(),
    sales: { rows: [], uncertain: new Set() },
    purchases: [],
    transfers: [],
    tenantId: 't',
  });
  const service = createPlanningService(
    reader,
    () => now,
    async () => writes++,
  );
  await service('t', { updateMinimum: true, includeSales: false });
  assert.equal(writes, 0);
  await service('t', { updateMinimum: true, includeSales: true });
  assert.equal(writes, 1);
  await service('t', { updateMinimum: false, includeSales: true });
  assert.equal(writes, 1);
});
test('inventory-only policy summaries expose the operational minimum, not sales inputs', () => {
  const { publicPlan } = require('../services/restock/access');
  const input = {
    lines: [
      {
        available: 10,
        threshold: 27,
        stockRecordId: 'internal',
        previousMinimumAt: 'old',
        minimumPolicy: policy(Array(40).fill(3)),
      },
    ],
  };
  const line = publicPlan(input, {
    inventory: true,
    reports: false,
    purchase: false,
  }).lines[0];
  assert.equal(line.minimumPolicy.units, 27);
  assert.equal(line.minimumPolicy.dailySales, undefined);
  assert.equal(line.stockRecordId, undefined);
  assert.equal(
    publicPlan(input, { inventory: false, reports: true, purchase: false })
      .lines[0].minimumPolicy,
    undefined,
  );
});
test('schema stores dated policy metadata while configured minimum remains separate', () => {
  const Stock = require('../models/WarehouseStock');
  const oid = 'a'.repeat(24);
  const row = new Stock({
    tenant: oid,
    warehouse: oid,
    subProduct: oid,
    size: oid,
    minStockLevel: 10,
    automaticMinimum: policy(Array(40).fill(1)),
  });
  assert.equal(row.validateSync(), undefined);
  assert.equal(row.minStockLevel, 10);
  assert.equal(row.automaticMinimum.units, 9);
  assert.ok(row.automaticMinimum.calculatedAt instanceof Date);
});
test('inventory reads expose the effective minimum without private demand inputs', () => {
  const { stockMinimumFields } = require('../services/restock/minimum');
  const row = { minStockLevel: 10, automaticMinimum: policy(Array(40).fill(3)) };
  const fields = stockMinimumFields(row, now);
  assert.equal(fields.minStockLevel, 27);
  assert.equal(fields.configuredMinStockLevel, 10);
  assert.equal(fields.minimumSource, 'automatic');
  assert.equal(fields.automaticMinimum, undefined);
  assert.equal(fields.dailySales, undefined);
  assert.equal(stockMinimumFields(row, new Date('2026-10-15')).minStockLevel, 10);
  assert.equal(require('../models/WarehouseStock').schema.path('automaticMinimum').options.select, false);
});
test('concurrent minimum refresh reports a conflict instead of serving an unsaved policy', async () => {
  const { persistMinimums } = require('../services/restock/minimum-storage');
  await assert.rejects(persistMinimums('tenant', { lines: [{
    stockRecordId: 'stock', warehouseId: 'w', subProductId: 'p', sizeId: 's',
    minimumPolicy: policy(Array(40).fill(1)),
  }] }, { bulkWrite: async () => ({ matchedCount: 0 }) }), /Minimum stock levels changed/);
});
test('all warehouse inventory views share the saved automatic minimum and redact its inputs', async (t) => {
  const Stock = require('../models/WarehouseStock');
  const Batch = require('../models/WarehouseBatch');
  const service = require('../services/warehouse.service');
  const current = new Date();
  const minimum = policy(Array(40).fill(3), { now: current });
  const row = { _id: 'stock', subProduct: 'p', size: 's', warehouse: 'w',
    currentQuantity: 20, reservedQuantity: 0, minStockLevel: 10, automaticMinimum: minimum };
  const cursor = (rows) => {
    const q = { select: () => q, populate: () => q, sort: () => q, lean: async () => rows };
    return q;
  };
  t.mock.method(Stock, 'find', (query) => {
    assert.equal(query.tenant, 't');
    return cursor([row]);
  });
  t.mock.method(Batch, 'find', () => cursor([]));
  const views = [await service.getWarehouseStock('w', 't'),
    await service.getAllStock('t'), await service.getStockByWarehouse('p', 't')];
  for (const [result] of views) {
    assert.equal(result.minStockLevel, 27);
    assert.equal(result.configuredMinStockLevel, 10);
    assert.equal(result.automaticMinimum, undefined);
    assert.equal(result.dailySales, undefined);
    if (result.flags) assert.equal(result.flags.lowStock, true);
  }
});
test('purchase lead time requires three fully received matching local orders', () => {
  const { minimumLead } = require('../services/restock/minimum-lead');
  const line = { subProductId: 'p', sizeId: 's', warehouseId: 'shop' };
  const purchases = [2, 4, 12].map((days, i) => ({ _id: String(i), status: 'received',
    warehouse: 'shop', confirmationDate: '2026-09-01',
    fullyReceivedDate: new Date(Date.parse('2026-09-01') + days * 86400000),
    items: [{ subProductId: 'p', sizeId: 's', receivedQty: 10 }] }));
  assert.deepEqual(minimumLead(line, { purchases }, { history: [] }, now),
    { days: 4, source: 'purchase_history' });
  assert.equal(minimumLead({ ...line, warehouseId: 'other' }, { purchases }, { history: [] }, now).source, 'planning_default');
  purchases[2].status = 'partially_received';
  assert.equal(minimumLead(line, { purchases }, { history: [] }, now).source, 'planning_default');
});
