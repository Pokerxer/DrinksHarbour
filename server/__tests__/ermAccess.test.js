'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Tenant = require('../models/Tenant');
const axios = require('axios');
const User = require('../models/User');
const SubProduct = require('../models/SubProduct');
const Warehouse = require('../models/Warehouse');
const { clearUsageCache } = require('../services/ermUsage.service');
const { startRouter, mockAuthUser, ROLE_USERS, TENANT_ID } = require('./helpers/routeAuthHarness');
const router = require('../routes/erm.routes');
const service = require('../services/erm.service');
const { requireOwnTenant } = require('../middleware/tenant.middleware');

function tenantContext(t, overrides = {}) {
  const tenant = { _id: TENANT_ID, status: 'approved', subscriptionStatus: 'active', plan: 'pro',
    email: 'billing@example.test', paystackSubscriptionCode: 'SUB_base', addOns: [], ...overrides };
  t.mock.method(Tenant, 'findById', () => ({ select: fields => ({ lean: async () =>
    Object.fromEntries(Object.entries(tenant).filter(([key]) => fields.split(' ').includes(key))) }) }));
  return tenant;
}
async function request(t, role, path, method = 'POST', overrides = {}) {
  const authorization = mockAuthUser(t, ROLE_USERS[role]);
  tenantContext(t, overrides);
  const app = await startRouter(router, '/api/erm');
  try {
    const res = await fetch(app.url(`/api/erm${path}`), { method,
      headers: { authorization, 'content-type': 'application/json' },
      ...(method !== 'GET' ? { body: '{}' } : {}) });
    return { status: res.status, body: await res.json() };
  } finally { await app.close(); }
}
for (const [path, method] of [['/subscribe','POST'],['/cancel','POST'],['/manage','POST'],['/add-ons','POST'],['/add-ons/extra_shop','DELETE']]) {
  test(`staff cannot change billing: ${method} ${path}`, async t => {
    assert.equal((await request(t, 'tenant_staff', path, method)).status, 403);
  });
}
for (const status of ['past_due','canceled','incomplete','incomplete_expired']) {
  test(`${status} owner reaches billing recovery, not a tenant lockout`, async t => {
    const result = await request(t, 'tenant_owner', '/subscribe', 'POST', { subscriptionStatus: status });
    assert.equal(result.status, 400); // Invalid plan from controller, not a context 403.
    assert.match(result.body.message, /Invalid plan/);
  });
}
test('suspended tenant cannot use billing recovery', async t => {
  assert.equal((await request(t, 'tenant_owner', '/subscribe', 'POST', { status: 'suspended' })).status, 403);
});
test('normal tenant-owned routes still refuse a cancelled subscription', () => {
  assert.throws(() => requireOwnTenant({ user: { tenant: TENANT_ID }, tenant: {
    _id: TENANT_ID, status: 'approved', subscriptionStatus: 'canceled' }, method: 'GET' }, {}, () => {}), /not active/);
});
test('owner cancellation gets projected subscription code and retains access', async t => {
  let changed;
  let providerStatus = 'active';
  t.mock.method(require('../models/BillingTransition'), 'findOne', async () => null);
  t.mock.method(Tenant, 'findOneAndUpdate', async () => ({ _id: TENANT_ID,
    paystackSubscriptionCode: 'SUB_base', paystackCustomerId: 'CUS_base', billingRevision: 1 }));
  t.mock.method(axios, 'get', async () => ({ data: { status: true, data: {
    subscription_code: 'SUB_base', customer: { customer_code: 'CUS_base' }, status: providerStatus, email_token: 'email-token' } } }));
  t.mock.method(axios, 'post', async (_url, body) => {
    assert.deepEqual(body, { code: 'SUB_base', token: 'email-token' });
    providerStatus = 'non-renewing';
    return { data: { status: true } };
  });
  t.mock.method(Tenant, 'updateOne', async (_filter, update) => {
    if (update.$set?.subscriptionStatus) changed = update.$set;
    return { matchedCount: 1 };
  });
  assert.equal((await request(t, 'tenant_owner', '/cancel')).status, 200);
  assert.deepEqual(changed, { subscriptionStatus: 'active', cancelAtPeriodEnd: true });
});
test('failed provider cancellation never changes local entitlement', async t => {
  let writes = 0;
  t.mock.method(axios, 'get', async () => ({ data: { data: { email_token: 'email-token' } } }));
  t.mock.method(axios, 'post', async () => { throw new Error('gateway unavailable'); });
  t.mock.method(Tenant, 'findByIdAndUpdate', async () => { writes++; });
  await assert.rejects(service.cancelSubscription({ _id: TENANT_ID, paystackSubscriptionCode: 'SUB_base' }), /gateway unavailable/);
  assert.equal(writes, 0);
});
test('add-on cancellation keeps the slot until provider disable', async t => {
  let update;
  t.mock.method(axios, 'get', async () => ({ data: { data: { email_token: 'email-token' } } }));
  t.mock.method(axios, 'post', async () => ({ data: { status: true } }));
  t.mock.method(Tenant, 'updateOne', async (filter, changes) => { update = { filter, changes }; });
  await service.cancelAddOnSubscription({ _id: TENANT_ID, addOns: [{ type: 'extra_shop', paystackSubscriptionCode: 'SUB_shop' }] }, 'extra_shop');
  assert.equal(update.filter['addOns.paystackSubscriptionCode'], 'SUB_shop');
  assert.deepEqual(update.changes, { $set: { 'addOns.$.cancelAtPeriodEnd': true } });
});
test('replayed or obsolete disable cannot cancel the current base subscription', async t => {
  const doc = { _id: TENANT_ID, paystackSubscriptionCode: 'SUB_current', addOns: [] };
  t.mock.method(Tenant, 'findById', async () => doc);
  const writes = [];
  t.mock.method(Tenant, 'findByIdAndUpdate', async (_id, update) => writes.push(update));
  await service.handleWebhookEvent('subscription.disable', { metadata: { tenantId: String(TENANT_ID) }, subscription_code: 'SUB_old' });
  assert.deepEqual(writes, []);
});

