'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// ERM subscription billing — tenant → platform.
//
// WHICH GATEWAY. This runs on PAYSTACK, while storefront orders run on
// KORAPAY. That is deliberate, not drift:
//
//   * They are two different money flows. Korapay moves shopper → platform for
//     a single order; this moves tenant → platform on a recurring schedule.
//     services/payment.service.js gates the FORMER on PAYMENT_GATEWAY (default
//     'korapay'); that flag has never had anything to do with this file.
//   * The Korapay integration in this repo implements one-off charges
//     (`/charges/initialize`) and nothing else. Recurring plan billing — which
//     is the entire product here — has no counterpart in it.
//   * Paystack Plans + Subscriptions is what the plan codes in
//     PAYSTACK_PLAN_* already describe, and PAYSTACK_SECRET_KEY is configured
//     alongside KORAPAY_SECRET_KEY.
//
// If subscriptions ever move to Korapay, THIS FILE plus the webhook verifier in
// controllers/erm.controller.js are the whole seam. Recorded in
// config/README-plan-entitlements.md §7.
//
// ADD-ONS. The pricing page sells extra shop / extra warehouse, first of each
// free. Each paid unit is its OWN Paystack subscription against its own plan
// code, so a tenant can drop one extra warehouse without disturbing the base
// plan or the other add-on. One subscription = ONE unit: Paystack plans have no
// quantity concept, so buying two means two subscriptions, and pretending
// otherwise would bill for one unit while granting two.
// ─────────────────────────────────────────────────────────────────────────────

const axios = require('axios');
const Tenant = require('../models/Tenant');
const { ConflictError } = require('../utils/errors');
const {
  ERM_PLANS,
  getPlanConfig,
  getCommissionRate,
  getAddOnConfig,
  ADD_ON_TYPES,
} = require('../config/erm-plans');
// Required as a MODULE, not destructured, for two reasons: the tests stub these
// so the webhook branching can be asserted without a mail transport, and a
// destructured binding captured at require time cannot be stubbed.
const billingNotifications = require('./billingNotifications.service');

/**
 * Run a notification without letting it break the webhook.
 *
 * A webhook that throws is a webhook Paystack retries, and subscription state
 * would then be re-applied on a schedule because an SMTP host was slow. The
 * money side of the event has already been written by the time this runs; the
 * email is strictly secondary and is allowed to fail loudly in the log and
 * quietly on the wire.
 */
async function notifyQuietly(label, fn) {
  try {
    await fn();
  } catch (err) {
    console.error(`billing notice (${label}) failed: ${err.message}`);
  }
}

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
  if (tenant.paystackSubscriptionCode) {
    throw new ConflictError('You already have a subscription. Manage its payment method or cancel renewal before choosing a new plan after the billing period ends.');
  }
  const plan = getPlanConfig(planKey);
  if (!plan.paystackPlanCode) throw new Error(`No Paystack plan code configured for "${planKey}". Set PAYSTACK_PLAN_${planKey.toUpperCase()} env var.`);

  await ensurePaystackCustomer(tenant);

  const reference = `erm-${require('crypto').randomUUID()}`;
  const claimed = await Tenant.findOneAndUpdate({ _id: tenant._id,
    'billingCheckout.reference': { $exists: false } }, {
    $set: { billingCheckout: { targetPlan: planKey, reference, startedAt: new Date() } },
  }, { new: true });
  if (!claimed) {
    const current = await Tenant.findById(tenant._id);
    if (current.billingCheckout?.targetPlan === planKey && current.billingCheckout.authorizationUrl) {
      return { authorizationUrl: current.billingCheckout.authorizationUrl, reference: current.billingCheckout.reference };
    }
    throw new ConflictError('Subscription checkout is pending. Reconcile its provider outcome before retrying.');
  }

  const res = await axios.post(`${PAYSTACK_BASE}/transaction/initialize`, {
    reference,
    email: tenant.email,
    amount: plan.priceMonthly * 100,
    plan: plan.paystackPlanCode,
    metadata: {
      tenantId: tenant._id.toString(),
      targetPlan: planKey,
    },
    callback_url: `${process.env.NEXT_PUBLIC_ADMIN_URL || 'http://localhost:3001'}/settings/billing?status=success`,
  }, { headers: headers() });

  await Tenant.updateOne({ _id: tenant._id, 'billingCheckout.reference': reference },
    { $set: { 'billingCheckout.authorizationUrl': res.data.data.authorization_url } });
  return {
    authorizationUrl: res.data.data.authorization_url,
    reference: res.data.data.reference,
  };
}

