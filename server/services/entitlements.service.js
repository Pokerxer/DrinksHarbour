'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// What a tenant may actually reach, right now.
//
// The plan alone does not answer that. Three things narrow it, and before this
// module existed NONE of them were consulted anywhere in the codebase:
//
//   1. `custom` — in the Tenant.plan enum but off the price ladder. See the
//      note in config/erm-plans.js for how it used to fail in opposite
//      directions on the two sides of the wire.
//   2. `subscriptionStatus` — a past_due or canceled tenant kept full access
//      forever, because plan was checked and paying never was.
//   3. `trialEndsAt` — nothing ever expired a free trial.
//
// Every gate goes through resolveEntitlements so no call site has to remember
// any of it. The rules are business policy, not implementation detail — they
// are written out in server/config/README-plan-entitlements.md and any change
// belongs there too.
//
// ON THE DUNNING BRANCHES BELOW, AND WHY THEY LOOK UNREACHABLE ON THE SERVER.
// middleware/tenant.middleware.js already refuses to populate `req.tenant` at
// all unless status is 'approved' AND subscriptionStatus is active/trialing, so
// a past_due or canceled tenant is denied outright before any capability gate
// runs. That guard is deliberately NOT loosened here — softening a live access
// control to make a new code path reachable is the wrong trade.
//
// The branches are still load-bearing, in two ways:
//   * the admin client resolves entitlements from the LIVE tenant document it
//     already fetches, where those statuses are visible, and uses them to show
//     "your subscription is past due" instead of a dead page that spins;
//   * they are defence in depth if tenant resolution is ever relaxed.
// ─────────────────────────────────────────────────────────────────────────────

const { getPlanCapabilities } = require('../config/erm-plans');

/** Statuses where the tenant is switched off outright, by explicit admin act. */
const DISABLED_TENANT_STATUSES = ['suspended', 'archived'];

/**
 * Subscription statuses that fall back to the free_trial capability set: the
 * subscription is gone or never completed, so paid features go with it. Core
 * inventory/orders survive deliberately — a lapsed tenant must still be able
 * to read their own books and wind down, and locking them out entirely is how
 * you turn a billing problem into a support incident.
 */
const LAPSED_STATUSES = ['canceled', 'incomplete', 'incomplete_expired'];

/**
 * Statuses that keep the plan's capabilities but lose WRITE access. `past_due`
 * is a dunning state, not a cancellation — the tenant is expected to pay and
 * come back, so they keep sight of everything and simply cannot change it.
 */
const READ_ONLY_STATUSES = ['past_due'];

function trialHasElapsed(tenant, now) {
  if (tenant.subscriptionStatus !== 'trialing') return false;
  if (!tenant.trialEndsAt) return false;
  return new Date(tenant.trialEndsAt).getTime() <= now.getTime();
}

/**
 * Resolve one tenant's live entitlements.
 *
 * `now` is injected rather than read from the clock so the trial-expiry branch
 * is testable without freezing time globally.
 *
 * @returns {{ capabilities: string[], writesAllowed: boolean, reason: string,
 *             plan: string, degraded: boolean }}
 */
