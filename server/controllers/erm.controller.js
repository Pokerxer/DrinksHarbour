'use strict';

const crypto = require('crypto');
const Tenant = require('../models/Tenant');
const {
  ERM_PLANS,
  ADD_ONS,
  ADD_ON_TYPES,
  getPlanConfig,
  getCommissionRate,
  getAddOnConfig,
  addOnQuantity,
  addOnAllowance,
  countedShops,
} = require('../config/erm-plans');
const { resolveEntitlements, readOnlyMessage } = require('../services/entitlements.service');
const { getUsage } = require('../services/ermUsage.service');
const {
  initializeSubscription,
  initializeAddOnSubscription,
  cancelSubscription,
  cancelAddOnSubscription,
  handleWebhookEvent,
  getSubscriptionManagementLink,
} = require('../services/erm.service');
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

  const addOns = ADD_ON_TYPES.map((type) => ({
    type,
    label: ADD_ONS[type].label,
    priceMonthly: ADD_ONS[type].priceMonthly,
  }));

  res.json({ success: true, data: plans, addOns });
};

const getStatus = async (req, res) => {
  const tenant = req.tenant;
  const plan = getPlanConfig(tenant.plan);

  // Cached per tenant for a few seconds — see services/ermUsage.service.js.
  // The admin's root layout calls this endpoint on every render to decide
  // whether to show the read-only banner, so these three counts were being run
  // on every page view of every screen, usually to render nothing.
  //
  // ONLY the counts are cached. Everything below that decides what the tenant
  // may DO — plan, subscriptionStatus, writesAllowed, entitlementMessage — is
  // still derived from the freshly loaded `req.tenant`, so the banner is never
  // stale and a tenant who pays stops seeing it on their next page load.
  const { skus: skuCount, staff: staffCount, warehouses: warehouseCount } =
    await getUsage(tenant._id);

  // countedShops, not a filter written out again here: this number and the one
  // checkShopLimit enforces have to be the same or the screen promises a slot
  // the gate refuses. Every row counts, inactive included — README §5.
  const shopCount = countedShops(tenant);

  // Same resolver the gates use, so the screen cannot promise access the
  // middleware then refuses — including the read-only state a past_due or
  // elapsed-trial tenant is now in.
  const entitlements = resolveEntitlements(tenant);

  // Reported through addOnAllowance for the same reason: the number shown here
  // and the number checkWarehouseLimit/checkShopLimit enforce are one function.
  const addOns = ADD_ON_TYPES.map((type) => ({
    type,
    label: ADD_ONS[type].label,
    priceMonthly: ADD_ONS[type].priceMonthly,
    purchased: addOnQuantity(tenant, type),
    pendingCancellation: (tenant.addOns || []).filter(row => row.type === type && row.cancelAtPeriodEnd).length,
    used: type === 'extra_warehouse' ? warehouseCount : shopCount,
    allowance: addOnAllowance(tenant, type),
  }));

  res.json({
    success: true,
    data: {
      plan: tenant.plan,
      planLabel: plan.label,
      subscriptionStatus: tenant.subscriptionStatus,
      trialEndsAt: tenant.trialEndsAt,
      currentPeriodEnd: tenant.currentPeriodEnd,
      commissionRate: tenant.commissionPercentage ?? plan.commissionRate * 100,
      addOnsAllowed: plan.addOnsAllowed,
      writesAllowed: entitlements.writesAllowed,
      capabilities: entitlements.capabilities,
      canManageBilling: ['super_admin', 'admin', 'tenant_owner', 'tenant_admin'].includes(req.user?.role),
      hasSubscription: Boolean(tenant.paystackSubscriptionCode),
      cancelAtPeriodEnd: Boolean(tenant.cancelAtPeriodEnd),
      revenueModel: tenant.revenueModel,
      entitlementReason: entitlements.reason,
      // The same sentence the write gates put in their 403, so a tenant is not
      // warned in one wording here and refused in another wording there. Null
      // when writes are fine, so a client cannot render a warning by accident.
      entitlementMessage: entitlements.writesAllowed
        ? null
        : readOnlyMessage(entitlements.reason),
      usage: {
        skus: { used: skuCount, limit: plan.skuLimit === Infinity ? null : plan.skuLimit },
        staff: { used: staffCount, limit: plan.staffLimit === Infinity ? null : plan.staffLimit },
        warehouses: { used: warehouseCount, limit: addOnAllowance(tenant, 'extra_warehouse') },
        shops: { used: shopCount, limit: addOnAllowance(tenant, 'extra_shop') },
      },
      addOns,
    },
  });
};