/**
 * Start checkout for ONE unit of an add-on.
 *
 * The quota is only raised when Paystack confirms the subscription — see
 * `applyAddOnSubscription`. Writing the row here instead would hand out a
 * warehouse slot to anyone who opened the payment page and closed it.
 */
async function initializeAddOnSubscription(tenant, addOnType) {
  const addOn = getAddOnConfig(addOnType);
  if (!addOn) throw new Error(`Unknown add-on "${addOnType}".`);

  const plan = getPlanConfig(tenant.plan);
  if (!plan.addOnsAllowed) {
    throw new Error(`The ${plan.label} plan cannot buy add-ons. Upgrade to Pro or above.`);
  }
  if (!addOn.paystackPlanCode) {
    throw new Error(
      `No Paystack plan code configured for "${addOnType}". Set PAYSTACK_PLAN_${addOnType.toUpperCase()} env var.`
    );
  }

  await ensurePaystackCustomer(tenant);

  const res = await axios.post(`${PAYSTACK_BASE}/transaction/initialize`, {
    email: tenant.email,
    amount: addOn.priceMonthly * 100,
    plan: addOn.paystackPlanCode,
    metadata: {
      tenantId: tenant._id.toString(),
      addOn: addOnType,
    },
    callback_url: `${process.env.NEXT_PUBLIC_ADMIN_URL || 'http://localhost:3001'}/settings/billing?status=success`,
  }, { headers: headers() });

  return {
    authorizationUrl: res.data.data.authorization_url,
    reference: res.data.data.reference,
  };
}

/** Paystack requires the subscription's email_token, not its code twice.
 * Fetch it server-side for existing subscriptions; never send it to the client.
 * https://paystack.com/docs/api/subscription/#disable
 */
async function disableAtPeriodEnd(code) {
  const details = await axios.get(`${PAYSTACK_BASE}/subscription/${encodeURIComponent(code)}`, {
    headers: headers(),
  });
  const emailToken = details.data?.data?.email_token;
  if (!emailToken) throw new Error('Unable to verify subscription cancellation. Please try again.');
  const result = await axios.post(`${PAYSTACK_BASE}/subscription/disable`, {
    code, token: emailToken,
  }, { headers: headers() });
  if (result.data?.status !== true) throw new Error('Subscription cancellation was not accepted. Please try again.');
}

async function cancelSubscription(tenant) {
  if (!tenant.paystackSubscriptionCode || tenant.cancelAtPeriodEnd) return;
  await disableAtPeriodEnd(tenant.paystackSubscriptionCode);
  // Retain paid access until subscription.disable arrives at the period end.
  await Tenant.findByIdAndUpdate(tenant._id, { cancelAtPeriodEnd: true });
}

async function getSubscriptionManagementLink(tenant) {
  if (!tenant.paystackSubscriptionCode) throw new Error('No subscription is available to manage.');
  const result = await axios.get(
    `${PAYSTACK_BASE}/subscription/${encodeURIComponent(tenant.paystackSubscriptionCode)}/manage/link`,
    { headers: headers() }
  );
  const link = result.data?.data?.link;
  if (!link) throw new Error('Unable to open payment settings. Please try again.');
  return link;
}

async function cancelAddOnSubscription(tenant, addOnType) {
  const rows = (tenant.addOns || []).filter(row => row.type === addOnType && !row.cancelAtPeriodEnd);
  const row = rows[rows.length - 1];
  if (!row) return { removed: 0 };
  if (!row.paystackSubscriptionCode) throw new Error('This add-on has no billing subscription. Contact support.');
  await disableAtPeriodEnd(row.paystackSubscriptionCode);
  await Tenant.updateOne(
    { _id: tenant._id, 'addOns.paystackSubscriptionCode': row.paystackSubscriptionCode },
    { $set: { 'addOns.$.cancelAtPeriodEnd': true } }
  );
  return { removed: 1 };
}

/**
 * Pull exactly one add-on row.
 *
 * Matched on `_id` when the row has one so two identical units (same type, no
 * subscription code yet) do not both disappear — a `$pull` on `{type}` alone
 * removes EVERY matching row, which would silently revoke a slot the tenant is
 * still paying for.
 */
function removeAddOnRow(tenantId, row) {
  const match = row._id
    ? { _id: row._id }
    : row.paystackSubscriptionCode
      ? { paystackSubscriptionCode: row.paystackSubscriptionCode }
      : { type: row.type };
  return Tenant.findByIdAndUpdate(tenantId, { $pull: { addOns: match } });
}

