'use strict';
process.env.PAYSTACK_PLAN_PRO = 'PLN_pro';
process.env.PAYSTACK_PLAN_ENTERPRISE = 'PLN_enterprise';
const test = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');
const Tenant = require('../models/Tenant');
const Transition = require('../models/BillingTransition');
const { providerState, reconcileSubscription } = require('../services/billingReconciliation.service');
const { effectiveDate, schedulePlanChange, reconcilePlanChange } = require('../services/planTransition.service');
const tenant = { _id: 'tenant', plan: 'pro', subscriptionStatus: 'active', paystackCustomerId: 'CUS_own',
  paystackPlanCode: 'PLN_pro', paystackSubscriptionCode: 'SUB_current', billingRevision: 2, currentPeriodEnd: new Date('2099-10-01') };
const remote = { subscription_code: 'SUB_current', customer: { customer_code: 'CUS_own' },
  plan: { plan_code: 'PLN_pro' }, status: 'active' };
test('provider identity and current state override delayed cancellation flags', () => {
  assert.deepEqual(providerState(remote, { ...tenant, cancelAtPeriodEnd: true }), { subscriptionStatus: 'active', cancelAtPeriodEnd: false });
  assert.equal(providerState({ ...remote, status: 'attention' }, tenant).subscriptionStatus, 'past_due');
  assert.throws(() => providerState({ ...remote, subscription_code: 'SUB_old' }, tenant), /identity mismatch/);
  assert.throws(() => providerState({ ...remote, customer: { customer_code: 'CUS_other' } }, tenant), /identity mismatch/);
  assert.throws(() => providerState({ ...remote, status: 'unknown' }, tenant), /Unknown provider/);
});
test('period end cannot move backwards and CAS rejects concurrent reconciliation', async t => {
  assert.equal(providerState({ ...remote, next_payment_date: '2020-01-01' }, tenant).currentPeriodEnd, undefined);
  t.mock.method(Tenant, 'updateOne', async (filter, update) => {
    assert.equal(filter.paystackSubscriptionCode, 'SUB_current');
    assert.equal(filter.billingRevision, 2);
    assert.equal(update.$inc.billingRevision, 1);
    return { matchedCount: 0 };
  });
  await assert.rejects(reconcileSubscription(tenant, async () => remote), /retry/);
});
test('upgrades and downgrades use paid period end without proration', () => {
  assert.equal(effectiveDate(tenant, 'enterprise').toISOString(), tenant.currentPeriodEnd.toISOString());
  assert.throws(() => effectiveDate({ ...tenant, currentPeriodEnd: '2020-01-01' }, 'enterprise'), /paid period/);
  assert.throws(() => effectiveDate({ ...tenant, addOns: [{}] }, 'starter'), /Remove add-on/);
});
test('ambiguous creation remains durable and cannot be retried into another subscription', async t => {
  let created = false;
  let posts = 0;
  const writes = [];
  t.mock.method(Transition, 'findOneAndUpdate', async () => null);
  t.mock.method(Transition, 'create', async row => {
    if (created) throw Object.assign(new Error('duplicate'), { code: 11000 });
    created = true; return { ...row, _id: 'operation' };
  });
  t.mock.method(Transition, 'updateOne', async (_filter, update) => writes.push(update));
  t.mock.method(Tenant, 'updateOne', async () => ({ matchedCount: 1 }));
  t.mock.method(axios, 'get', async url => ({ data: { status: true, data: url.includes('/plan/')
    ? { plan_code: 'PLN_enterprise', amount: 8500000, currency: 'NGN', interval: 'monthly' }
    : { ...remote, email_token: 'private', authorization: { reusable: true, authorization_code: 'AUTH_test' } } } }));
  t.mock.method(axios, 'post', async url => {
    posts++;
    if (url.endsWith('/disable')) return { data: { status: true } };
    throw new Error('provider timeout');
  });
  await assert.rejects(schedulePlanChange(tenant, 'enterprise'), /timeout/);
  assert.ok(writes.some(write => write.$set.state === 'creating' && write.$set.creationStartedAt));
  assert.equal(writes.at(-1).$set.state, 'needs_review');
  await assert.rejects(schedulePlanChange(tenant, 'enterprise'), /already pending/);
  assert.equal(posts, 2);
});
test('scheduled subscription never grants the new tier before payment or effective date', async t => {
  t.mock.method(Transition, 'findOne', async () => ({ oldCode: 'SUB_current', newCode: 'SUB_new', targetPlan: 'enterprise', effectiveAt: new Date('2099-10-01') }));
  t.mock.method(Tenant, 'updateOne', async () => assert.fail('must not grant unpaid access'));
  t.mock.method(axios, 'get', async url => ({ data: { status: true, data: url.endsWith('SUB_current')
    ? { ...remote, status: 'non-renewing' }
    : { ...remote, subscription_code: 'SUB_new', plan: { plan_code: 'PLN_enterprise' }, most_recent_invoice: { paid: 0 } } } }));
  assert.equal(await reconcilePlanChange(tenant, new Date('2099-09-01')), true);
  assert.equal(await reconcilePlanChange(tenant, new Date('2099-10-02')), true);
});
