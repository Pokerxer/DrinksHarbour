'use strict';
const axios = require('axios');
const Transition = require('../models/BillingTransition');
const Tenant = require('../models/Tenant');
const { ERM_PLANS, getPlanConfig, getCommissionRate } = require('../config/erm-plans');
const { ConflictError, ValidationError } = require('../utils/errors');
const { BASE, options, fetchSubscription, providerState } = require('./billingReconciliation.service');

// Policy: full next-cycle price, no proration/credit, old entitlements until
// period end and verified payment of the replacement. Never mutate shared plans.
function effectiveDate(tenant, targetPlan, now = new Date()) {
  if (!Object.hasOwn(ERM_PLANS, targetPlan) || ['custom', 'free_trial', tenant.plan].includes(targetPlan)) {
    throw new ValidationError('Choose a different paid plan');
  }
  const end = new Date(tenant.currentPeriodEnd);
  if (!tenant.paystackSubscriptionCode || tenant.subscriptionStatus !== 'active' ||
      !Number.isFinite(end.getTime()) || end <= now) throw new ConflictError('An active paid period is required');
  if (!getPlanConfig(targetPlan).addOnsAllowed && (tenant.addOns || []).length) {
    throw new ConflictError('Remove add-on subscriptions before changing to this plan');
  }
  return end;
}

async function schedulePlanChange(tenant, targetPlan) {
  const effectiveAt = effectiveDate(tenant, targetPlan);
  const plan = getPlanConfig(targetPlan);
  if (!plan.paystackPlanCode) throw new ValidationError('Target provider plan is not configured');
  const configured = await axios.get(`${BASE}/plan/${encodeURIComponent(plan.paystackPlanCode)}`, options());
  const providerPlan = configured.data?.data;
  if (configured.data?.status !== true || providerPlan?.plan_code !== plan.paystackPlanCode ||
      providerPlan.amount !== plan.priceMonthly * 100 || providerPlan.currency !== 'NGN' || providerPlan.interval !== 'monthly') {
    throw new ValidationError('Provider plan does not match the configured monthly price and currency');
  }
  let operation;
  try {
    operation = await Transition.findOneAndUpdate({ tenant: tenant._id, state: 'complete' }, {
      $set: { targetPlan, oldCode: tenant.paystackSubscriptionCode, effectiveAt, state: 'preparing', operationId: require('node:crypto').randomUUID() },
      $unset: { newCode: 1, reason: 1, creationStartedAt: 1 },
    }, { new: true });
    if (!operation) operation = await Transition.create({ tenant: tenant._id, targetPlan,
      oldCode: tenant.paystackSubscriptionCode, effectiveAt, state: 'preparing' });
  } catch (error) {
    if (error.code === 11000) throw new ConflictError('A plan change is already pending; reconcile it before retrying');
    throw error;
  }
  try {
    const remote = await fetchSubscription(operation.oldCode);
    providerState(remote, tenant);
    if (!remote.email_token || !remote.authorization?.reusable || !remote.authorization.authorization_code) {
      throw new ConflictError('Update your payment method before changing plans');
    }
    const disabled = await axios.post(`${BASE}/subscription/disable`, {
      code: operation.oldCode, token: remote.email_token,
    }, options());
    if (disabled.data?.status !== true) throw new Error('Provider did not accept cancellation of old renewal');
    await Tenant.updateOne({ _id: tenant._id, paystackSubscriptionCode: operation.oldCode },
      { $set: { cancelAtPeriodEnd: true }, $inc: { billingRevision: 1 } });
    await Transition.updateOne({ _id: operation._id, operationId: operation.operationId }, { $set: { state: 'creating', creationStartedAt: new Date() } });
    // Persist creating BEFORE sending. A timeout/crash never authorizes another
    // POST; reconciliation finds the provider record or requests operator review.
    const result = await axios.post(`${BASE}/subscription`, { customer: tenant.paystackCustomerId,
      plan: plan.paystackPlanCode, authorization: remote.authorization.authorization_code,
      start_date: effectiveAt.toISOString() }, options());
    if (result.data?.status !== true || !result.data.data?.subscription_code) throw new Error('Ambiguous subscription creation');
    await Transition.updateOne({ _id: operation._id, operationId: operation.operationId }, { $set: {
      state: 'scheduled', newCode: result.data.data.subscription_code,
    } });
    return { targetPlan, effectiveAt, state: 'scheduled' };
  } catch (error) {
    await Transition.updateOne({ _id: operation._id, operationId: operation.operationId }, { $set: { state: 'needs_review', reason: 'Verify provider outcome before retrying' } });
    throw error;
  }
}

