const test = require('node:test');
const assert = require('node:assert/strict');
const { createStockAlertSync } = require('../services/tenantStockAlerts');
const req = (tenant = 'a', role = 'tenant_owner') => ({
  user: { _id: 'u', tenant, role, status: 'active' },
  query: { tenant: 'other' },
});
function dependencies() {
  let now = 0;
  const calls = [];
  return {
    calls,
    clock: () => now,
    setTime: (v) => {
      now = v;
    },
    approved: async () => true,
    scan: async (t, o) => {
      calls.push([t, o]);
    },
    warn: () => {},
  };
}
test('catches up approved JWT tenant stock and skips success repeats for one minute', async () => {
  const d = dependencies(),
    sync = createStockAlertSync(d);
  await sync(req());
  await sync(req());
  assert.equal(d.calls.length, 1);
  assert.equal(d.calls[0][0], 'a');
  assert.equal(d.calls[0][1].includeSales, false);
  d.setTime(60000);
  await sync(req());
  assert.equal(d.calls.length, 2);
});
test('does not sync platform users, other tenants selected in query, ineligible staff or inactive tenants', async () => {
  const d = dependencies(),
    sync = createStockAlertSync(d);
  await sync(req(null, 'super_admin'));
  await sync(req('a', 'customer'));
  await sync(req('a', 'unknown_role'));
  await sync({ ...req(), user: { ...req().user, status: 'suspended' } });
  assert.equal(d.calls.length, 0);
  d.approved = async () => false;
  await createStockAlertSync(d)(req());
  assert.equal(d.calls.length, 0);
});
test('shares concurrent scans and lets failed scans retry without blocking inbox reads', async () => {
  const d = dependencies();
  let finish;
  d.scan = async () => {
    d.calls.push('scan');
    await new Promise((r) => {
      finish = r;
    });
  };
  const sync = createStockAlertSync(d);
  const first = sync(req()),
    second = sync(req());
  await new Promise((r) => setImmediate(r));
  assert.equal(d.calls.length, 1);
  finish();
  await Promise.all([first, second]);
  const broken = dependencies();
  let failures = 0;
  broken.scan = async () => {
    failures++;
    throw Error('Offline');
  };
  const retry = createStockAlertSync(broken);
  await retry(req());
  await retry(req());
  assert.equal(failures, 2);
});

test('staff with existing inventory permission can catch up their tenant', async () => {
  const d = dependencies();
  await createStockAlertSync(d)(req('a', 'tenant_staff'));
  assert.equal(d.calls.length, 1);
});
test('inbox validates authority and options before catch-up, then reads newly generated notices', async () => {
  const {
    createInboxService,
  } = require('../services/tenantNotifications.service');
  let synced = false;
  const model = {
    find: () => ({
      sort: () => ({
        skip: () => ({
          limit: () => ({
            select: () => ({
              lean: async () => {
                assert.ok(synced);
                return [];
              },
            }),
          }),
        }),
      }),
    }),
    countDocuments: async () => {
      assert.ok(synced);
      return 1;
    },
  };
  const service = createInboxService(
    model,
    () => new Date(),
    async (r) => {
      assert.equal(r.user.tenant, 'a');
      synced = true;
    },
  );
  await assert.rejects(service.list({ ...req(), user: null }));
  assert.equal(synced, false);
  await assert.rejects(service.list({ ...req(), query: { limit: '500' } }));
  assert.equal(synced, false);
  const data = await service.list({ ...req(), query: {} });
  assert.equal(data.total, 1);
});
test('synchronous approval lookup failures also remain retryable', async () => {
  const d = dependencies();
  let calls = 0;
  d.approved = () => {
    calls++;
    throw Error('Offline');
  };
  const sync = createStockAlertSync(d);
  await sync(req());
  await sync(req());
  assert.equal(calls, 2);
});
test('inbox catch-up targets its authenticated recipient without delaying other staff', async () => {
  const d = dependencies(),
    sync = createStockAlertSync(d);
  await sync(req());
  await sync({ ...req(), user: { ...req().user, _id: 'another' } });
  assert.equal(d.calls.length, 2);
  assert.equal(d.calls[0][1].recipientId, 'u');
  assert.equal(d.calls[1][1].recipientId, 'another');
});
test('recipient lookup keeps active membership and tenant filters when selecting one user', async () => {
  const User = require('../models/User');
  const {
    getTenantRecipients,
  } = require('../services/tenantNotificationRecipients');
  const original = User.find;
  let query;
  User.find = (q) => {
    query = q;
    return { select: () => ({ lean: async () => [] }) };
  };
  try {
    await getTenantRecipients('a', 'u');
    assert.equal(query._id, 'u');
    assert.equal(query.tenant, 'a');
    assert.equal(query.status, 'active');
  } finally {
    User.find = original;
  }
});
