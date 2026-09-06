// server/jobs/billingNotices.job.js
//
// Daily sweep for the two subscription notices that have no webhook to hang on:
// a trial about to end, and a tenant who has been `past_due` for a few days.
//
// The third notice — the first "your payment failed" — is sent from the webhook
// itself (services/erm.service.js), because that is the moment it happens.
//
// Nothing here decides copy or eligibility; both live in
// services/billingNotifications.service.js, where they are pure and tested.
// This file is the clock.

const cron = require('node-cron');
const Tenant = require('../models/Tenant');
const {
  shouldWarnTrialEnding,
  shouldNoticeTrialEnded,
  shouldFollowUpPastDue,
  notifyTrialEnding,
  notifyReadOnly,
  TRIAL_WARNING_DAYS,
  PAST_DUE_FOLLOW_UP_DAYS,
} = require('../services/billingNotifications.service');

/**
 * Walk the tenants who could plausibly need a notice and send the ones that do.
 *
 * The query is deliberately narrow — only `trialing` and `past_due` tenants can
 * produce any of these three notices — but the DECISION is not made in the
 * query. `shouldWarnTrialEnding` and friends are the rule; a `$lt` on
 * `trialEndsAt` here would be a second copy of it, and the two would drift.
 *
 * Deps injected for testing: { findTenants, warn, notice }.
 */
async function sweepBillingNotices(now = new Date(), deps = {}) {
  const findTenants =
    deps.findTenants ||
    (() =>
      Tenant.find({ subscriptionStatus: { $in: ['trialing', 'past_due'] } })
        .select(
          '_id name slug plan status subscriptionStatus trialEndsAt contactEmail billingNotices customCapabilities'
        )
        .lean());
  const warn = deps.warn || notifyTrialEnding;
  const notice = deps.notice || notifyReadOnly;

  const tenants = await findTenants();
  const result = { scanned: tenants.length, trialEnding: 0, trialEnded: 0, followUp: 0, failed: 0 };

  for (const tenant of tenants) {
    try {
      if (shouldWarnTrialEnding(tenant, now)) {
        const r = await warn(tenant, now, deps);
        r.sent ? result.trialEnding++ : result.failed++;
        continue;
      }
      if (shouldNoticeTrialEnded(tenant, now)) {
        const r = await notice(tenant, 'trial_ended', now, deps);
        r.sent ? result.trialEnded++ : result.failed++;
        continue;
      }
      if (shouldFollowUpPastDue(tenant, now)) {
        const r = await notice(tenant, 'still_read_only', now, deps);
        r.sent ? result.followUp++ : result.failed++;
      }
    } catch (err) {
      // One tenant's bad address must not stop the sweep for everyone else.
      result.failed++;
      console.error(`billing notice failed for tenant ${tenant._id}: ${err.message}`);
    }
  }

  return result;
}

/** Start the daily cron (guarded by the caller). Runs at 09:00, a civil hour. */
function startBillingNoticesCron() {
  cron.schedule('0 9 * * *', () => {
    sweepBillingNotices()
      .then((r) => {
        if (r.trialEnding || r.trialEnded || r.followUp || r.failed) {
          console.log(
            `📬 billing notices: ${r.trialEnding} trial-ending, ${r.trialEnded} trial-ended, ` +
              `${r.followUp} follow-up, ${r.failed} failed (of ${r.scanned} scanned)`
          );
        }
      })
      .catch((e) => console.error('billing notices cron error:', e.message));
  });
  console.log(
    `📬 Billing notices scheduled (daily 09:00 — warn ${TRIAL_WARNING_DAYS}d before trial end, ` +
      `follow up ${PAST_DUE_FOLLOW_UP_DAYS}d into dunning)`
  );
}

module.exports = { sweepBillingNotices, startBillingNoticesCron };
