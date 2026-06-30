'use strict';

const crypto = require('crypto');
const Tenant = require('../models/Tenant');
const SubProduct = require('../models/SubProduct');
const User = require('../models/User');
const { ERM_PLANS, getPlanConfig, getCommissionRate } = require('../config/erm-plans');
const { initializeSubscription, cancelSubscription, handleWebhookEvent, getSubscriptionDetails } = require('../services/erm.service');
const { ValidationError } = require('../utils/errors');

const getPlans = (req, res) => {
  const plans = Object.entries(ERM_PLANS)
    .filter(([key]) => key !== 'custom')
    .map(([key, cfg]) => ({
      key,
      label: cfg.label,
      priceMonthly: cfg.priceMonthly,
      skuLimit: cfg.skuLimit === Infinity ? null : cfg.skuLimit,
      staffLimit: cfg.staffLimit === Infinity ? null : cfg.staffLimit,
      commissionRate: cfg.commissionRate,
      features: cfg.features,
      addOnsAllowed: cfg.addOnsAllowed,
    }));
  res.json({ success: true, data: plans });
};

const getStatus = async (req, res) => {
  const tenant = req.tenant;
  const plan = getPlanConfig(tenant.plan);

  const [skuCount, staffCount] = await Promise.all([
    SubProduct.countDocuments({ tenant: tenant._id }),
    User.countDocuments({ tenant: tenant._id, role: { $in: ['tenant_owner', 'tenant_admin', 'tenant_staff'] } }),
  ]);

  res.json({
    success: true,
    data: {
      plan: tenant.plan,
      planLabel: plan.label,
      subscriptionStatus: tenant.subscriptionStatus,
      trialEndsAt: tenant.trialEndsAt,
      currentPeriodEnd: tenant.currentPeriodEnd,
      commissionRate: tenant.commissionPercentage ?? plan.commissionRate * 100,
      usage: {
        skus: { used: skuCount, limit: plan.skuLimit === Infinity ? null : plan.skuLimit },
        staff: { used: staffCount, limit: plan.staffLimit === Infinity ? null : plan.staffLimit },
      },
      addOns: tenant.addOns,
    },
  });
};

const subscribe = async (req, res) => {
  const { planKey } = req.body;
  if (!ERM_PLANS[planKey]) throw new ValidationError(`Invalid plan: ${planKey}`);
  if (planKey === 'free_trial') throw new ValidationError('Cannot subscribe to free trial');

  const result = await initializeSubscription(req.tenant, planKey);
  res.json({ success: true, data: result });
};

const cancel = async (req, res) => {
  await cancelSubscription(req.tenant);
  res.json({ success: true, message: 'Subscription cancelled' });
};

const webhook = async (req, res) => {
  const hash = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (hash !== req.headers['x-paystack-signature']) {
    return res.status(400).json({ success: false, message: 'Invalid signature' });
  }

  const { event, data } = req.body;
  await handleWebhookEvent(event, data);
  res.sendStatus(200);
};

const syncCommission = async (req, res) => {
  const tenants = await Tenant.find({ status: 'approved' });
  const ops = tenants.map(t => ({
    updateOne: {
      filter: { _id: t._id },
      update: { $set: { commissionPercentage: getCommissionRate(t.plan) * 100 } },
    },
  }));
  const result = await Tenant.bulkWrite(ops);
  res.json({ success: true, updated: result.modifiedCount });
};

module.exports = { getPlans, getStatus, subscribe, cancel, webhook, syncCommission };