async function reconcilePlanChange(tenant, now = new Date()) {
  const operation = await Transition.findOne({ tenant: tenant._id, state: { $ne: 'complete' } });
  if (!operation) return false;
  if (!operation.newCode && operation.creationStartedAt) {
    const old = await fetchSubscription(operation.oldCode);
    if (old.customer?.customer_code !== tenant.paystackCustomerId || !old.customer?.id) throw new Error('Cannot reconcile customer identity');
    const matches = [];
    for (let page = 1; ; page++) {
      const response = await axios.get(`${BASE}/subscription`, { ...options(), params: { customer: old.customer.id, perPage: 100, page } });
      if (response.data?.status !== true || !Array.isArray(response.data.data)) throw new Error('Cannot list provider subscriptions');
      const rows = response.data.data;
      for (const row of rows) {
        const start = typeof row.start === 'number' ? new Date(row.start * 1000) : new Date(row.start_date || row.start);
        const created = new Date(row.createdAt || row.created_at);
        if (row.customer?.customer_code === tenant.paystackCustomerId &&
            row.plan?.plan_code === getPlanConfig(operation.targetPlan).paystackPlanCode &&
            start.getTime() === new Date(operation.effectiveAt).getTime() &&
            created >= new Date(new Date(operation.creationStartedAt).getTime() - 1000)) matches.push(row);
      }
      if (rows.length < 100) break;
      if (page >= 100) throw new Error('Subscription listing requires manual review');
    }
    if (matches.length === 1) {
      operation.newCode = matches[0].subscription_code;
      await Transition.updateOne({ _id: operation._id, operationId: operation.operationId, newCode: null }, { $set: { newCode: operation.newCode, state: 'scheduled' } });
    }
  }
  if (!operation.newCode) return true; // Never resend ambiguous creation.
  // The provider dashboard can re-enable the old renewal while a replacement
  // is scheduled. Reassert the saved transition before the next debit.
  const old = await fetchSubscription(operation.oldCode);
  providerState(old, { ...(tenant.toObject?.() || tenant), paystackSubscriptionCode: operation.oldCode, paystackPlanCode: undefined });
  if (['active', 'attention'].includes(old.status)) {
    if (!old.email_token) throw new Error('Old renewal cannot be reconciled');
    const disabled = await axios.post(`${BASE}/subscription/disable`, { code: operation.oldCode, token: old.email_token }, options());
    if (disabled.data?.status !== true) throw new Error('Old renewal disable was not accepted');
  }
  if (now < new Date(operation.effectiveAt)) return true;
  const remote = await fetchSubscription(operation.newCode);
  const targetCode = getPlanConfig(operation.targetPlan).paystackPlanCode;
  providerState(remote, { ...(tenant.toObject?.() || tenant),
    paystackSubscriptionCode: operation.newCode, paystackPlanCode: targetCode });
  const invoice = remote.most_recent_invoice;
  const periodStart = new Date(invoice?.period_start);
  const periodEnd = new Date(invoice?.period_end);
  if (remote.status !== 'active' || ![1, true].includes(invoice?.paid) ||
      !Number.isFinite(periodStart.getTime()) || !Number.isFinite(periodEnd.getTime()) ||
      periodEnd <= periodStart || periodStart < new Date(operation.effectiveAt)) return true;
  const result = await Tenant.updateOne({ _id: tenant._id,
    ...(tenant.billingRevision ? { billingRevision: tenant.billingRevision } : { $or: [{ billingRevision: 0 }, { billingRevision: { $exists: false } }] }),
    paystackSubscriptionCode: { $in: [operation.oldCode, operation.newCode] } }, {
    $set: { plan: operation.targetPlan, paystackPlanCode: targetCode,
      paystackSubscriptionCode: operation.newCode, subscriptionStatus: 'active', cancelAtPeriodEnd: false,
      trialEndsAt: null, currentPeriodStart: new Date(invoice.period_start), currentPeriodEnd: new Date(invoice.period_end),
      commissionPercentage: getCommissionRate(operation.targetPlan) * 100 }, $inc: { billingRevision: 1 },
  });
  if (result.matchedCount) await Transition.updateOne({ _id: operation._id, operationId: operation.operationId }, { $set: { state: 'complete' } });
  return true;
}
module.exports = { effectiveDate, schedulePlanChange, reconcilePlanChange };