// ─── Webhook ─────────────────────────────────────────────────────────────────

/**
 * Find the tenant a Paystack event belongs to.
 *
 * `metadata.tenantId` is what we set at checkout, but Paystack does not carry
 * transaction metadata onto every subscription event, so the customer code we
 * stored on the tenant is the fallback. Returning null (rather than throwing)
 * keeps an event for some other integration from 500-ing the endpoint, which
 * Paystack would retry forever.
 */
async function resolveWebhookTenant(data) {
  const tenantId = data?.metadata?.tenantId;
  if (tenantId) {
    const byId = await Tenant.findById(tenantId);
    if (byId) return byId;
  }

  const customerCode = data?.customer?.customer_code;
  if (customerCode) {
    const byCustomer = await Tenant.findOne({ paystackCustomerId: customerCode });
    if (byCustomer) return byCustomer;
  }

  return null;
}

/**
 * Which add-on, if any, an event is about.
 *
 * Checks our own metadata first, then the plan code — because a renewal or a
 * disable arriving months later carries the plan but not the metadata, and
 * treating an add-on's failed invoice as the BASE subscription failing would
 * put the whole tenant into dunning over a ₦12,000 line item.
 */
function addOnTypeForEvent(data) {
  const fromMetadata = data?.metadata?.addOn;
  if (fromMetadata && ADD_ON_TYPES.includes(fromMetadata)) return fromMetadata;

  const planCode = data?.plan?.plan_code;
  if (!planCode) return null;
  return ADD_ON_TYPES.find((type) => getAddOnConfig(type).paystackPlanCode === planCode) ?? null;
}

/** Record a confirmed add-on purchase, idempotently. */
async function applyAddOnSubscription(tenant, addOnType, data) {
  const code = data?.subscription_code;

  // Paystack retries webhooks, so the same subscription can arrive several
  // times. Keyed on the subscription code, a replay is a no-op instead of a
  // free extra warehouse.
  if (code && (tenant.addOns || []).some((row) => row.paystackSubscriptionCode === code)) {
    return;
  }

  await Tenant.findByIdAndUpdate(tenant._id, {
    $push: {
      addOns: {
        type: addOnType,
        quantity: 1,
        paystackSubscriptionCode: code,
      },
    },
  });
}