function resolveEntitlements(tenant, now = new Date()) {
  if (!tenant) {
    return {
      capabilities: [],
      writesAllowed: false,
      reason: 'no_tenant',
      plan: 'free_trial',
      degraded: true,
    };
  }

  const plan = tenant.plan || 'free_trial';

  if (DISABLED_TENANT_STATUSES.includes(tenant.status)) {
    return {
      capabilities: [],
      writesAllowed: false,
      reason: `tenant_${tenant.status}`,
      plan,
      degraded: true,
    };
  }

  // A custom tenant's set is negotiated. Default to the `custom` entry in
  // ERM_PLANS (enterprise-equivalent) and let an explicit override on the
  // document replace it — narrower OR wider, since the whole point of a custom
  // contract is that it is not one of the six.
  const base =
    plan === 'custom' && Array.isArray(tenant.customCapabilities) && tenant.customCapabilities.length
      ? [...tenant.customCapabilities]
      : [...getPlanCapabilities(plan)];

  if (LAPSED_STATUSES.includes(tenant.subscriptionStatus)) {
    return {
      capabilities: [...getPlanCapabilities('free_trial')],
      writesAllowed: false,
      reason: `subscription_${tenant.subscriptionStatus}`,
      plan,
      degraded: true,
    };
  }

  if (trialHasElapsed(tenant, now)) {
    return {
      capabilities: [...getPlanCapabilities('free_trial')],
      writesAllowed: false,
      reason: 'trial_expired',
      plan,
      degraded: true,
    };
  }

  if (READ_ONLY_STATUSES.includes(tenant.subscriptionStatus)) {
    return {
      capabilities: base,
      writesAllowed: false,
      reason: `subscription_${tenant.subscriptionStatus}`,
      plan,
      degraded: true,
    };
  }

  return {
    capabilities: base,
    writesAllowed: true,
    reason: 'ok',
    plan,
    degraded: false,
  };
}

/**
 * What to TELL a tenant whose writes were refused.
 *
 * ONE SOURCE, deliberately. Before this existed the sentence was written out
 * three times — `assertWritesAllowed` in tenant.middleware.js, the read-only
 * branch of `requireCapability` in plan.middleware.js, and the banner on the
 * admin billing page — and they had already drifted ("Your account is
 * read-only until billing is resolved" vs "Access is read-only until billing
 * is resolved"), so the same tenant read a different explanation depending on
 * which gate happened to catch them.
 *
 * It is keyed on `resolveEntitlements(...).reason`, which is also what
 * `GET /api/erm/status` reports, so the message the client shows up-front and
 * the message it gets back from a refused save are the same string.
 *
 * Every sentence has to survive being read by someone who has no idea what a
 * "subscription status" is, and has to end with the way out — the whole point
 * of the read-only state (README §4) is that there IS one.
 */
const READ_ONLY_MESSAGES = {
  trial_expired:
    'Your free trial has ended. Reactivate your subscription to make changes.',
  subscription_past_due:
    'Your last payment failed. Your account is read-only until billing is resolved — you can still pay from the billing page.',
  subscription_canceled:
    'Your subscription was cancelled. Your account is read-only — choose a plan to start making changes again.',
  subscription_incomplete:
    'Your subscription was never completed. Your account is read-only — finish checkout to start making changes.',
  subscription_incomplete_expired:
    'Your subscription was never completed and has expired. Your account is read-only — choose a plan to start making changes again.',
  tenant_suspended:
    'This account has been suspended. Contact DrinksHarbour support to restore it.',
  tenant_archived:
    'This account has been archived. Contact DrinksHarbour support to restore it.',
  no_tenant: 'Your account is not attached to a shop, so there is nothing to change.',
};

const READ_ONLY_FALLBACK =
  'Your subscription is not in good standing. Your account is read-only until billing is resolved.';

/** The sentence for a `writesAllowed: false` reason. Never returns empty. */
function readOnlyMessage(reason) {
  return READ_ONLY_MESSAGES[reason] || READ_ONLY_FALLBACK;
}

/** Does this tenant hold ANY of `required`? An empty requirement is ungated. */
function hasAnyCapability(tenant, required, now = new Date()) {
  if (!required || required.length === 0) return true;
  const { capabilities } = resolveEntitlements(tenant, now);
  return required.some((cap) => capabilities.includes(cap));
}

module.exports = {
  resolveEntitlements,
  hasAnyCapability,
  readOnlyMessage,
  READ_ONLY_MESSAGES,
  READ_ONLY_FALLBACK,
  DISABLED_TENANT_STATUSES,
  LAPSED_STATUSES,
  READ_ONLY_STATUSES,
};
