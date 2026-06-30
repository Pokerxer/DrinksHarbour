'use strict';

const axios = require('axios');
const Tenant = require('../models/Tenant');
const { getPlanConfig, getCommissionRate } = require('../config/erm-plans');

const PAYSTACK_BASE = 'https://api.paystack.co';
const headers = () => ({ Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` });

async function ensurePaystackCustomer(tenant) {
  if (tenant.paystackCustomerId) return tenant.paystackCustomerId;

  const res = await axios.post(`${PAYSTACK_BASE}/customer`, {
    email: tenant.email,
    first_name: tenant.businessName,
    metadata: { tenantId: tenant._id.toString() },
  }, { headers: headers() });

  const customerCode = res.data.data.customer_code;
  await Tenant.findByIdAndUpdate(tenant._id, { paystackCustomerId: customerCode });
  return customerCode;
}

async function initializeSubscription(tenant, planKey) {
  const plan = getPlanConfig(planKey);
  if (!plan.paystackPlanCode) throw new Error(`No Paystack plan code configured for "${planKey}". Set PAYSTACK_PLAN_${planKey.toUpperCase()} env var.`);

  await ensurePaystackCustomer(tenant);

  const res = await axios.post(`${PAYSTACK_BASE}/transaction/initialize`, {
    email: tenant.email,
    amount: plan.priceMonthly * 100,
    plan: plan.paystackPlanCode,
    metadata: {
      tenantId: tenant._id.toString(),
      targetPlan: planKey,
    },
    callback_url: `${process.env.NEXT_PUBLIC_ADMIN_URL || 'http://localhost:3001'}/settings/billing?status=success`,
  }, { headers: headers() });

  return {
    authorizationUrl: res.data.data.authorization_url,
    reference: res.data.data.reference,
  };
}

async function cancelSubscription(tenant) {
  if (!tenant.paystackSubscriptionCode) return;

  await axios.post(`${PAYSTACK_BASE}/subscription/disable`, {
    code: tenant.paystackSubscriptionCode,
    token: tenant.paystackSubscriptionCode,
  }, { headers: headers() }).catch(() => {});

  await Tenant.findByIdAndUpdate(tenant._id, { subscriptionStatus: 'canceled' });
}

async function handleWebhookEvent(event, data) {
  const tenantId = data?.metadata?.tenantId;
  if (!tenantId) return;

  const tenant = await Tenant.findById(tenantId);
  if (!tenant) return;

  switch (event) {
    case 'subscription.create': {
      const targetPlan = data.metadata?.targetPlan;
      if (!targetPlan) break;
      await Tenant.findByIdAndUpdate(tenantId, {
        plan: targetPlan,
        subscriptionStatus: 'active',
        paystackSubscriptionCode: data.subscription_code,
        paystackPlanCode: data.plan?.plan_code,
        commissionPercentage: getCommissionRate(targetPlan) * 100,
        currentPeriodStart: new Date(data.created_at),
        currentPeriodEnd: new Date(data.next_payment_date),
      });
      break;
    }

    case 'charge.success':
      await Tenant.findByIdAndUpdate(tenantId, {
        subscriptionStatus: 'active',
        currentPeriodEnd: new Date(data.paid_at),
      });
      break;

    case 'invoice.payment_failed':
      await Tenant.findByIdAndUpdate(tenantId, { subscriptionStatus: 'past_due' });
      break;

    case 'subscription.disable':
      await Tenant.findByIdAndUpdate(tenantId, { subscriptionStatus: 'canceled' });
      break;
  }
}

async function getSubscriptionDetails(tenant) {
  if (!tenant.paystackSubscriptionCode) return null;
  try {
    const res = await axios.get(
      `${PAYSTACK_BASE}/subscription/${tenant.paystackSubscriptionCode}`,
      { headers: headers() }
    );
    return res.data.data;
  } catch {
    return null;
  }
}

module.exports = { initializeSubscription, cancelSubscription, handleWebhookEvent, getSubscriptionDetails };
