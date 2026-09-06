/**
 * Is subscription billing actually configured in THIS environment?
 *
 * WHY THIS EXISTS. Every ERM billing failure mode so far has been a missing
 * environment variable rather than a bug, and each one failed silently on the
 * surface that mattered:
 *
 *   - `PAYSTACK_PLAN_EXTRA_SHOP` / `PAYSTACK_PLAN_EXTRA_WAREHOUSE` are new.
 *     Without them `POST /api/erm/add-ons` throws "No Paystack plan code
 *     configured". That refusal is deliberate — granting a free slot would be
 *     worse — but it means the add-ons the pricing page sells cannot be bought.
 *   - Without `PAYSTACK_SECRET_KEY`, `verifyPaystackSignature` refuses outright
 *     (an HMAC keyed on `undefined` is reproducible by anyone), so EVERY
 *     webhook 400s and subscription state silently stops moving. There is
 *     precedent: the Korapay `redirect_url` outage was one unset prod env var
 *     on this same surface.
 *
 * Run it wherever the API runs — the point is to check the environment the
 * server will actually read, not this laptop. Reports and writes nothing.
 *
 * Usage:
 *   node scripts/checkErmBillingConfig.js                  # local env only
 *   node scripts/checkErmBillingConfig.js --verify-remote  # ALSO ask Paystack whether the plan codes exist
 *
 * `--verify-remote` makes an outward, read-only call to the Paystack API with
 * PAYSTACK_SECRET_KEY. It is opt-in for that reason.
 *
 * WHAT THIS CANNOT CHECK. Paystack exposes no API for reading the webhook URL
 * configured on an integration, so "is /api/erm/webhook registered in the
 * dashboard?" has to be confirmed by eye at
 * https://dashboard.paystack.com/#/settings/developers. Nothing in this repo,
 * and no call this script can make, can answer it.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });

const { ERM_PLANS, ADD_ONS, PLAN_ORDER } = require('../config/erm-plans');

const VERIFY_REMOTE = process.argv.includes('--verify-remote');

/** Every env var a subscription or add-on purchase reads, and what breaks. */
const REQUIRED = [
  ...PLAN_ORDER.filter((key) => ERM_PLANS[key].priceMonthly > 0).map((key) => ({
    env: `PAYSTACK_PLAN_${key.toUpperCase()}`,
    label: `${ERM_PLANS[key].label} plan`,
    price: ERM_PLANS[key].priceMonthly,
    breaks: `POST /api/erm/subscribe with planKey="${key}"`,
  })),
  ...Object.entries(ADD_ONS).map(([type, cfg]) => ({
    env: `PAYSTACK_PLAN_${type.toUpperCase()}`,
    label: cfg.label,
    price: cfg.priceMonthly,
    breaks: `POST /api/erm/add-ons with addOnType="${type}"`,
  })),
];

const naira = (n) => `₦${Number(n).toLocaleString('en-NG')}`;

async function fetchPaystackPlans(secret) {
  const res = await fetch('https://api.paystack.co/plan?perPage=100', {
    headers: { Authorization: `Bearer ${secret}` },
  });
  if (!res.ok) {
    throw new Error(`Paystack responded ${res.status} ${res.statusText}`);
  }
  const body = await res.json();
  if (!body.status) throw new Error(body.message || 'Paystack returned status:false');
  return body.data || [];
}

async function main() {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  const mode = !secret
    ? 'MISSING'
    : secret.startsWith('sk_live')
      ? 'live'
      : secret.startsWith('sk_test')
        ? 'test'
        : 'unrecognised prefix';

  console.log(`\nERM billing configuration — NODE_ENV=${process.env.NODE_ENV || '(unset)'}\n`);

  console.log(`  PAYSTACK_SECRET_KEY                ${mode === 'MISSING' ? 'NOT SET' : `set (${mode} key)`}`);
  if (mode === 'MISSING') {
    console.log('    → every webhook 400s; subscription state never updates.');
  } else if (mode === 'test') {
    console.log('    → TEST key. Fine for a dev box; on the production backend this bills nobody.');
  }
  console.log('');

  const missing = [];
  console.log('  Plan codes');
  for (const item of REQUIRED) {
    const value = process.env[item.env];
    if (!value) missing.push(item);
    console.log(
      `    ${item.env.padEnd(34)} ${(value ? `set (${value})` : 'NOT SET').padEnd(28)} ${item.label} ${naira(item.price)}/mo`
    );
  }
  console.log('');

  if (missing.length) {
    console.log(`  ${missing.length} plan code(s) unset. What each one breaks:`);
    missing.forEach((m) => console.log(`    ${m.env.padEnd(34)} ${m.breaks}`));
    console.log(
      '\n    These are Paystack PLANS and must be created in the dashboard first\n' +
        '    (https://dashboard.paystack.com/#/plans), then their plan codes copied here.\n'
    );
  } else {
    console.log('  All plan codes are set.\n');
  }

  if (VERIFY_REMOTE) {
    if (!secret) {
      console.log('  --verify-remote skipped: no PAYSTACK_SECRET_KEY to authenticate with.\n');
    } else {
      console.log(`  Verifying the configured codes against the Paystack ${mode} account…`);
      try {
        const remote = await fetchPaystackPlans(secret);
        const byCode = new Map(remote.map((p) => [p.plan_code, p]));
        for (const item of REQUIRED) {
          const code = process.env[item.env];
          if (!code) continue;
          const plan = byCode.get(code);
          if (!plan) {
            console.log(`    ${item.env.padEnd(34)} NOT FOUND on this Paystack account`);
            continue;
          }
          // Paystack amounts are in kobo.
          const amount = plan.amount / 100;
          const mismatch = amount !== item.price ? `  ← expected ${naira(item.price)}` : '';
          console.log(
            `    ${item.env.padEnd(34)} ok — "${plan.name}" ${naira(amount)}/${plan.interval}${mismatch}`
          );
        }
      } catch (err) {
        console.log(`    Could not reach Paystack: ${err.message}`);
      }
      console.log('');
    }
  } else {
    console.log('  (Pass --verify-remote to check the codes exist on the Paystack account.)\n');
  }

  console.log('  Cannot be checked from here — confirm by eye:');
  console.log('    • /api/erm/webhook registered at dashboard.paystack.com → Settings → API Keys & Webhooks.');
  console.log('      Paystack has no API for reading it back.');
  console.log('    • That the values above are the PRODUCTION backend\'s environment, not a local .env.\n');
}

main().catch((err) => {
  console.error('checkErmBillingConfig failed:', err.message);
  process.exit(1);
});
