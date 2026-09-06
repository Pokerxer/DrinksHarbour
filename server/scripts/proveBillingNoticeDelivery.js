// server/scripts/proveBillingNoticeDelivery.js
//
// One-shot proof that the two subscription-notice emails actually DELIVER over
// the real SMTP transport — goal B of docs/subscription-billing-next-goals-3.md.
//
// The "done when" is: a returned real message ID, not a dev-mode log line.
// `sendEmail` returns `messageId: 'dev-mode'` when no transport could be built
// and `messageId: 'suppressed'` when the recipient is on the suppression list;
// this script FAILS on both, because neither is delivery.
//
// It sends to whatever address you pass with --to. Requiring it explicitly is
// deliberate — this is a real email to a real inbox, and the script refuses to
// guess a recipient.
//
//   node scripts/proveBillingNoticeDelivery.js --to you@example.com
//
// It exercises the real mailer but writes NOTHING to the database: both sends
// use fake tenant objects and an injected no-op `stamp`, so no tenant is marked
// notified and no `billingNotices.*` field moves. The WHO/WHEN logic
// (`shouldWarnTrialEnding`, idempotence) is already pinned by unit tests; this
// proves the transport and the templates.

require('dotenv').config();

const {
  notifyTrialEnding,
  notifyReadOnly,
} = require('../services/billingNotifications.service');

const noop = async () => {};

function args() {
  const to = process.argv[2] === '--to' ? process.argv[3] : null;
  if (!to) {
    console.error('Usage: node scripts/proveBillingNoticeDelivery.js --to <address>');
    process.exit(2);
  }
  return to;
}

async function main() {
  const to = args();
  const now = new Date();
  const endsAt = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

  // 1. Trial-ending warning — `trialing` with a trial 2 days out.
  const trialTenant = {
    _id: '000000000000000000000001',
    name: 'Delivery Proof Shop',
    slug: 'delivery-proof',
    plan: 'free_trial',
    subscriptionStatus: 'trialing',
    trialEndsAt: endsAt,
    contactEmail: to,
    billingNotices: {},
  };

  // 2. Payment-failed / read-only notice — `past_due`, which
  //    `resolveEntitlements` reads as read-only (writesAllowed: false).
  const pastDueTenant = {
    _id: '000000000000000000000002',
    name: 'Delivery Proof Shop',
    slug: 'delivery-proof',
    plan: 'starter',
    subscriptionStatus: 'past_due',
    trialEndsAt: null,
    contactEmail: to,
    billingNotices: {},
  };

  const trial = await notifyTrialEnding(trialTenant, now, { update: noop });
  const failed = await notifyReadOnly(pastDueTenant, 'payment_failed', now, { update: noop });

  let ok = true;
  console.log('\n── Trial-ending email ──');
  console.log('  result :', JSON.stringify(trial));
  if (!trial.sent || trial.reason === 'send_failed' || String(trial.messageId) === 'dev-mode') ok = false;

  console.log('\n── Payment-failed (read-only) email ──');
  console.log('  result :', JSON.stringify(failed));
  if (!failed.sent || failed.reason === 'send_failed' || String(failed.messageId) === 'dev-mode') ok = false;

  console.log('\nRecipient:', to);
  if (ok) {
    console.log('\n✅ DELIVERED — real message IDs returned (open the inbox to confirm).');
    process.exit(0);
  }
  console.log('\n❌ NOT PROVEN — the result above is a log line, not a delivery.');
  process.exit(1);
}

main().catch((err) => {
  console.error('proof failed:', err.message);
  process.exit(1);
});