test('another purchase for the same customer cannot reactivate ERM billing', async t => {
  t.mock.method(Tenant, 'findById', async () => ({ _id: TENANT_ID, plan: 'pro', paystackSubscriptionCode: 'SUB_current' }));
  const writes = [];
  t.mock.method(Tenant, 'findByIdAndUpdate', async (_id, update) => writes.push(update));
  await service.handleWebhookEvent('charge.success', { metadata: { tenantId: String(TENANT_ID) }, paid_at: new Date().toISOString() });
  await service.handleWebhookEvent('invoice.payment_failed', { metadata: { tenantId: String(TENANT_ID) }, subscription: { subscription_code: 'SUB_old' } });
  assert.deepEqual(writes, []);
});

test('a current subscription cannot start duplicate recurring checkout', async t => {
  t.mock.method(axios, 'post', async () => { assert.fail('must not call Paystack'); });
  await assert.rejects(service.initializeSubscription({ paystackSubscriptionCode: 'SUB_current', subscriptionStatus: 'active' }, 'pro'), /already have a subscription/);
});

test('a missing provider email token cannot be treated as cancelled', async t => {
  t.mock.method(axios, 'get', async () => ({ data: { data: {} } }));
  t.mock.method(Tenant, 'findByIdAndUpdate', async () => { assert.fail('must not change tenant'); });
  await assert.rejects(service.cancelSubscription({ _id: TENANT_ID, paystackSubscriptionCode: 'SUB_base' }), /Unable to verify/);
});

test('payment settings use the authenticated tenant subscription', async t => {
  t.mock.method(axios, 'get', async url => {
    assert.match(url, /subscription\/SUB_base\/manage\/link$/);
    return { data: { data: { link: 'https://paystack.com/manage/subscriptions/test' } } };
  });
  assert.equal(await service.getSubscriptionManagementLink({ paystackSubscriptionCode: 'SUB_base' }), 'https://paystack.com/manage/subscriptions/test');
});

test('staff can see billing status, custom capabilities and projected renewal date', async t => {
  clearUsageCache();
  for (const model of [User, SubProduct, Warehouse]) t.mock.method(model, 'countDocuments', async () => 0);
  const result = await request(t, 'tenant_staff', '/status', 'GET', {
    plan: 'custom', customCapabilities: ['inventory'], currentPeriodEnd: new Date('2026-10-01T00:00:00Z'),
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.data.canManageBilling, false);
  assert.equal(result.body.data.hasSubscription, true);
  assert.equal(result.body.data.currentPeriodEnd, '2026-10-01T00:00:00.000Z');
  assert.deepEqual(result.body.data.capabilities, ['inventory']);
  clearUsageCache();
});

test('customer cannot read ERM status even with a tenant association', async t => {
  const authorization = mockAuthUser(t, { ...ROLE_USERS.customer, tenant: TENANT_ID });
  tenantContext(t);
  const app = await startRouter(router, '/api/erm');
  try {
    const result = await fetch(app.url('/api/erm/status'), { headers: { authorization } });
    assert.equal(result.status, 403);
  } finally { await app.close(); }
});
