// A tenant should not find out they have lapsed by clicking Save.
//
// Three things this file pins:
//
//   1. WHEN a notice goes out. The trial warning must arrive BEFORE
//      `trialEndsAt`, exactly once per end date; the dunning follow-up must
//      arrive once, and only after a first notice actually went.
//
//   2. WHAT it says. Every body sentence comes from `readOnlyMessage` — the
//      same function the write gates, the admin toast and the billing page use.
//      A fourth copy of that sentence in an email template would undo the
//      single source that entitlementNotices.test.js exists to protect, so this
//      file fails if the email stops asking for it.
//
//   3. That a STAMP is only written when something was actually sent. Stamping
//      a failed send consumes the one warning the tenant was ever going to get
//      — the same class of bug as memory `order_email_prod_outage`, where
//      dev-mode sends logged "✅" while nothing left the building.

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
// Belt and braces. Nothing in this file reaches the real transport — every send
// is stubbed — but a test suite that can post to SMTP is one refactor away from
// mailing real tenants about fictitious lapses.
process.env.OUTBOUND_EMAIL = 'off';

const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');

const {
  TRIAL_WARNING_DAYS,
  PAST_DUE_FOLLOW_UP_DAYS,
  shouldWarnTrialEnding,
  shouldNoticeTrialEnded,
  shouldFollowUpPastDue,
  billingContactFor,
  notifyTrialEnding,
  notifyReadOnly,
  notifyPaymentFailed,
} = require('../services/billingNotifications.service');
const { readOnlyMessage } = require('../services/entitlements.service');
const { sweepBillingNotices } = require('../jobs/billingNotices.job');

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-09-06T12:00:00.000Z');
const TENANT_ID = new mongoose.Types.ObjectId();

const trialing = (overrides = {}) => ({
  _id: TENANT_ID,
  name: 'Wyn City',
  slug: 'wyncity',
  plan: 'growth',
  status: 'approved',
  subscriptionStatus: 'trialing',
  contactEmail: 'billing@wyncity.test',
  ...overrides,
});

// ─── 1. When ────────────────────────────────────────────────────────────────

test('the trial warning fires inside the window and not before it', () => {
  const justOutside = trialing({ trialEndsAt: new Date(NOW.getTime() + (TRIAL_WARNING_DAYS + 1) * DAY) });
  assert.strictEqual(shouldWarnTrialEnding(justOutside, NOW), false);

  const inside = trialing({ trialEndsAt: new Date(NOW.getTime() + (TRIAL_WARNING_DAYS - 1) * DAY) });
  assert.strictEqual(shouldWarnTrialEnding(inside, NOW), true);
});

test('the trial warning does not fire once the trial has already elapsed', () => {
  // "Your trial ends in -2 days" is not a warning. The trial-ENDED notice is
  // the right one from here, and shouldNoticeTrialEnded picks it up.
  const elapsed = trialing({ trialEndsAt: new Date(NOW.getTime() - 2 * DAY) });
  assert.strictEqual(shouldWarnTrialEnding(elapsed, NOW), false);
  assert.strictEqual(shouldNoticeTrialEnded(elapsed, NOW), true);
});

test('an open-ended trial produces no notice at all', () => {
  // resolveEntitlements reads a missing trialEndsAt as "never expires", so
  // there is nothing to warn about and warning anyway would be a lie.
  const openEnded = trialing({ trialEndsAt: null });
  assert.strictEqual(shouldWarnTrialEnding(openEnded, NOW), false);
  assert.strictEqual(shouldNoticeTrialEnded(openEnded, NOW), false);
});

test('the trial warning is sent once per end date, and again if the date moves', () => {
  const endsAt = new Date(NOW.getTime() + 2 * DAY);
  const warned = trialing({
    trialEndsAt: endsAt,
    billingNotices: { trialEndingSentAt: NOW, trialEndingSentFor: endsAt },
  });
  assert.strictEqual(shouldWarnTrialEnding(warned, NOW), false, 'must not repeat');

  // A bare "already sent" boolean would silence this forever. Keying on WHICH
  // date was warned about means an extended trial warns again.
  const extended = { ...warned, trialEndsAt: new Date(NOW.getTime() + 3 * DAY) };
  assert.strictEqual(shouldWarnTrialEnding(extended, NOW), true, 'a new end date is a new warning');
});

