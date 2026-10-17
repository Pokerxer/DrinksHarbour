// server/__tests__/expiryScan.job.test.js
const test = require('node:test');
const assert = require('node:assert');
const {
  buildExpiryNotification,
  scanTenant,
} = require('../jobs/expiryScan.job');

test('buildExpiryNotification targets recipients with batch metadata and escalating priority', () => {
  const now = new Date('2026-06-16T00:00:00Z');
  const batch = {
    _id: 'b1',
    batchNumber: 'JUICE500-20260616-001',
    quantity: 12,
    expiryDate: new Date('2026-07-01T00:00:00Z'),
    subProduct: 'sp1',
    product: 'p1',
    tenant: 't1',
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
    {
      _id: 'b1',
      batchNumber: 'A',
      quantity: 5,
      expiryDate: new Date('2026-07-01'),
      subProduct: 'sp1',
    },
  ];
  const upserts = [];
  let archivedWith = null;
  const res = await scanTenant(tenant, now, {
    findExpiringBatches: async () => batches,
    getRecipients: async () => ['u1'],
    upsert: async (payload) => upserts.push(payload),
    archiveStale: async (_t, ids) => {
      archivedWith = ids;
    },
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
      findExpiringBatches: async () => [
        { _id: 'b1', batchNumber: 'A', quantity: 5, expiryDate: new Date() },
      ],
      getRecipients: async () => [],
      upsert: async () => {
        throw new Error('should not upsert');
      },
      archiveStale: async () => {
        throw new Error('should not archive');
      },
    },
  );
  assert.strictEqual(res.created, 0);
});
test('expired and quarantined batches never recommend depleting stock for sale', () => {
  const now = new Date('2026-10-12T12:00:00Z');
  const batch = {
    _id: 'b',
    batchNumber: 'LOT-1',
    tenant: 't',
    quantity: 8,
    expiryDate: now,
    quarantined: true,
  };
  const alert = buildExpiryNotification(batch, ['u'], now);
  assert.equal(alert.title, 'Batch expired');
  assert.equal(alert.metadata.quarantineStatus, 'quarantined');
  assert.equal(alert.metadata.expiryDate, now.toISOString());
  assert.doesNotMatch(alert.message, /Deplete it/i);
});
test('skips depleted, invalid-date and foreign batches without publishing false expiry alerts', async () => {
  const now = new Date('2026-10-12T12:00:00Z'),
    seen = [];
  await scanTenant(
    { _id: 'own', inventorySettings: { expiryWarningDays: 1 } },
    now,
    {
      findExpiringBatches: async () => [
        { _id: 'zero', tenant: 'own', quantity: 0, expiryDate: now },
        { _id: 'bad', tenant: 'own', quantity: 2, expiryDate: 'bad' },
        { _id: 'foreign', tenant: 'foreign', quantity: 2, expiryDate: now },
        { _id: 'future', tenant: 'own', quantity: 2, expiryDate: '2026-12-01' },
      ],
      getRecipients: async () => ['u'],
      upsert: async (d) => seen.push(d),
      archiveStale: async (_t, ids) => assert.deepEqual(ids, []),
    },
  );
  assert.deepEqual(seen, []);
});
test('expiry message dates use the warehouse business timezone rather than the UTC day', () => {
  const n = buildExpiryNotification(
    {
      _id: 'b',
      batchNumber: 'LOT',
      quantity: 4,
      expiryDate: '2026-10-12T23:30:00Z',
    },
    ['u'],
    new Date('2026-10-12T12:00:00Z'),
  );
  assert.match(n.message, /13 Oct 2026/);
});
test('publishes tenant expiry drafts together through bounded delivery instead of one database batch call per lot', async () => {
  let delivered;
  const now = new Date('2026-10-12');
  const result = await scanTenant({ _id: 'own' }, now, {
    findExpiringBatches: async () =>
      ['a', 'b'].map((_id) => ({
        _id,
        tenant: 'own',
        quantity: 2,
        expiryDate: '2026-11-01',
        batchNumber: _id,
      })),
    getRecipients: async () => ['u'],
    upsert: async () => {
      throw Error('individual writes should not run');
    },
    upsertMany: async (tenant, drafts) => {
      assert.equal(tenant, 'own');
      delivered = drafts;
    },
    archiveStale: async () => {},
  });
  assert.equal(result.created, 2);
  assert.deepEqual(
    delivered.map((d) => d.identity),
    ['expiry:a', 'expiry:b'],
  );
});
