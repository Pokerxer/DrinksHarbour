'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// Telling a tenant about their subscription BEFORE they find out by clicking
// Save.
//
// The read-only state (README §4) is deliberately survivable: a lapsed tenant
// keeps their shop open and can still read their own books. But nothing emailed
// anybody, so the way a tenant learned they had lapsed was a save that failed.
// `TRIAL_DAYS` is 14 and a trial expired at whatever second `trialEndsAt`
// passed; `invoice.payment_failed` wrote `past_due` and told nobody.
//
// THREE NOTICES, and no others:
//   1. trial ending      — sent BEFORE `trialEndsAt`, so there is time to act.
//   2. trial ended       — sent once, when it has actually lapsed.
//   3. payment failed    — sent on the webhook, then once more if still
//                          `past_due` some days later.
//
// THE COPY IS NOT WRITTEN HERE. Every body sentence comes from `readOnlyMessage`
// in entitlements.service.js — the same string the write gates put in their
// 403, the admin toast shows, and the billing page prints. It exists because
// that sentence had already been written out three times and drifted apart; a
// fourth copy in an email would undo it. This module decides WHO and WHEN, not
// WHAT.
//
// AN ADD-ON'S FAILED INVOICE MUST NOT SEND ANY OF THIS. `handleWebhookEvent`
// already branches add-on events away from tenant events before it would reach
// `notifyPaymentFailed` — for exactly the same reason it does not set
// `past_due`: one lapsed extra warehouse is not a lapsed account, and telling a
// paying tenant their account is read-only when it is not is worse than saying
// nothing.
// ─────────────────────────────────────────────────────────────────────────────

const Tenant = require('../models/Tenant');
const User = require('../models/User');
const { getPlanConfig } = require('../config/erm-plans');
const { resolveEntitlements, readOnlyMessage } = require('./entitlements.service');
const emailService = require('./email.service');

/** How many days before `trialEndsAt` the warning goes out. */
const TRIAL_WARNING_DAYS = 3;

/** How long a tenant stays `past_due` before the one follow-up is sent. */
const PAST_DUE_FOLLOW_UP_DAYS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

function daysBetween(from, to) {
  return (new Date(to).getTime() - new Date(from).getTime()) / DAY_MS;
}

function sameInstant(a, b) {
  if (!a || !b) return false;
  return new Date(a).getTime() === new Date(b).getTime();
}

// ── Decisions ───────────────────────────────────────────────────────────────
// Pure, and exported, so the rules can be tested without a database or a mail
// transport. Everything below them is plumbing.

/**
 * Should this tenant get the "your trial ends soon" warning now?
 *
 * Only while the trial is still running: once it has elapsed the warning is
 * false ("ends in -2 days") and the trial-ENDED notice is the right one.
 *
 * Idempotent on `trialEndingSentFor`, which records WHICH end date was warned
 * about. A plain boolean would silence it forever, so a tenant whose trial is
 * extended would never hear again.
 */
function shouldWarnTrialEnding(tenant, now = new Date(), windowDays = TRIAL_WARNING_DAYS) {
  if (!tenant || tenant.subscriptionStatus !== 'trialing') return false;
  if (!tenant.trialEndsAt) return false;

  const remaining = daysBetween(now, tenant.trialEndsAt);
  if (remaining <= 0) return false;          // already lapsed — notice 2, not 1
  if (remaining > windowDays) return false;  // too early to be useful

  return !sameInstant(tenant.billingNotices?.trialEndingSentFor, tenant.trialEndsAt);
}

/**
 * Should this tenant get the "your trial has ended" notice now?
 *
 * Keyed on the same `trialEndingSentFor`-style question but stamped through
 * `pastDueSentAt`, because from here on it is the same read-only state the
 * dunning notices describe and a tenant should not get two emails about it.
 */
function shouldNoticeTrialEnded(tenant, now = new Date()) {
  if (!tenant || tenant.subscriptionStatus !== 'trialing') return false;
  if (!tenant.trialEndsAt) return false;
  if (daysBetween(now, tenant.trialEndsAt) > 0) return false;   // not yet
  return !tenant.billingNotices?.pastDueSentAt;
}

/**
 * Should the one follow-up reminder go out?
 *
 * Requires that the first notice actually went (`pastDueSentAt`): a follow-up
 * to an email nobody got is just a first email with the wrong subject line.
 * Sent at most once — after that the tenant has been told twice and a third is
 * a reason to filter the sender, not a reason to pay.
 */
function shouldFollowUpPastDue(tenant, now = new Date(), afterDays = PAST_DUE_FOLLOW_UP_DAYS) {
  if (!tenant || tenant.subscriptionStatus !== 'past_due') return false;
  const notices = tenant.billingNotices || {};
  if (!notices.pastDueSentAt) return false;
  if (notices.pastDueFollowUpSentAt) return false;
  return daysBetween(notices.pastDueSentAt, now) >= afterDays;
}

// ── Recipient ───────────────────────────────────────────────────────────────

/**
 * Where a billing notice goes.
 *
 * `contactEmail` is the address the tenant gave on their application and is the
 * right one when it is set. It is not always set — tenants created from the
 * platform admin form or a seed script have none — so fall back to the owner's
 * login address rather than dropping the notice.
 *
 * Returns null when there is nowhere to send, and the callers treat that as a
 * FAILURE rather than a silent success, so the tenant is not stamped as
 * notified when nothing left the building.
 */
