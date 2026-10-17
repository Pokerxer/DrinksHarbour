const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createExpiryDependencies,
} = require('../services/expiryAlerts/dependencies');
const { buildExpiryNotification } = require('../jobs/expiryScan.job');
test('updates every eligible recipient by tenant/batch and preserves previously read alerts', async () => {
  const writes = [],
    archives = [];
  const notices = {
    bulkWrite: async (rows) => writes.push(...rows),
    updateMany: async (...args) => archives.push(args),
  };
  const deps = createExpiryDependencies({
    notices,
    recipients: async () => [
      { _id: 'a', tenant: 'own', role: 'tenant_owner' },
      { _id: 'b', tenant: 'own', role: 'tenant_admin' },
      { _id: 'x', tenant: 'own', role: 'customer' },
    ],
  });
  const users = await deps.getRecipients('own');
  assert.deepEqual(
    users.map((u) => u._id),
    ['a', 'b'],
  );
  const now = new Date('2026-10-12'),
    batch = {
      _id: 'batch',
      tenant: 'own',
      batchNumber: 'LOT',
      quantity: 5,
      expiryDate: '2026-11-01',
    };
  await deps.upsert(buildExpiryNotification(batch, users, now), batch, now);
  assert.equal(writes.length, 2);
  for (const { updateOne: op } of writes) {
    assert.equal(op.filter.tenant, 'own');
    assert.equal(op.filter.dedupKey, 'expiry:batch');
    assert.equal(op.update.$set.isRead, undefined);
    assert.equal(op.update.$setOnInsert.isRead, false);
  }
  await deps.archiveStale('own', ['batch'], now);
  assert.equal(archives[0][0].tenant, 'own');
  assert.equal(archives[0][0].type, 'batch_expiry_alert');
  assert.equal(archives[0][1].$unset.dedupKey, 1);
});
test('remaining tenant batches with incomplete references stay visible without exposing guessed or foreign names', async () => {
  const q = {
    select() {
      return this;
    },
    populate() {
      return this;
    },
    limit() {
      return this;
    },
    maxTimeMS() {
      return this;
    },
    lean: async () => [
      {
        _id: 'batch',
        tenant: 'own',
        quantity: 8,
        warehouse: null,
        subProduct: null,
        size: { displayName: 'Wrong size', subproduct: 'other' },
      },
    ],
  };
  const deps = createExpiryDependencies({
    batches: {
      find: (filter) => {
        assert.equal(filter.tenant, 'own');
        return q;
      },
    },
  });
  const rows = await deps.findExpiringBatches('own', new Date('2026-11-01'));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].quantity, 8);
  assert.equal(rows[0].size, undefined);
});
