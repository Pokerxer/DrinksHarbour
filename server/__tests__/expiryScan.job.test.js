// server/__tests__/expiryScan.job.test.js
const test = require('node:test');
const assert = require('node:assert');
const { buildExpiryNotification, scanTenant } = require('../jobs/expiryScan.job');

test('buildExpiryNotification targets recipients with batch metadata and escalating priority', () => {
  const now = new Date('2026-06-16T00:00:00Z');
  const batch = {
    _id: 'b1', batchNumber: 'JUICE500-20260616-001', quantity: 12,
    expiryDate: new Date('2026-07-01T00:00:00Z'),
    subProduct: 'sp1', product: 'p1', tenant: 't1',
  };
  const n = buildExpiryNotification(batch, ['u1', 'u2'], now);
  assert.strictEqual(n.type, 'batch_expiry_alert');
  assert.strictEqual(n.priority, 'urgent'); // 15 days out
  assert.deepStrictEqual(n.recipients, ['u1', 'u2']);
  assert.strictEqual(n.metadata.batchId, 'b1');
  assert.match(n.message, /JUICE500-20260616-001/);
  assert.match(n.message, /12/);
});

test('scanTenant upserts one notification per batch and archives stale ones', async () => {
  const now = new Date('2026-06-16T00:00:00Z');
  const tenant = { _id: 't1', inventorySettings: { expiryWarningDays: 90 } };
  const batches = [
    { _id: 'b1', batchNumber: 'A', quantity: 5, expiryDate: new Date('2026-07-01'), subProduct: 'sp1' },
  ];
  const upserts = [];
  let archivedWith = null;
  const res = await scanTenant(tenant, now, {
    findExpiringBatches: async () => batches,
    getRecipients: async () => ['u1'],
    upsert: async (payload) => upserts.push(payload),
    archiveStale: async (_t, ids) => { archivedWith = ids; },
  });
  assert.strictEqual(res.created, 1);
  assert.strictEqual(upserts[0].metadata.batchId, 'b1');
  assert.deepStrictEqual(archivedWith, ['b1']);
});

test('scanTenant does nothing when there are no recipients', async () => {
  const res = await scanTenant(
    { _id: 't1', inventorySettings: { expiryWarningDays: 90 } },
    new Date(),
    {
      findExpiringBatches: async () => [{ _id: 'b1', batchNumber: 'A', quantity: 5, expiryDate: new Date() }],
      getRecipients: async () => [],
      upsert: async () => { throw new Error('should not upsert'); },
      archiveStale: async () => { throw new Error('should not archive'); },
    }
  );
  assert.strictEqual(res.created, 0);
});
