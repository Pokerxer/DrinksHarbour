'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { startRouter } = require('./helpers/routeAuthHarness');
test('canonical_admin_commands_require_authenticated_tenant_identity', async () => {
  const app = await startRouter(require('../routes/venue-ops.routes'), '/api/venue-ops');
  try {
    const response = await fetch(app.url('/api/venue-ops/readiness'));
    assert.equal(response.status, 401);
    const mutation = await fetch(app.url('/api/venue-ops/service-sessions'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ tenantId: 'spoof' }) });
    assert.equal(mutation.status, 401);
  } finally { await app.close(); }
});