test('the dunning follow-up needs a first notice, a wait, and never repeats', () => {
  const base = { _id: TENANT_ID, subscriptionStatus: 'past_due', plan: 'pro' };

  // A follow-up to an email nobody got is a first email with the wrong subject.
  assert.strictEqual(shouldFollowUpPastDue({ ...base, billingNotices: {} }, NOW), false);

  const tooSoon = {
    ...base,
    billingNotices: { pastDueSentAt: new Date(NOW.getTime() - (PAST_DUE_FOLLOW_UP_DAYS - 1) * DAY) },
  };
  assert.strictEqual(shouldFollowUpPastDue(tooSoon, NOW), false);

  const due = {
    ...base,
    billingNotices: { pastDueSentAt: new Date(NOW.getTime() - PAST_DUE_FOLLOW_UP_DAYS * DAY) },
  };
  assert.strictEqual(shouldFollowUpPastDue(due, NOW), true);

  const alreadyFollowedUp = {
    ...due,
    billingNotices: { ...due.billingNotices, pastDueFollowUpSentAt: NOW },
  };
  assert.strictEqual(shouldFollowUpPastDue(alreadyFollowedUp, NOW), false, 'twice is enough');
});

test('an active tenant is never a candidate for any of the three notices', () => {
  const healthy = trialing({ subscriptionStatus: 'active', trialEndsAt: new Date(NOW.getTime() + DAY) });
  assert.strictEqual(shouldWarnTrialEnding(healthy, NOW), false);
  assert.strictEqual(shouldNoticeTrialEnded(healthy, NOW), false);
  assert.strictEqual(shouldFollowUpPastDue(healthy, NOW), false);
});

// ─── 2. What it says ────────────────────────────────────────────────────────

test('the read-only email body is the server\'s readOnlyMessage, not its own copy', async () => {
  const sent = [];
  const tenant = {
    _id: TENANT_ID,
    name: 'Wyn City',
    plan: 'pro',
    status: 'approved',
    subscriptionStatus: 'past_due',
    contactEmail: 'billing@wyncity.test',
  };

  const result = await notifyReadOnly(tenant, 'payment_failed', NOW, {
    sendReadOnlyNoticeEmail: async (args) => { sent.push(args); return { success: true }; },
    update: async () => {},
  });

  assert.strictEqual(result.sent, true);
  assert.strictEqual(sent.length, 1);
  assert.strictEqual(sent[0].message, readOnlyMessage('subscription_past_due'));
  assert.strictEqual(sent[0].variant, 'payment_failed');
});

test('an elapsed trial gets the trial wording from the same one function', async () => {
  const sent = [];
  const tenant = {
    _id: TENANT_ID,
    plan: 'growth',
    status: 'approved',
    subscriptionStatus: 'trialing',
    trialEndsAt: new Date(NOW.getTime() - DAY),
    contactEmail: 'billing@wyncity.test',
  };

  await notifyReadOnly(tenant, 'trial_ended', NOW, {
    sendReadOnlyNoticeEmail: async (args) => { sent.push(args); return { success: true }; },
    update: async () => {},
  });

  assert.strictEqual(sent[0].message, readOnlyMessage('trial_expired'));
});

test('a tenant whose writes are fine is never told they are read-only', async () => {
  // Defence in depth behind every caller: if the resolver disagrees with the
  // caller, the resolver wins. Sending this to a paying tenant is worse than
  // sending nothing.
  const sent = [];
  const healthy = { _id: TENANT_ID, plan: 'pro', status: 'approved', subscriptionStatus: 'active', contactEmail: 'a@b.test' };

  const result = await notifyReadOnly(healthy, 'payment_failed', NOW, {
    sendReadOnlyNoticeEmail: async (args) => { sent.push(args); return { success: true }; },
    update: async () => {},
  });

  assert.strictEqual(result.sent, false);
  assert.strictEqual(result.reason, 'writes_allowed');
  assert.deepStrictEqual(sent, []);
});

// ─── 3. Stamps ──────────────────────────────────────────────────────────────

test('a failed send is not stamped as sent', async () => {
  const stamps = [];
  const tenant = trialing({ trialEndsAt: new Date(NOW.getTime() + DAY) });

  const result = await notifyTrialEnding(tenant, NOW, {
    sendTrialEndingEmail: async () => ({ success: false, error: 'SMTP 535' }),
    update: async (_id, patch) => { stamps.push(patch); },
  });

  assert.strictEqual(result.sent, false);
  assert.deepStrictEqual(stamps, [], 'stamping a failed send consumes the only warning');
});

test('a successful send stamps the end date it was about', async () => {
  const stamps = [];
  const endsAt = new Date(NOW.getTime() + DAY);
  const tenant = trialing({ trialEndsAt: endsAt });

  const result = await notifyTrialEnding(tenant, NOW, {
    sendTrialEndingEmail: async () => ({ success: true }),
    update: async (_id, patch) => { stamps.push(patch); },
  });

  assert.strictEqual(result.sent, true);
  assert.strictEqual(result.daysLeft, 1);
  assert.strictEqual(stamps[0]['billingNotices.trialEndingSentFor'], endsAt);
});