async function handleWebhookEvent(event, data) {
  const tenant = await resolveWebhookTenant(data);
  if (!tenant) return;

  const tenantId = tenant._id;
  const addOnType = addOnTypeForEvent(data);

  // A shopper payment or an old subscription for the same customer is not
  // evidence that this tenant's current ERM subscription has been paid.
  const eventCode = data?.subscription_code || data?.subscription?.subscription_code;
  const eventPlan = data?.plan?.plan_code || data?.subscription?.plan?.plan_code;
  const currentPlanCode = tenant.paystackPlanCode || getPlanConfig(tenant.plan).paystackPlanCode;
  const matchesBase = eventCode
    ? eventCode === tenant.paystackSubscriptionCode
    : Boolean(eventPlan && currentPlanCode && eventPlan === currentPlanCode);

  switch (event) {
    case 'subscription.create': {
      if (addOnType) {
        await applyAddOnSubscription(tenant, addOnType, data);
        break;
      }

      const targetPlan = data.metadata?.targetPlan || Object.keys(ERM_PLANS).find(key => {
        const code = getPlanConfig(key).paystackPlanCode;
        return code && code === data.plan?.plan_code;
      });
      if (!targetPlan || ['custom', 'free_trial'].includes(targetPlan) || !Object.hasOwn(ERM_PLANS, targetPlan)) break;
      await Tenant.findByIdAndUpdate(tenantId, {
        plan: targetPlan,
        subscriptionStatus: 'active',
        paystackSubscriptionCode: data.subscription_code,
        cancelAtPeriodEnd: false,
        paystackPlanCode: data.plan?.plan_code,
        commissionPercentage: getCommissionRate(targetPlan) * 100,
        currentPeriodStart: new Date(data.created_at),
        currentPeriodEnd: new Date(data.next_payment_date),
        // A tenant who is paying is no longer on trial. Left set, the elapsed
        // trialEndsAt keeps resolveEntitlements degrading them the moment the
        // date passes, even though the subscription is live.
        trialEndsAt: null,
      });

      // Same reason as charge.success: a tenant who has just subscribed is out
      // of dunning, and the next failure has to be able to speak.
      if (tenant.billingNotices?.pastDueSentAt) {
        await notifyQuietly('clear_dunning', () =>
          billingNotifications.clearDunningNotices(tenantId)
        );
      }
      break;
    }

    case 'charge.success': {
      // An add-on renewal is not evidence about the base subscription.
      if (addOnType || !matchesBase) break;

      // `paid_at` is when the money arrived, NOT when the period ends —
      // writing it to currentPeriodEnd stamped every successful payment with a
      // period that had already expired, and the billing screen then read
      // "Renews <today>" forever. Only advance the period when the payload
      // actually says when the next payment is due.
      const nextPayment = data.next_payment_date || data.subscription?.next_payment_date;
      const update = { subscriptionStatus: 'active' };
      if (data.paid_at) update.currentPeriodStart = new Date(data.paid_at);
      if (nextPayment) update.currentPeriodEnd = new Date(nextPayment);
      await Tenant.findByIdAndUpdate(tenantId, update);

      // This dunning cycle is over. Forget it, so that if the tenant lapses
      // again months from now they are told again — a stale `pastDueSentAt`
      // would silence the second failure entirely.
      //
      // Guarded on there being something to clear: charge.success fires on
      // every renewal of every healthy subscription, and an unconditional
      // $unset would be a write per renewal to remove fields that are not set.
      if (tenant.billingNotices?.pastDueSentAt) {
        await notifyQuietly('clear_dunning', () =>
          billingNotifications.clearDunningNotices(tenantId)
        );
      }
      break;
    }

    case 'invoice.payment_failed': {
      // Ditto: a failed add-on invoice must not put the whole tenant into
      // dunning, which is now a real read-only state and not a dormant flag.
      // AND it must not send the dunning email — telling a paying tenant their
      // account is read-only when it is not is worse than saying nothing. This
      // one `break` covers both, which is why the send sits below it.
      if (addOnType || !matchesBase) break;
      await Tenant.findByIdAndUpdate(tenantId, { subscriptionStatus: 'past_due' });

      // Tell them. This is the moment it happens and there is no other hook for
      // it; the daily sweep only handles the follow-up.
      //
      // The tenant passed in is the one resolveWebhookTenant loaded, with
      // `subscriptionStatus` overridden to the value just written — because
      // notifyReadOnly re-resolves entitlements and would otherwise see the
      // stale 'active' and drop the send as "writes_allowed". Overriding the
      // one field beats a second findById: it is the only field that changed.
      //
      // `toObject()` first: resolveWebhookTenant returns a hydrated Mongoose
      // document, and spreading one of those copies its internals rather than
      // its fields, so the notice would go out with no name and no contact.
      await notifyQuietly('payment_failed', () => {
        const plain = typeof tenant.toObject === 'function' ? tenant.toObject() : { ...tenant };
        return billingNotifications.notifyPaymentFailed({
          ...plain,
          subscriptionStatus: 'past_due',
        });
      });
      break;
    }

    case 'subscription.not_renew': {
      const code = data?.subscription_code;
      if (!code) break;
      const row = (tenant.addOns || []).find(r => r.paystackSubscriptionCode === code);
      if (row) {
        await Tenant.updateOne(
          { _id: tenantId, 'addOns.paystackSubscriptionCode': code },
          { $set: { 'addOns.$.cancelAtPeriodEnd': true } }
        );
      } else if (code === tenant.paystackSubscriptionCode) {
        await Tenant.findByIdAndUpdate(tenantId, { cancelAtPeriodEnd: true });
      }
      break;
    }

    case 'subscription.disable': {
      const code = data?.subscription_code;
      const row = (tenant.addOns || []).find(
        (r) => code && r.paystackSubscriptionCode === code
      );

      // Match on the subscription code FIRST. An add-on and the base plan both
      // arrive as 'subscription.disable' on the same tenant, and cancelling the
      // tenant because one extra shop lapsed would revoke every paid feature.
      if (row || addOnType) {
        if (row) await removeAddOnRow(tenantId, row);
        break;
      }
      if (!code || code !== tenant.paystackSubscriptionCode) break;
      await Tenant.findByIdAndUpdate(tenantId, { subscriptionStatus: 'canceled' });
      break;
    }
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

module.exports = {
  initializeSubscription,
  initializeAddOnSubscription,
  cancelSubscription,
  cancelAddOnSubscription,
  handleWebhookEvent,
  getSubscriptionDetails,
  getSubscriptionManagementLink,
  // Exported for the webhook tests — the branching, not the HTTP calls, is
  // what has to be right.
  addOnTypeForEvent,
  resolveWebhookTenant,
};