async function billingContactFor(tenant, deps = {}) {
  if (tenant?.contactEmail) return tenant.contactEmail;

  const findOwner =
    deps.findOwner ||
    ((tenantId) =>
      User.findOne({ tenant: tenantId, role: 'tenant_owner', status: { $ne: 'deleted' } })
        .select('email')
        .lean());

  const owner = await findOwner(tenant?._id);
  return owner?.email || null;
}

// ── Sends ───────────────────────────────────────────────────────────────────

/** Record what we told them. Never throws the send away on a write failure. */
async function stamp(tenantId, patch, deps = {}) {
  const update = deps.update || ((id, $set) => Tenant.findByIdAndUpdate(id, { $set }));
  const prefixed = {};
  for (const [k, v] of Object.entries(patch)) prefixed[`billingNotices.${k}`] = v;
  await update(tenantId, prefixed);
}

/**
 * Send the trial-ending warning. Assumes the decision has been made — the
 * sweep asks `shouldWarnTrialEnding` first.
 */
async function notifyTrialEnding(tenant, now = new Date(), deps = {}) {
  const send = deps.sendTrialEndingEmail || emailService.sendTrialEndingEmail;
  const to = await billingContactFor(tenant, deps);
  if (!to) return { sent: false, reason: 'no_contact' };

  const daysLeft = Math.max(0, Math.ceil(daysBetween(now, tenant.trialEndsAt)));
  const result = await send({
    to,
    shopName: tenant.name || tenant.slug,
    daysLeft,
    endsAt: tenant.trialEndsAt,
    planLabel: getPlanConfig(tenant.plan).label,
  });

  // Only stamp on a real send. A transport failure that stamped anyway would
  // consume the one warning this tenant was ever going to get.
  if (!result?.success) return { sent: false, reason: result?.error || 'send_failed' };

  await stamp(
    tenant._id,
    { trialEndingSentAt: now, trialEndingSentFor: tenant.trialEndsAt },
    deps
  );
  return { sent: true, to, daysLeft };
}

/**
 * Send a read-only notice — trial ended, payment failed, or the follow-up.
 *
 * `variant` picks the subject and the one framing line. The explanation is
 * always `readOnlyMessage(resolveEntitlements(tenant).reason)`, so this email
 * says exactly what the 403 and the banner say.
 */
async function notifyReadOnly(tenant, variant, now = new Date(), deps = {}) {
  const send = deps.sendReadOnlyNoticeEmail || emailService.sendReadOnlyNoticeEmail;
  const to = await billingContactFor(tenant, deps);
  if (!to) return { sent: false, reason: 'no_contact' };

  const entitlements = resolveEntitlements(tenant, now);

  // Defence in depth. Every caller has already decided this tenant is
  // read-only; if the resolver disagrees, the resolver is right and we do not
  // tell a healthy tenant their account is locked.
  if (entitlements.writesAllowed) return { sent: false, reason: 'writes_allowed' };

  const notices = tenant.billingNotices || {};
  const daysPastDue = notices.pastDueSentAt
    ? Math.max(0, Math.floor(daysBetween(notices.pastDueSentAt, now)))
    : null;

  const result = await send({
    to,
    shopName: tenant.name || tenant.slug,
    message: readOnlyMessage(entitlements.reason),
    variant,
    daysPastDue,
  });
  if (!result?.success) return { sent: false, reason: result?.error || 'send_failed' };

  await stamp(
    tenant._id,
    variant === 'still_read_only' ? { pastDueFollowUpSentAt: now } : { pastDueSentAt: now },
    deps
  );
  return { sent: true, to, variant };
}

/** The webhook's hook: `invoice.payment_failed` on the BASE subscription. */
async function notifyPaymentFailed(tenant, now = new Date(), deps = {}) {
  // Already told them about this dunning cycle; the sweep sends the follow-up.
  if (tenant.billingNotices?.pastDueSentAt) return { sent: false, reason: 'already_sent' };
  return notifyReadOnly(tenant, 'payment_failed', now, deps);
}

/**
 * Forget this dunning cycle, so the NEXT one sends again.
 *
 * Called when a tenant recovers (`charge.success`, `subscription.create`).
 * Without it a tenant who lapses, pays, and lapses again months later would
 * never be told the second time — `pastDueSentAt` would still be set from the
 * first.
 */
async function clearDunningNotices(tenantId, deps = {}) {
  const update =
    deps.updateUnset ||
    ((id) =>
      Tenant.findByIdAndUpdate(id, {
        $unset: {
          'billingNotices.pastDueSentAt': '',
          'billingNotices.pastDueFollowUpSentAt': '',
        },
      }));
  await update(tenantId);
}

module.exports = {
  TRIAL_WARNING_DAYS,
  PAST_DUE_FOLLOW_UP_DAYS,
  shouldWarnTrialEnding,
  shouldNoticeTrialEnded,
  shouldFollowUpPastDue,
  billingContactFor,
  notifyTrialEnding,
  notifyReadOnly,
  notifyPaymentFailed,
  clearDunningNotices,
};