test('no contact address is a failure, not a silent success', async () => {
  const stamps = [];
  const tenant = trialing({ contactEmail: null, trialEndsAt: new Date(NOW.getTime() + DAY) });

  const result = await notifyTrialEnding(tenant, NOW, {
    findOwner: async () => null,        // no owner user either
    sendTrialEndingEmail: async () => ({ success: true }),
    update: async (_id, patch) => { stamps.push(patch); },
  });

  assert.strictEqual(result.sent, false);
  assert.strictEqual(result.reason, 'no_contact');
  assert.deepStrictEqual(stamps, []);
});

test('the contact falls back to the owner when the tenant has no contactEmail', async () => {
  // Tenants created from the platform admin form or a seed script have none;
  // dropping the notice for them would be silent.
  const withContact = await billingContactFor(trialing(), {});
  assert.strictEqual(withContact, 'billing@wyncity.test');

  const without = await billingContactFor(trialing({ contactEmail: null }), {
    findOwner: async () => ({ email: 'owner@wyncity.test' }),
  });
  assert.strictEqual(without, 'owner@wyncity.test');
});

test('notifyPaymentFailed does not send twice in one dunning cycle', async () => {
  const sent = [];
  const alreadyTold = {
    _id: TENANT_ID,
    plan: 'pro',
    status: 'approved',
    subscriptionStatus: 'past_due',
    contactEmail: 'billing@wyncity.test',
    billingNotices: { pastDueSentAt: new Date(NOW.getTime() - DAY) },
  };

  const result = await notifyPaymentFailed(alreadyTold, NOW, {
    sendReadOnlyNoticeEmail: async (args) => { sent.push(args); return { success: true }; },
    update: async () => {},
  });

  assert.strictEqual(result.sent, false);
  assert.strictEqual(result.reason, 'already_sent');
  assert.deepStrictEqual(sent, []);
});

// ─── The sweep ──────────────────────────────────────────────────────────────

test('the sweep sends at most one notice per tenant per run', async () => {
  // A tenant whose trial is both inside the warning window and elapsed is not
  // possible, but a tenant matching two rules by accident must not get two
  // emails in one night.
  const tenants = [
    trialing({ _id: new mongoose.Types.ObjectId(), trialEndsAt: new Date(NOW.getTime() + DAY) }),
    trialing({ _id: new mongoose.Types.ObjectId(), trialEndsAt: new Date(NOW.getTime() - DAY) }),
    {
      _id: new mongoose.Types.ObjectId(),
      plan: 'pro',
      status: 'approved',
      subscriptionStatus: 'past_due',
      contactEmail: 'x@y.test',
      billingNotices: { pastDueSentAt: new Date(NOW.getTime() - PAST_DUE_FOLLOW_UP_DAYS * DAY) },
    },
    // Healthy: in the list because it is trialing, but far from the window.
    trialing({ _id: new mongoose.Types.ObjectId(), trialEndsAt: new Date(NOW.getTime() + 30 * DAY) }),
  ];

  const calls = [];
  const result = await sweepBillingNotices(NOW, {
    findTenants: async () => tenants,
    warn: async (t) => { calls.push(['warn', String(t._id)]); return { sent: true }; },
    notice: async (t, variant) => { calls.push([variant, String(t._id)]); return { sent: true }; },
  });

  assert.strictEqual(result.scanned, 4);
  assert.strictEqual(result.trialEnding, 1);
  assert.strictEqual(result.trialEnded, 1);
  assert.strictEqual(result.followUp, 1);
  assert.strictEqual(result.failed, 0);
  assert.strictEqual(calls.length, 3, 'the healthy tenant gets nothing');
});

test('one tenant failing does not stop the sweep', async () => {
  const tenants = [
    trialing({ _id: new mongoose.Types.ObjectId(), trialEndsAt: new Date(NOW.getTime() + DAY) }),
    trialing({ _id: new mongoose.Types.ObjectId(), trialEndsAt: new Date(NOW.getTime() + DAY) }),
  ];
  let n = 0;
  const result = await sweepBillingNotices(NOW, {
    findTenants: async () => tenants,
    warn: async () => {
      n += 1;
      if (n === 1) throw new Error('bad address');
      return { sent: true };
    },
  });

  assert.strictEqual(result.failed, 1);
  assert.strictEqual(result.trialEnding, 1, 'the second tenant still gets theirs');
});
