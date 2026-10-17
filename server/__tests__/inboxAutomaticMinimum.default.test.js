const test = require('node:test');
const assert = require('node:assert/strict');
test('production inbox catch-up uses saved minimums without invoking sales planning from an inbox load', async (t) => {
  const steps = [];
  t.mock.method(require('../models/Tenant'), 'exists', async (q) => {
    assert.deepEqual(q, { _id: 'own', status: 'approved' });
    return true;
  });
  t.mock.method(
    require('../services/tenantNotificationIndexes'),
    'ensureNotificationDedupIndex',
    async () => {},
  );
  t.mock.method(require('../services/restock/service'), 'getPlan', async () => {
    throw Error('Minimum planning must not run on inbox load');
  });
  t.mock.method(
    require('../jobs/tenantProductInsights.job'),
    'scanTenantProducts',
    async (tenant, options) => {
      assert.equal(tenant, 'own');
      assert.equal(options.recipientId, 'u');
      steps.push('scan');
    },
  );
  const path = require.resolve('../services/tenantStockAlerts');
  delete require.cache[path];
  t.after(() => {
    delete require.cache[path];
  });
  await require(path).syncTenantStockAlerts({
    user: { _id: 'u', tenant: 'own', role: 'tenant_owner', status: 'active' },
    query: { tenant: 'foreign' },
  });
  assert.deepEqual(steps, ['scan']);
});
