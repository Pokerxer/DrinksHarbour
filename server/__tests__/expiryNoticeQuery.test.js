const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseOptions,
  createInboxService,
  publicNotice,
} = require('../services/tenantNotifications.service');
const now = new Date('2026-10-12T12:00:00Z');
test('expiry aggregation casts tenant and recipient identities to stored ObjectIds', async () => {
  const { expiryRows } = require('../services/expiryAlerts/query');
  const Notification = require('../models/Notification');
  const tenant = '507f1f77bcf86cd799439011';
  const recipient = '507f1f77bcf86cd799439012';
  let match;
  await expiryRows(
    {
      schema: Notification.schema,
      aggregate(p) {
        match = p[0].$match;
        return { option: async () => [] };
      },
    },
    { tenant, recipient },
    { page: 1, limit: 20, sort: 'expiry_soonest' },
  );
  assert.equal(match.tenant.constructor.name, 'ObjectId');
  assert.equal(match.recipient.constructor.name, 'ObjectId');
  assert.equal(String(match.tenant), tenant);
});
test('expiry filters accept bounded future expiry dates, with category-specific statuses and sorting', () => {
  const options = parseOptions(
    {
      category: 'expiry',
      expiryStatus: 'soon',
      sort: 'expiry_soonest',
      startDate: '2026-10-12',
      endDate: '2026-11-12',
    },
    now,
  );
  assert.equal(options.expiryStatus, 'soon');
  assert.equal(options.range.start.toISOString(), '2026-10-11T23:00:00.000Z');
  for (const q of [
    { category: 'stock', expiryStatus: 'expired' },
    { category: 'expiry', expiryStatus: 'bad' },
    { category: 'stock', sort: 'expiry_latest' },
  ])
    assert.throws(() => parseOptions(q, now));
});
test('expiry date and state are applied before pagination, counts and chronology sorting', async () => {
  let filter, sort;
  const counts = [];
  const cursor = {
    sort(v) {
      sort = v;
      return this;
    },
    skip() {
      return this;
    },
    limit() {
      return this;
    },
    select() {
      return this;
    },
    lean: async () => [],
  };
  const model = {
    find(q) {
      filter = q;
      return cursor;
    },
    aggregate(p) {
      filter = p[0].$match;
      sort = p.find((s) => s.$sort).$sort;
      assert.equal(p[1].$addFields.__expirySort.$convert.to, 'date');
      return { option: () => Promise.resolve([]) };
    },
    countDocuments: async (q) => {
      counts.push(q);
      return 0;
    },
  };
  await createInboxService(
    model,
    () => now,
    async () => {},
  ).list({
    user: { _id: 'u', tenant: 'own', status: 'active', role: 'tenant_owner' },
    query: {
      category: 'expiry',
      expiryStatus: 'expired',
      sort: 'expiry_soonest',
      startDate: '2026-10-01',
      endDate: '2026-11-01',
    },
  });
  assert.equal(filter.tenant, 'own');
  assert.equal(filter.createdAt, undefined);
  assert.equal(sort.__expirySort, 1);
  assert.ok(JSON.stringify(filter).includes('metadata.expiryDate'));
  assert.equal(
    filter.$and.at(-1).$or[0]['metadata.expiryDate'].$lte.toISOString(),
    now.toISOString(),
  );
  assert.deepEqual(counts[2], { ...filter, isRead: false });
});
test('safe public expiry facts retain legacy Date fields and batch identifiers, never costs', () => {
  const notice = publicNotice(
    {
      _id: 'n',
      metadata: {
        expiryDate: now,
        batchNumber: 'LOT-1',
        quantity: 8,
        quarantineStatus: 'quarantined',
        unitCost: 10,
      },
    },
    { role: 'tenant_staff', customPermissions: ['inventory:read'] },
  );
  assert.equal(notice.metadata.expiryDate, now.toISOString());
  assert.equal(notice.metadata.batchNumber, 'LOT-1');
  assert.equal(notice.metadata.unitCost, undefined);
});
test('legacy expired messages are made safe when reading the inbox before the next daily scan', () => {
  const notice = publicNotice(
    {
      _id: 'n',
      type: 'batch_expiry_alert',
      title: 'Batch nearing expiry',
      message: 'Deplete it before it expires.',
      metadata: { expiryDate: '2026-10-01' },
    },
    { role: 'tenant_owner' },
    now,
  );
  assert.equal(notice.title, 'Batch expired');
  assert.doesNotMatch(notice.message, /Deplete/i);
});
