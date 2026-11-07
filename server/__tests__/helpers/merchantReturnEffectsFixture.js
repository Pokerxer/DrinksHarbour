'use strict';
// Synthetic policy-recorded quarantined-return harness for effects tests:
// real dispatch, failure, return, receipt, inspection, decision, then a
// recorded synthetic MerchantDispositionPolicy (operator input, test-only).
const assert = require('node:assert/strict');
const validPolicy = (tenant, version = 1) => ({
  tenant: String(tenant),
  version,
  treatmentByCondition: {
    sealed: 'restock',
    damaged: 'write_off',
    expired: 'write_off',
    unverifiable: 'retain_quarantine',
  },
  restockLocationRule: 'original_location',
  cogsTreatment: 'reverse_original_goods_cost',
  reviewReference: 'synthetic-reviewed-disposition-policy',
});
async function decidedReturn(t, condition, treatment) {
  const harness = await require('./merchantReturnDispositionFixture').quarantinedReturn(t);
  const { f, child, actor, booking, call, record } = harness;
  const policy = await call('/return-disposition-policies', validPolicy(child.tenant), f.admin);
  assert.equal(policy.status, 201, JSON.stringify(policy.body));
  const base = `/bookings/${booking._id}/return`;
  const range = record.lines[0].ranges[0];
  const line = String(record.lines[0].line);
  const read = await call(base, null, actor, 'GET');
  const version = read.body.data.return.version;
  const inspected = await call(`${base}/inspect`, {
    expectedVersion: version,
    idempotencyKey: 'effects-inspect',
    lines: [{ line, condition, ranges: [{ start: range.start, quantity: range.quantity }] }],
  });
  assert.equal(inspected.status, 200, JSON.stringify(inspected.body));
  const decided = await call(`${base}/decision`, {
    expectedVersion: version + 1,
    idempotencyKey: 'effects-decide',
    lines: [{ line, treatment, ranges: [{ start: range.start, quantity: range.quantity }] }],
  });
  assert.equal(decided.status, 200, JSON.stringify(decided.body));
  return { ...harness, base, line, range, commandVersion: version + 2 };
}
module.exports = { validPolicy, decidedReturn };
