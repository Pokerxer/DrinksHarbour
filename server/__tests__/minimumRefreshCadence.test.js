const test = require('node:test');
const assert = require('node:assert/strict');
const { applyMinimum, VERSION } = require('../services/restock/minimum');
const { planningController } = require('../services/restock/controller');
const now = new Date('2026-10-12T12:00:00Z');
test('read-only planning uses the saved minimum even with newer demand available', () => {
  const line = {
    warehouseId: 'w',
    subProductId: 'p',
    sizeId: 's',
    threshold: 10,
  };
  const policy = {
    version: VERSION,
    status: 'active',
    units: 20,
    safetyUnits: 5,
    calculatedAt: now.toISOString(),
    validUntil: '2026-10-14T12:00:00Z',
  };
  applyMinimum(
    line,
    { threshold: 10, configuredThreshold: 10, automaticMinimum: policy },
    {
      e: { salesIncluded: true, purchases: [], transfers: [] },
      values: Array(28).fill(4),
      forecast: { daily: Array(90).fill(4) },
      facts: { pending: [], history: [] },
      incomplete: false,
      now,
      useSavedMinimum: true,
    },
  );
  assert.equal(line.threshold, 20);
  assert.equal(line.buffer, 5);
});
test('ordinary planning endpoints do not persist or recalculate automatic minima', async () => {
  const calls = [];
  const c = planningController(
    async (_tenant, options) => {
      calls.push(options);
      return { lines: [], generatedAt: now.toISOString() };
    },
    async () => {},
  );
  for (const handler of [c.warehouseRisk, c.demand, c.orderPlan]) {
    await new Promise((resolve, reject) =>
      handler(
        {
          user: {
            _id: 'u',
            tenant: 'own',
            role: 'tenant_owner',
            status: 'active',
          },
          query: {},
        },
        { json: resolve },
        reject,
      ),
    );
  }
  assert.ok(
    calls.every((o) => o.updateMinimum === false && o.useSavedMinimum === true),
  );
});
test('background minimum refresh runs at midnight and noon Lagos with shared eligible persistence', async (t) => {
  let scheduled,
    run,
    registrations = 0;
  t.mock.method(
    require('node-cron'),
    'schedule',
    (expression, callback, options) => {
      registrations++;
      scheduled = { expression, options };
      run = callback;
      return {};
    },
  );
  t.mock.method(require('../models/Tenant'), 'find', () => ({
    select: () => ({
      lean: () => ({
        async *cursor() {
          yield { _id: 'own' };
        },
      }),
    }),
  }));
  let plans = 0;
  t.mock.method(
    require('../services/restock/service'),
    'getPlan',
    async (tenant, options) => {
      assert.equal(tenant, 'own');
      assert.equal(options.includeSales, true);
      assert.equal(options.updateMinimum, true);
      assert.equal(options.refresh, true);
      plans++;
      return { lines: [] };
    },
  );
  t.mock.method(
    require('../services/restock/notifications'),
    'syncForecastNotifications',
    async () => {},
  );
  const path = require.resolve('../jobs/tenantDemandForecast.job');
  delete require.cache[path];
  t.after(() => {
    delete require.cache[path];
  });
  require(path).startTenantDemandForecastCron();
  require(path).startTenantDemandForecastCron();
  assert.equal(scheduled.expression, '0 */12 * * *');
  assert.equal(scheduled.options.timezone, 'Africa/Lagos');
  assert.equal(registrations, 1);
  await run();
  await run();
  assert.equal(plans, 2);
});
test('saved-minimum cache and calculation cache remain separate, and saved mode never persists', async () => {
  const { createPlanningService } = require('../services/restock/service');
  let reads = 0,
    writes = 0;
  const service = createPlanningService(
    async () => {
      reads++;
      return {
        products: [],
        warehouses: [],
        snapshots: new Map(),
        sales: { rows: [], uncertain: new Set() },
        purchases: [],
        transfers: [],
        tenantId: 'own',
      };
    },
    () => now,
    async () => writes++,
  );
  await service('own', {
    includeSales: true,
    updateMinimum: true,
    useSavedMinimum: true,
  });
  assert.equal(writes, 0);
  await service('own', {
    includeSales: true,
    updateMinimum: true,
    useSavedMinimum: false,
  });
  assert.equal(writes, 1);
  assert.equal(reads, 2);
});