const subscribe = async (req, res) => {
  const { planKey } = req.body;
  if (typeof planKey !== 'string' || !Object.hasOwn(ERM_PLANS, planKey) || planKey === 'custom') throw new ValidationError(`Invalid plan: ${planKey}`);
  if (planKey === 'free_trial') throw new ValidationError('Cannot subscribe to free trial');

  const result = await require('../services/billingLock.service').withBillingLock(req.tenant._id,
    tenant => initializeSubscription(tenant, planKey));
  res.json({ success: true, data: result });
};

const cancel = async (req, res) => {
  await require('../services/billingLock.service').withBillingLock(req.tenant._id,
    tenant => require('../services/billingReconciliation.service').setRenewal(tenant, false));
  res.json({ success: true, message: 'Subscription cancelled' });
};

const manageSubscription = async (req, res) => {
  const pending = await require('../models/BillingTransition').findOne({ tenant: req.tenant._id, state: { $ne: 'complete' } });
  const authorizationUrl = await getSubscriptionManagementLink({ ...req.tenant,
    paystackSubscriptionCode: pending?.newCode || req.tenant.paystackSubscriptionCode });
  res.json({ success: true, data: { authorizationUrl } });
};

/**
 * Buy ONE unit of an add-on. Returns a Paystack checkout URL; the quota only
 * moves when the subscription.create webhook lands.
 */
const subscribeAddOn = async (req, res) => {
  const { addOnType } = req.body;
  if (!getAddOnConfig(addOnType)) {
    throw new ValidationError(`Invalid add-on: ${addOnType}. Expected one of ${ADD_ON_TYPES.join(', ')}.`);
  }

  const plan = getPlanConfig(req.tenant.plan);
  if (!resolveEntitlements(req.tenant).writesAllowed) {
    throw new ValidationError('Resolve your base subscription billing before buying add-ons.');
  }
  if (!plan.addOnsAllowed) {
    throw new ValidationError(
      `The ${plan.label} plan includes one of each. Upgrade to Pro or above to buy more.`
    );
  }

  const result = await initializeAddOnSubscription(req.tenant, addOnType);
  res.json({ success: true, data: result });
};

const cancelAddOn = async (req, res) => {
  const { addOnType } = req.params;
  if (!getAddOnConfig(addOnType)) {
    throw new ValidationError(`Invalid add-on: ${addOnType}.`);
  }

  const { removed } = await cancelAddOnSubscription(req.tenant, addOnType);
  res.json({
    success: true,
    message: removed
      ? `${getAddOnConfig(addOnType).label} cancelled.`
      : `No paid ${getAddOnConfig(addOnType).noun} add-on to cancel.`,
  });
};

/**
 * Verify a Paystack webhook signature.
 *
 * HMAC-SHA512 over the RAW REQUEST BYTES. This used to hash
 * `JSON.stringify(req.body)` — a re-serialisation of the parsed object, which
 * is only accidentally equal to what Paystack signed. Any difference in
 * whitespace, unicode escaping or number formatting produces a different
 * digest, every webhook 400s, and subscription state silently stops updating:
 * upgrades never land, dunning never clears. The router keeps the buffer on
 * `req.rawBody` for exactly this.
 *
 * Compared with timingSafeEqual, and a missing secret is a hard refusal rather
 * than an HMAC keyed on `undefined` that anyone could reproduce.
 */
function verifyPaystackSignature(req) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return false;

  const signature = req.headers['x-paystack-signature'];
  if (typeof signature !== 'string' || !signature) return false;

  const payload = Buffer.isBuffer(req.rawBody)
    ? req.rawBody
    : Buffer.from(JSON.stringify(req.body));

  const expected = crypto.createHmac('sha512', secret).update(payload).digest('hex');

  const given = Buffer.from(signature, 'utf8');
  const mine = Buffer.from(expected, 'utf8');
  if (given.length !== mine.length) return false;
  return crypto.timingSafeEqual(given, mine);
}

const webhook = async (req, res) => {
  if (!verifyPaystackSignature(req)) {
    return res.status(400).json({ success: false, message: 'Invalid signature' });
  }

  const { event, data } = req.body;
  await require('../services/billingWebhook.service').handleProviderEvent(event, data);
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

module.exports = {
  getPlans,
  getStatus,
  subscribe,
  cancel,
  manageSubscription,
  subscribeAddOn,
  cancelAddOn,
  webhook,
  syncCommission,
  verifyPaystackSignature,
};
