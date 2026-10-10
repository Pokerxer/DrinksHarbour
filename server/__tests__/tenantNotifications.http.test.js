const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createNotificationRouter } = require('../routes/notification.routes');
const {
  createInboxService,
} = require('../services/tenantNotifications.service');
const now = new Date('2026-10-08T12:00:00Z');
const a = 'aaaaaaaaaaaaaaaaaaaaaaaa',
  b = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const docs = [
  {
    _id: a,
    tenant: 'a',
    recipient: 'ua',
    type: 'low_stock_alert',
    isArchived: false,
    isRead: false,
    title: 'Wine',
    message: '5 left',
    actionUrl: '//evil.test',
    metadata: { available: 5, costPrice: 999 },
  },
  {
    _id: b,
    tenant: 'b',
    recipient: 'ub',
    type: 'low_stock_alert',
    isArchived: false,
    isRead: false,
    title: 'Foreign',
  },
  {
    _id: 'cccccccccccccccccccccccc',
    tenant: 'a',
    recipient: 'ua',
    type: 'low_stock_alert',
    isArchived: false,
    isRead: false,
    expiresAt: new Date('2026-01-01'),
  },
  {
    _id: 'dddddddddddddddddddddddd',
    tenant: 'a',
    recipient: 'ua',
    type: 'low_stock_alert',
    isArchived: false,
    isRead: false,
    scheduledFor: new Date('2027-01-01'),
  },
  {
    _id: 'eeeeeeeeeeeeeeeeeeeeeeee',
    recipient: 'platform',
    type: 'new_product_pending',
    isArchived: false,
    isRead: false,
    title: 'Pending',
  },
  {
    _id: 'ffffffffffffffffffffffff',
    tenant: 'a',
    recipient: 'staff',
    type: 'product_performance',
    isArchived: false,
    isRead: false,
    title: 'Private report',
  },
];
function match(row, q) {
  return Object.entries(q).every(([k, v]) => {
    if (k === '$and') return v.every((x) => match(row, x));
    if (k === '$or') return v.some((x) => match(row, x));
    const actual = k.split('.').reduce((o, key) => o?.[key], row);
    if (v === null) return actual == null;
    if (v && typeof v === 'object' && !(v instanceof Date))
      return Object.entries(v).every(([op, x]) =>
        op === '$in'
          ? x.includes(actual)
          : op === '$exists'
            ? (actual !== undefined) === x
            : op === '$gt'
              ? actual > x
              : op === '$lte'
                ? actual <= x
                : false,
      );
    return actual === v;
  });
}
const model = {
  findOne: (q) => ({
    select: () => ({ lean: async () => docs.find((r) => match(r, q)) }),
  }),
  find: (q) => ({
    sort: () => ({
      skip: (n) => ({
        limit: (l) => ({
          select: () => ({
            lean: async () => docs.filter((r) => match(r, q)).slice(n, n + l),
          }),
        }),
      }),
    }),
  }),
  countDocuments: async (q) => docs.filter((r) => match(r, q)).length,
  findOneAndUpdate: async (q, u) => {
    const row = docs.find((r) => match(r, q));
    if (row) Object.assign(row, u.$set);
    return row;
  },
  updateMany: async (q, u) => {
    let count = 0;
    for (const r of docs)
      if (match(r, q)) {
        Object.assign(r, u.$set);
        count++;
      }
    return { modifiedCount: count };
  },
};
let server, base;
test.before(async () => {
  const app = express();
  app.use(express.json());
  const auth = (req, res, next) => {
    const key = req.headers.authorization;
    if (!key) return res.status(401).json({ success: false });
    req.user =
      key === 'platform'
        ? { _id: 'platform', role: 'super_admin', status: 'active' }
        : key === 'staff'
          ? {
              _id: 'staff',
              tenant: 'a',
              role: 'tenant_staff',
              status: 'active',
            }
          : {
              _id: `u${key}`,
              tenant: key,
              role: 'tenant_owner',
              status: 'active',
            };
    next();
  };
  app.use(
    '/api/production-notifications',
    require('../routes/notification.routes'),
  );
  app.use(
    '/api/notifications',
    createNotificationRouter(
      auth,
      createInboxService(
        model,
        () => now,
        async () => {},
      ),
    ),
  );
  app.use((err, req, res, next) =>
    res
      .status(err.statusCode || 500)
      .json({ success: false, message: err.message }),
  );
  await new Promise((resolve, reject) => {
    server = app.listen(0, '127.0.0.1', (error) =>
      error ? reject(error) : resolve(),
    );
    server.once('error', reject);
  });
  base = `http://127.0.0.1:${server.address().port}/api/notifications`;
});
test.after(() => new Promise((resolve) => server.close(resolve)));
const call = (path = '', token = 'a', method = 'GET') =>
  fetch(base + path, {
    method,
    headers: token ? { Authorization: token } : {},
  });
