'use strict';
const axios = require('axios');
const Tenant = require('../models/Tenant');
const { ConflictError } = require('../utils/errors');
const BASE = 'https://api.paystack.co';
const options = () => ({ headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` }, timeout: 15000 });
const revisionFilter = tenant => tenant.billingRevision ? { billingRevision: tenant.billingRevision }
  : { $or: [{ billingRevision: 0 }, { billingRevision: { $exists: false } }] };

async function fetchSubscription(code) {
  const response = await axios.get(`${BASE}/subscription/${encodeURIComponent(code)}`, options());
  if (response.data?.status !== true || response.data.data?.subscription_code !== code) {
    throw new Error('Provider subscription identity could not be verified');
  }
  return response.data.data;
}

function providerState(remote, tenant) {
  if (remote.subscription_code !== tenant.paystackSubscriptionCode ||
      remote.customer?.customer_code !== tenant.paystackCustomerId ||
      (tenant.paystackPlanCode && remote.plan?.plan_code !== tenant.paystackPlanCode)) {
    throw new ConflictError('Provider subscription identity mismatch');
  }
  const statuses = { active: 'active', 'non-renewing': 'active', attention: 'past_due',
    completed: 'canceled', cancelled: 'canceled' };
  if (!statuses[remote.status]) throw new Error('Unknown provider subscription status');
  const update = { subscriptionStatus: statuses[remote.status], cancelAtPeriodEnd: remote.status === 'non-renewing' || statuses[remote.status] === 'canceled' };
  const end = new Date(remote.next_payment_date);
  if (remote.next_payment_date && Number.isFinite(end.getTime()) &&
      (!tenant.currentPeriodEnd || end >= new Date(tenant.currentPeriodEnd))) update.currentPeriodEnd = end;
  return update;
}

async function reconcileSubscription(tenant, fetch = fetchSubscription) {
  if (!tenant.paystackSubscriptionCode) return null;
  const remote = await fetch(tenant.paystackSubscriptionCode);
  const update = providerState(remote, tenant);
  // A competing reconcile/plan adoption invalidates this snapshot. Retry via
  // webhook delivery or the scheduled sweep, never overwrite the newer state.
  const result = await Tenant.updateOne({ _id: tenant._id,
    paystackSubscriptionCode: tenant.paystackSubscriptionCode,
    ...revisionFilter(tenant),
  }, { $set: update, $inc: { billingRevision: 1 } });
  if (!result.matchedCount) throw new ConflictError('Billing changed during reconciliation; retry');
  return update;
}

async function reconcileAddOn(tenant, code, type) {
  const row = (tenant.addOns || []).find(item => item.paystackSubscriptionCode === code);
  const addOn = require('../config/erm-plans').getAddOnConfig(row?.type || type);
  if (!addOn) return;
  const remote = await fetchSubscription(code);
  if (remote.customer?.customer_code !== tenant.paystackCustomerId || remote.plan?.plan_code !== addOn.paystackPlanCode) {
    throw new ConflictError('Provider add-on identity mismatch');
  }
  let update;
  if (['completed', 'cancelled'].includes(remote.status)) {
    if (!row) return;
    update = { $pull: { addOns: { paystackSubscriptionCode: code } } };
  } else if (row && ['active', 'attention', 'non-renewing'].includes(remote.status)) {
    update = { $set: { 'addOns.$.cancelAtPeriodEnd': remote.status === 'non-renewing' } };
  } else if (!row && remote.status === 'active') {
    update = { $push: { addOns: { type, quantity: 1, paystackSubscriptionCode: code } } };
  } else return;
  const result = await Tenant.updateOne({ _id: tenant._id, ...revisionFilter(tenant),
    'addOns.paystackSubscriptionCode': row ? code : { $ne: code } }, { ...update, $inc: { billingRevision: 1 } });
  if (!result.matchedCount) throw new ConflictError('Add-on changed during reconciliation; retry');
}

async function setRenewal(tenant, enabled) {
  if (!tenant.paystackSubscriptionCode) throw new ConflictError('No subscription is available to renew');
  const Transition = require('../models/BillingTransition');
  if (await Transition.findOne({ tenant: tenant._id, state: { $ne: 'complete' } })) {
    throw new ConflictError('A plan change is already pending');
  }
  const remote = await fetchSubscription(tenant.paystackSubscriptionCode);
  providerState(remote, tenant);
  if (!remote.email_token) throw new Error('Provider renewal token unavailable');
  const response = await axios.post(`${BASE}/subscription/${enabled ? 'enable' : 'disable'}`, {
    code: remote.subscription_code, token: remote.email_token,
  }, options());
  if (response.data?.status !== true) throw new Error('Provider rejected renewal change');
  return reconcileSubscription(tenant);
}
module.exports = { BASE, options, fetchSubscription, providerState, reconcileSubscription, reconcileAddOn, setRenewal, revisionFilter };
