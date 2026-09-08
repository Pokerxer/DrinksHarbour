'use strict';
const Tenant = require('../models/Tenant');
const Transition = require('../models/BillingTransition');
const { resolveWebhookTenant, addOnTypeForEvent } = require('./erm.service');
const { fetchSubscription, reconcileSubscription, providerState } = require('./billingReconciliation.service');
const { reconcilePlanChange } = require('./planTransition.service');
const { ERM_PLANS, getPlanConfig, getCommissionRate } = require('../config/erm-plans');
const notifications = require('./billingNotifications.service');

// Signature verification remains in the controller. Events trigger a fresh
// provider read; delayed notifications never become authoritative state.
async function handleProviderEvent(event, data) {
  if (!['subscription.create', 'subscription.disable', 'subscription.not_renew', 'charge.success', 'invoice.payment_failed'].includes(event)) return;
  const tenant = await resolveWebhookTenant(data);
  if (!tenant) return;
  const code = data.subscription_code || data.subscription?.subscription_code;
  if (!code) {
    if (!addOnTypeForEvent(data) && tenant.paystackSubscriptionCode) await reconcileSubscription(tenant);
    return;
  }
  const transition = await Transition.findOne({ tenant: tenant._id, state: { $ne: 'complete' } });
  if (transition?.newCode === code) { await reconcilePlanChange(tenant); return; }
  if (code === tenant.paystackSubscriptionCode) {
    const update = await reconcileSubscription(tenant);
    try {
      if (update.subscriptionStatus === 'past_due') {
        await notifications.notifyPaymentFailed({ ...(tenant.toObject?.() || tenant), ...update });
      } else if (update.subscriptionStatus === 'active' && tenant.billingNotices?.pastDueSentAt) {
        await notifications.clearDunningNotices(tenant._id);
      }
    } catch (error) { console.error('Billing notification failed:', error.message); }
    return;
  }
  const addOn = addOnTypeForEvent(data);
  const row = (tenant.addOns || []).find(item => item.paystackSubscriptionCode === code);
  if (row || (addOn && event === 'subscription.create')) {
    await require('./billingReconciliation.service').reconcileAddOn(tenant, code, addOn);
    return;
  }
  // An unknown or old subscription cannot replace the current identity.
  if (tenant.paystackSubscriptionCode || transition || event !== 'subscription.create') return;
  const target = tenant.billingCheckout?.targetPlan;
  if (!target || !Object.hasOwn(ERM_PLANS, target)) return;
  const remote = await fetchSubscription(code);
  const planCode = getPlanConfig(target).paystackPlanCode;
  const startedAt = new Date(tenant.billingCheckout.startedAt);
  const createdAt = new Date(remote.createdAt || remote.created_at);
  if (!Number.isFinite(startedAt.getTime()) || !Number.isFinite(createdAt.getTime()) || createdAt.getTime() + 1000 < startedAt.getTime()) return;
  const axios = require('axios');
  const { BASE, options } = require('./billingReconciliation.service');
  const transaction = await axios.get(`${BASE}/transaction/verify/${encodeURIComponent(tenant.billingCheckout.reference)}`, options());
  const payment = transaction.data?.data;
  if (transaction.data?.status !== true || payment?.status !== 'success' ||
      payment.reference !== tenant.billingCheckout.reference ||
      payment.customer?.customer_code !== tenant.paystackCustomerId ||
      payment.currency !== 'NGN' || payment.amount !== getPlanConfig(target).priceMonthly * 100 ||
      payment.authorization?.authorization_code !== remote.authorization?.authorization_code) return;
  const update = providerState(remote, { ...(tenant.toObject?.() || tenant),
    paystackSubscriptionCode: code, paystackPlanCode: planCode });
  if (update.subscriptionStatus !== 'active') return;
  await Tenant.updateOne({ _id: tenant._id, paystackSubscriptionCode: null,
    'billingCheckout.targetPlan': target }, { $set: { ...update, plan: target,
      paystackSubscriptionCode: code, paystackPlanCode: planCode,
      trialEndsAt: null, commissionPercentage: getCommissionRate(target) * 100 },
    $unset: { billingCheckout: 1 }, $inc: { billingRevision: 1 } });
}
module.exports = { handleProviderEvent };
