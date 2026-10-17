const test = require('node:test');
const assert = require('node:assert/strict');
const { requirePeerHr } = require('../services/peerAppraisal/access');
test('business-wide bonus management is restricted to unrestricted HR', async () => {
  const req = role => ({ user: { role, tenant: 'tenant-a' }, tenant: { _id: 'tenant-a' }, _appraisalDepartmentScope: role === 'tenant_admin' ? ['dept'] : null });
  assert.equal(await requirePeerHr(req('tenant_owner')), 'tenant-a');
  await assert.rejects(requirePeerHr(req('tenant_staff')), { statusCode: 403 });
  await assert.rejects(requirePeerHr(req('tenant_admin')), { statusCode: 403 });
  assert.equal(await requirePeerHr({ ...req('tenant_owner'), body: { tenant: 'evil' } }), 'tenant-a');
});
