'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');
const Tenant = require('../models/Tenant');
const Transition = require('../models/BillingTransition');
const { handleProviderEvent } = require('../services/billingWebhook.service');
test('delayed and duplicate base events reconcile current provider state, never payload state', async t => {
  const tenant = { _id: 'tenant', paystackSubscriptionCode: 'SUB_current', paystackCustomerId: 'CUS_own',
    plan: 'pro', billingRevision: 0, subscriptionStatus: 'active', cancelAtPeriodEnd: false };
  t.mock.method(Tenant, 'findById', async () => tenant);
  t.mock.method(Transition, 'findOne', async () => null);
  t.mock.method(axios, 'get', async () => ({ data: { status: true, data: { subscription_code: 'SUB_current',
    customer: { customer_code: 'CUS_own' }, status: 'active' } } }));
  t.mock.method(Tenant, 'updateOne', async (filter, update) => {
    assert.equal(filter.paystackSubscriptionCode, 'SUB_current');
    assert.equal(update.$set.subscriptionStatus, 'active');
    assert.equal(update.$set.cancelAtPeriodEnd, false);
    Object.assign(tenant, update.$set); tenant.billingRevision++;
    return { matchedCount: 1 };
  });
  for (const event of ['subscription.disable', 'invoice.payment_failed', 'subscription.not_renew', 'subscription.disable']) {
    await handleProviderEvent(event, { metadata: { tenantId: 'tenant' }, subscription_code: 'SUB_current' });
  }
  assert.equal(tenant.billingRevision, 4);
});
test('stale subscription identity never overwrites the current plan', async t => {
  t.mock.method(Tenant, 'findById', async () => ({ _id: 'tenant', paystackSubscriptionCode: 'SUB_current' }));
  t.mock.method(Transition, 'findOne', async () => null);
  t.mock.method(axios, 'get', async () => assert.fail('unknown identity must not be adopted'));
  t.mock.method(Tenant, 'updateOne', async () => assert.fail('must not write stale identity'));
  await handleProviderEvent('subscription.create', { metadata: { tenantId: 'tenant', targetPlan: 'enterprise' }, subscription_code: 'SUB_old' });
  await handleProviderEvent('subscription.disable', { metadata: { tenantId: 'tenant' }, subscription_code: 'SUB_old' });
});