test('unauthenticated requests rejected and list scopes recipient, tenant, expiry and schedule', async () => {
  assert.equal((await call('', null)).status, 401);
  const res = await call();
  assert.equal(res.headers.get('cache-control'), 'private, no-store');
  const { data } = await res.json();
  assert.equal(data.total, 1);
  assert.equal(data.unreadCount, 1);
  assert.equal(data.notifications[0]._id, a);
  assert.equal(data.notifications[0].actionUrl, undefined);
  assert.equal(data.notifications[0].metadata.costPrice, undefined);
});
test('foreign mutation rejected and read-all never touches other tenants', async () => {
  assert.equal((await call(`/${b}/read`, 'a', 'PATCH')).status, 404);
  assert.equal((await call('/read-all', 'a', 'PATCH')).status, 200);
  assert.equal(docs[1].isRead, false);
  assert.equal(docs[2].isRead, false);
  assert.equal(docs[3].isRead, false);
});
test('invalid query values and IDs rejected, static read-all route registered', async () => {
  for (const path of [
    '?page=-1',
    '?limit=100',
    '?category=invalid',
    '?unreadOnly=1',
    '?page=1.5',
    '?page=1&page=2',
  ])
    assert.equal((await call(path)).status, 400);
  assert.equal((await call('/bad/read', 'a', 'PATCH')).status, 400);
});
test('platform legacy inbox remains explicitly addressed; staff report revocation enforced', async () => {
  const platform = await (await call('?tenant=b', 'platform')).json();
  assert.equal(platform.data.notifications.length, 1);
  assert.equal(platform.data.notifications[0].title, 'Pending');
  const staff = await (await call('', 'staff')).json();
  assert.equal(
    staff.data.notifications.some((r) => r.title === 'Private report'),
    false,
  );
  assert.equal(
    (await call('/ffffffffffffffffffffffff/read', 'staff', 'PATCH')).status,
    404,
  );
});

test('production route uses the real authentication guard', async () => {
  const res = await fetch(
    base.replace('/api/notifications', '/api/production-notifications'),
  );
  assert.equal(res.status, 401);
});
test('mark-one is idempotent and retains the original read timestamp', async () => {
  const first = await (await call(`/${a}/read`, 'a', 'PATCH')).json();
  const again = await (await call(`/${a}/read`, 'a', 'PATCH')).json();
  assert.equal(first.success, true);
  assert.equal(again.data.readAt, first.data.readAt);
});
test('unread count spans allowed categories even when filtering the list', async () => {
  docs.push({
    _id: '123456789012345678901234',
    tenant: 'a',
    recipient: 'ua',
    type: 'product_performance',
    isArchived: false,
    isRead: false,
    title: 'Growth',
  });
  const { data } = await (await call('?category=stock&limit=1')).json();
  assert.equal(data.notifications.length, 1);
  assert.equal(data.unreadCount, 1);
  assert.equal(data.notifications[0].type, 'low_stock_alert');
});
