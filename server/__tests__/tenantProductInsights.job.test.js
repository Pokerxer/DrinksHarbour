const test = require('node:test');
const assert = require('node:assert/strict');
const { scanTenantProducts } = require('../jobs/tenantProductInsights.job');
function deps(fail = false) {
  let calls = 0;
  const d = {
    page: async () =>
      calls++
        ? []
        : [{ _id: 'p', product: { name: 'Wine' }, createdAt: '2026-01-01' }],
    stock: async () =>
      new Map([['p', { stock: [{ available: 0, threshold: 5 }] }]]),
    sales: async () => {
      if (fail) throw Error('sales failure');
      return new Map();
    },
    recipients: async () => [{ _id: 'u', role: 'tenant_owner' }],
    deliver: async (t, n) => {
      d.notices = n;
      return { delivered: n.length };
    },
    resolve: async () => {
      d.resolved = true;
    },
  };
  return d;
}
test('stock-only scan does not query sales and resolves only after complete scan', async () => {
  const d = deps(true);
  await scanTenantProducts(
    'a',
    { now: new Date('2026-10-08'), includeSales: false },
    d,
  );
  assert.ok(d.resolved);
  assert.equal(d.notices[0].type, 'low_stock_alert');
});
test('failed insight evidence does not resolve stale stock notices', async () => {
  const d = deps(true);
  await assert.rejects(scanTenantProducts('a', { includeSales: true }, d));
  assert.ok(!d.resolved);
});
test('approval notices address active eligible tenant recipients', async () => {
  const Product = require('../models/Product'),
    User = require('../models/User'),
    N = require('../models/Notification');
  const service = require('../services/notification.service');
  const p = Product.findById,
    u = User.find,
    i = N.insertMany;
  Product.findById = () => ({
    lean: async () => ({
      _id: 'p',
      name: 'Wine',
      submittingTenant: 'a',
      slug: 'wine',
    }),
  });
  User.find = () => ({
    select: () => ({
      lean: async () => [{ _id: 'u', tenant: 'a', role: 'tenant_owner' }],
    }),
  });
  let rows;
  N.insertMany = async (r) => {
    rows = r;
    return r;
  };
  try {
    const result = await service.sendProductApprovedNotification('p', 'admin');
    assert.equal(result.success, true);
    assert.equal(rows[0].recipient, 'u');
    assert.equal(rows[0].tenant, 'a');
    assert.equal(rows[0].metadata.productName, 'Wine');
  } finally {
    Product.findById = p;
    User.find = u;
    N.insertMany = i;
  }
});
test('overlapping stock sweep queues daily sales sweep instead of losing it', async () => {
  const { createSweep } = require('../jobs/tenantProductInsights.job');
  const calls = [];
  let finish;
  const sweep = createSweep(async (sales) => {
    calls.push(sales);
    if (!sales)
      await new Promise((r) => {
        finish = r;
      });
  });
  const pending = sweep(false);
  await sweep(true);
  finish();
  await pending;
  assert.deepEqual(calls, [false, true]);
});
test('sweeps approved tenants using the actual tenant lifecycle enum', async () => {
  const job = require('../jobs/tenantProductInsights.job');
  const Tenant = require('../models/Tenant'),
    N = require('../models/Notification');
  const find = Tenant.find,
    indices = N.collection.createIndex;
  let query;
  Tenant.find = (q) => {
    query = q;
    return {
      select: () => ({ lean: () => ({ cursor: async function* () {} }) }),
    };
  };
  N.collection.createIndex = async () => {};
  try {
    await job.scanAllTenants(false);
    assert.equal(query.status, 'approved');
  } finally {
    Tenant.find = find;
    N.collection.createIndex = indices;
  }
});
test('recipient catch-up scopes both delivery lookup and episode resolution', async () => {
  const d = deps();
  let lookup, resolution;
  d.recipients = async (...args) => {
    lookup = args;
    return [{ _id: 'u', role: 'tenant_owner' }];
  };
  d.resolve = async (...args) => {
    resolution = args;
  };
  await scanTenantProducts('a', { recipientId: 'u' }, d);
  assert.deepEqual(lookup, ['a', 'u']);
  assert.equal(resolution[5], 'u');
});
