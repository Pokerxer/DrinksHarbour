const test = require('node:test');
const assert = require('node:assert/strict');
const {
  deliverInsights,
  resolveStockEpisodes,
} = require('../services/tenantNotificationDelivery');
const { allowedTypes } = require('../services/tenantNotificationRecipients');
const draft = {
  type: 'low_stock_alert',
  identity: 'stock:p:s:w',
  subProduct: 'p',
  title: 'Low',
  message: '5 units',
  priority: 'high',
  metadata: { available: 5 },
};
function memory() {
  const rows = [];
  return {
    rows,
    async updateOne(q, u) {
      let row = rows.find(
        (r) =>
          r.tenant === q.tenant &&
          r.recipient === q.recipient &&
          r.dedupKey === q.dedupKey,
      );
      if (!row) {
        row = { ...u.$setOnInsert };
        rows.push(row);
      }
      Object.assign(row, u.$set);
      return {};
    },
    async updateMany(q, u) {
      for (const r of rows)
        if (
          r.tenant === q.tenant &&
          r.type === 'low_stock_alert' &&
          r.dedupKey &&
          !q.dedupKey.$nin.includes(r.dedupKey) &&
          !q.subProduct.$nin.includes(r.subProduct)
        ) {
          Object.assign(r, u.$set);
          delete r.dedupKey;
        }
    },
  };
}
test('concurrent retries preserve read state; new stock episode after resolution', async () => {
  const m = memory();
  const now = new Date();
  const recipients = [{ _id: 'u', role: 'tenant_owner' }];
  await Promise.all([
    deliverInsights('a', [draft], recipients, now, m),
    deliverInsights('a', [draft], recipients, now, m),
  ]);
  assert.equal(m.rows.length, 1);
  m.rows[0].isRead = true;
  await deliverInsights(
    'a',
    [{ ...draft, message: '0 units', priority: 'urgent' }],
    recipients,
    now,
    m,
  );
  assert.equal(m.rows[0].isRead, true);
  assert.equal(m.rows[0].priority, 'urgent');
  await resolveStockEpisodes('a', [], [], now, m);
  assert.equal(m.rows[0].isArchived, true);
  await deliverInsights('a', [draft], recipients, now, m);
  assert.equal(m.rows.length, 2);
  assert.equal(m.rows[1].isRead, false);
});
test('delivery only uses category-eligible recipients and contains atomic insert-only read state', async () => {
  const m = memory();
  await deliverInsights(
    'a',
    [
      draft,
      { ...draft, type: 'product_performance', identity: 'growth:p:week' },
    ],
    [
      {
        _id: 'staff',
        role: 'tenant_staff',
        customPermissions: ['inventory:read'],
      },
    ],
    new Date(),
    m,
  );
  assert.equal(m.rows.length, 1);
  assert.equal(m.rows[0].type, 'low_stock_alert');
  assert.ok(
    !allowedTypes({ role: 'tenant_staff' }).includes('product_performance'),
  );
});
test('recipient failure rejects scan so stale stock episodes cannot be resolved', async () => {
  await assert.rejects(
    deliverInsights(
      'a',
      [draft],
      [{ _id: 'u', role: 'tenant_owner' }],
      new Date(),
      {
        updateOne: async () => {
          throw Error('db');
        },
      },
    ),
    /db/,
  );
});
test('schema has dedup index and performance/suggestion enum', () => {
  const N = require('../models/Notification');
  assert.ok(N.schema.path('type').enumValues.includes('product_performance'));
  assert.ok(
    N.schema
      .indexes()
      .some(
        ([fields, options]) =>
          fields.dedupKey === 1 &&
          options.unique &&
          options.partialFilterExpression,
      ),
  );
});
test('unique-key race refreshes winning row without a second upsert', async () => {
  const calls = [];
  const model = {
    updateOne: async (q, u, options) => {
      calls.push(options);
      if (calls.length === 1) {
        const e = Error('race');
        e.code = 11000;
        throw e;
      }
    },
  };
  await deliverInsights(
    'a',
    [draft],
    [{ _id: 'u', role: 'tenant_owner' }],
    new Date(),
    model,
  );
  assert.deepEqual(calls, [{ upsert: true }, { upsert: false }]);
});
test('escalation refreshes the title while retaining read state', async () => {
  const m = memory();
  const recipients = [{ _id: 'u', role: 'tenant_owner' }];
  await deliverInsights('a', [draft], recipients, new Date(), m);
  m.rows[0].isRead = true;
  await deliverInsights(
    'a',
    [{ ...draft, title: 'Out of stock', priority: 'urgent' }],
    recipients,
    new Date(),
    m,
  );
  assert.equal(m.rows[0].title, 'Out of stock');
  assert.equal(m.rows[0].isRead, true);
});
test('large recipient fanout uses bounded bulk batches with insert-only read state', async () => {
  const batches = [];
  const model = {
    bulkWrite: async (ops, options) => {
      batches.push(ops);
      assert.equal(options.ordered, false);
    },
  };
  const drafts = Array.from({ length: 501 }, (_, i) => ({
    ...draft,
    identity: `stock:${i}`,
  }));
  const result = await deliverInsights(
    'a',
    drafts,
    [{ _id: 'u', role: 'tenant_owner' }],
    new Date(),
    model,
  );
  assert.deepEqual(
    batches.map((b) => b.length),
    [500, 1],
  );
  assert.equal(result.delivered, 501);
  assert.equal(batches[0][0].updateOne.update.$setOnInsert.isRead, false);
  assert.ok(!Object.hasOwn(batches[0][0].updateOne.update.$set, 'isRead'));
});
test('bulk duplicate-key races retry only failed operations without another insert', async () => {
  const calls = [];
  const model = {
    bulkWrite: async (ops) => {
      calls.push(ops);
      if (calls.length === 1) {
        const e = Error('race');
        e.writeErrors = [{ index: 1, code: 11000 }];
        throw e;
      }
    },
  };
  await deliverInsights(
    'a',
    [draft, { ...draft, identity: 'stock:other' }],
    [{ _id: 'u', role: 'tenant_owner' }],
    new Date(),
    model,
  );
  assert.equal(calls.length, 2);
  assert.equal(calls[1].length, 1);
  assert.equal(calls[1][0].updateOne.upsert, false);
  assert.equal(calls[1][0].updateOne.filter.dedupKey, 'stock:other');
});
test('bulk non-duplicate or write-concern failures remain failed scans', async () => {
  const model = {
    bulkWrite: async () => {
      const e = Error('db');
      e.writeErrors = [{ index: 0, code: 121 }];
      throw e;
    },
  };
  await assert.rejects(
    deliverInsights(
      'a',
      [draft],
      [{ _id: 'u', role: 'tenant_owner' }],
      new Date(),
      model,
    ),
    /db/,
  );
});
test('recipient catch-up resolves only that recipient while scheduled scans resolve tenant-wide', async () => {
  const queries = [];
  const model = { updateMany: async (q) => queries.push(q) };
  await resolveStockEpisodes('a', [], [], new Date(), model, 'u');
  await resolveStockEpisodes('a', [], [], new Date(), model);
  assert.equal(queries[0].recipient, 'u');
  assert.equal(queries[0].tenant, 'a');
  assert.ok(!Object.hasOwn(queries[1], 'recipient'));
});
