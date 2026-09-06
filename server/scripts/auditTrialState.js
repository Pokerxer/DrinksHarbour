/**
 * Who goes read-only the moment the entitlement write-gate deploys, and who is
 * on a permanently free trial.
 *
 * WHY THIS EXISTS. `assertWritesAllowed` (middleware/tenant.middleware.js) is
 * retroactive: it does not look at when a tenant was created, only at what
 * `resolveEntitlements` says about them right now. Two populations therefore
 * change behaviour on deploy day, and neither is visible from the code:
 *
 *   1. `trialing` with `trialEndsAt` already in the past. Previously
 *      unrestricted, now READ-ONLY across the whole admin. README §4 always
 *      said this; nothing enforced it, so nobody has been holding the data to
 *      the rule.
 *   2. `trialing` with NO `trialEndsAt` — the old default for anything not
 *      created through the public vendor form. `resolveEntitlements` reads a
 *      missing date as "never expires", so these stay writable and permanently
 *      free. The pre-save hook (`applyTrialWindow`) only stamps NEW documents,
 *      so they stay that way until backfilled.
 *
 * Deciding what to do about (1) is a COMMERCIAL call — grandfather them or let
 * them degrade — so this script defaults to writing nothing and printing the
 * counts. Put those numbers in front of whoever owns the decision, record it in
 * server/config/README-plan-entitlements.md §4a, and only then run a write mode.
 *
 * Usage:
 *   node scripts/auditTrialState.js                         # report only (default)
 *   node scripts/auditTrialState.js --json                  # same, machine-readable
 *   node scripts/auditTrialState.js --all                   # list every tenant, not just the affected
 *
 *   node scripts/auditTrialState.js --backfill-open-ended             # plan the backfill, write nothing
 *   node scripts/auditTrialState.js --backfill-open-ended --apply     # stamp trialEndsAt
 *
 *   node scripts/auditTrialState.js --grandfather-elapsed=30          # plan it, write nothing
 *   node scripts/auditTrialState.js --grandfather-elapsed=30 --apply  # push trialEndsAt out 30 days
 *
 *   node scripts/auditTrialState.js --convert-comped-to-trial          # plan it, write nothing
 *   node scripts/auditTrialState.js --convert-comped-to-trial --apply  # active+free_trial → trialing
 *
 * NOTHING IS WRITTEN WITHOUT `--apply`. The write modes are mutually exclusive
 * with each other so one invocation cannot both extend and stamp.
 *
 * The read-only verdict comes from `resolveEntitlements` itself rather than a
 * reimplementation of the rules, so this report cannot drift from the gate it
 * is predicting.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const mongoose = require('mongoose');

const Tenant = require('../models/Tenant');
const { resolveEntitlements } = require('../services/entitlements.service');
const { TRIAL_DAYS } = require('../config/erm-plans');

const argOf = (name) =>
  (process.argv.find((a) => a.startsWith(`--${name}=`)) || '').split('=')[1] || '';

const AS_JSON = process.argv.includes('--json');
const SHOW_ALL = process.argv.includes('--all');
const APPLY = process.argv.includes('--apply');
const BACKFILL_OPEN_ENDED = process.argv.includes('--backfill-open-ended');
const CONVERT_COMPED = process.argv.includes('--convert-comped-to-trial');
const GRANDFATHER_DAYS = Number(argOf('grandfather-elapsed') || 0);

const DAY_MS = 24 * 60 * 60 * 1000;

const fmtDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '—');

/**
 * Which population a tenant is in. Ordered most-specific first: a suspended
 * tenant is already switched off, so its trial dates are beside the point.
 */
function classify(tenant, now) {
  if (['suspended', 'archived'].includes(tenant.status)) return 'tenant_disabled';
  if (tenant.status !== 'approved') return `onboarding_${tenant.status}`;

  const status = tenant.subscriptionStatus;
  if (['canceled', 'incomplete', 'incomplete_expired'].includes(status)) return 'lapsed';
  if (status === 'past_due') return 'past_due';

  if (status === 'trialing') {
    if (!tenant.trialEndsAt) return 'trial_open_ended';
    return new Date(tenant.trialEndsAt).getTime() <= now.getTime()
      ? 'trial_elapsed'
      : 'trial_running';
  }

  // Marked active without having been sold a plan. Writable, on the free_trial
  // capability set, and it NEVER degrades — an active subscription is never
  // trial-expired, so no date ever catches up with it. Coherent as a comped
  // tier, and indistinguishable from a paying customer in every other report,
  // which is why it gets its own population here.
  if (status === 'active' && tenant.plan === 'free_trial') return 'comped';

  return status === 'active' ? 'active' : `other_${status}`;
}

/** One line of the report. The verdict is the gate's own, not a copy of it. */
function rowFor(tenant, now) {
  const ent = resolveEntitlements(tenant, now);
  return {
    id: String(tenant._id),
    name: tenant.name,
    slug: tenant.slug,
    tenantStatus: tenant.status,
    plan: tenant.plan,
    subscriptionStatus: tenant.subscriptionStatus,
    trialEndsAt: tenant.trialEndsAt ? new Date(tenant.trialEndsAt).toISOString() : null,
    currentPeriodEnd: tenant.currentPeriodEnd
      ? new Date(tenant.currentPeriodEnd).toISOString()
      : null,
    population: classify(tenant, now),
    writesAllowed: ent.writesAllowed,
    entitlementReason: ent.reason,
    effectivePlan: ent.degraded ? 'free_trial (degraded)' : ent.plan,
  };
}

const POPULATION_NOTE = {
  trial_elapsed: 'READ-ONLY ON DEPLOY — trial end date has passed',
  trial_open_ended: 'permanently free — trialing with no trialEndsAt',
  trial_running: 'trial still running',
  past_due: 'read-only already (dunning)',
  lapsed: 'no tenant context — subscription gone',
  active: 'paying, unaffected',
  comped: 'ACTIVE BUT NEVER SOLD A PLAN — free_trial set, never degrades',
  tenant_disabled: 'switched off by admin',
};

function printReport(rows, now) {
  const byPopulation = rows.reduce((acc, r) => {
    (acc[r.population] ||= []).push(r);
    return acc;
  }, {});

  console.log(`\nTrial / subscription state — ${rows.length} tenant(s), as at ${now.toISOString()}\n`);

  console.log('Population breakdown');
  for (const [population, group] of Object.entries(byPopulation).sort()) {
    const note = POPULATION_NOTE[population] || '';
    console.log(`  ${population.padEnd(20)} ${String(group.length).padStart(4)}  ${note}`);
  }

  const readOnly = rows.filter((r) => !r.writesAllowed);
  console.log(`\n  ${String(readOnly.length).padStart(4)} tenant(s) currently resolve to writesAllowed: false`);
  console.log(`  ${String(rows.length - readOnly.length).padStart(4)} tenant(s) can still write\n`);

  // The two populations the deploy actually changes, listed by name so a human
  // can recognise them. Everything else is only listed under --all.
  const affected = SHOW_ALL
    ? rows
    : rows.filter((r) =>
        ['trial_elapsed', 'trial_open_ended', 'past_due', 'comped'].includes(r.population)
      );

  if (!affected.length) {
    console.log('No tenants in the affected populations.\n');
  } else {
    console.log(`${SHOW_ALL ? 'All tenants' : 'Affected tenants'} (${affected.length})`);
    console.log(
      `  ${'slug'.padEnd(24)} ${'plan'.padEnd(11)} ${'sub status'.padEnd(12)} ${'trialEndsAt'.padEnd(12)} ${'periodEnd'.padEnd(12)} writes  population`
    );
    for (const r of affected.sort((a, b) => a.population.localeCompare(b.population))) {
      console.log(
        `  ${String(r.slug).padEnd(24)} ${String(r.plan).padEnd(11)} ${String(r.subscriptionStatus).padEnd(12)} ` +
          `${fmtDate(r.trialEndsAt).padEnd(12)} ${fmtDate(r.currentPeriodEnd).padEnd(12)} ` +
          `${(r.writesAllowed ? 'yes' : 'NO').padEnd(6)}  ${r.population}`
      );
    }
    console.log('');
  }

  const elapsed = byPopulation.trial_elapsed || [];
  const openEnded = byPopulation.trial_open_ended || [];

  console.log('The decision to record in README-plan-entitlements.md §4a:');
  console.log(
    `  ${elapsed.length} tenant(s) go read-only on deploy. Grandfather them ` +
      `(--grandfather-elapsed=<days>) or let them degrade and notify first.`
  );
  console.log(
    `  ${openEnded.length} tenant(s) are on a permanently free trial. ` +
      `--backfill-open-ended stamps trialEndsAt (+${TRIAL_DAYS}d from now unless --grandfather-elapsed says otherwise).\n`
  );
}

async function backfillOpenEnded(rows, now) {
  const targets = rows.filter((r) => r.population === 'trial_open_ended');
  const endsAt = new Date(now.getTime() + TRIAL_DAYS * DAY_MS);

  console.log(
    `\nBackfill trialEndsAt → ${endsAt.toISOString()} on ${targets.length} open-ended trialing tenant(s).`
  );
  targets.forEach((r) => console.log(`  ${r.slug} (${r.plan})`));

  if (!APPLY) {
    console.log('\nNothing written. Re-run with --apply to write.\n');
    return;
  }

  // Re-matched on the same condition rather than by id, so a tenant that
  // acquired a date between the read and the write is not overwritten.
  const result = await Tenant.updateMany(
    {
      _id: { $in: targets.map((r) => r.id) },
      subscriptionStatus: 'trialing',
      trialEndsAt: { $in: [null, undefined] },
    },
    { $set: { trialEndsAt: endsAt } }
  );
  console.log(`\nWrote ${result.modifiedCount} document(s).\n`);
}

async function grandfatherElapsed(rows, now) {
  const targets = rows.filter((r) => r.population === 'trial_elapsed');
  const endsAt = new Date(now.getTime() + GRANDFATHER_DAYS * DAY_MS);

  console.log(
    `\nGrandfather: push trialEndsAt → ${endsAt.toISOString()} (+${GRANDFATHER_DAYS}d) ` +
      `on ${targets.length} elapsed-trial tenant(s).`
  );
  targets.forEach((r) => console.log(`  ${r.slug} (${r.plan}, was ${fmtDate(r.trialEndsAt)})`));

  if (!APPLY) {
    console.log('\nNothing written. Re-run with --apply to write.\n');
    return;
  }

  const result = await Tenant.updateMany(
    {
      _id: { $in: targets.map((r) => r.id) },
      subscriptionStatus: 'trialing',
      trialEndsAt: { $lte: now },
    },
    { $set: { trialEndsAt: endsAt } }
  );
  console.log(`\nWrote ${result.modifiedCount} document(s).\n`);
}

/**
 * Put a comped tenant onto the normal trial lifecycle.
 *
 * `active` + `plan: free_trial` is writable forever: `resolveEntitlements` only
 * expires a trial for a tenant whose `subscriptionStatus` is `trialing`, so no
 * date ever catches up with an `active` one. Moving them to `trialing` with a
 * real `trialEndsAt` makes them follow the same path as everybody else — and
 * makes them visible to the trial-ending email, which cannot see an `active`
 * tenant at all.
 *
 * This DOES eventually take their writes away, which is the point and is also
 * why it is a separate, explicit, --apply-guarded mode rather than something
 * the report does on its own.
 */
async function convertCompedToTrial(rows, now) {
  const targets = rows.filter((r) => r.population === 'comped');
  const endsAt = new Date(now.getTime() + TRIAL_DAYS * DAY_MS);

  console.log(
    `\nConvert comped → trialing, trialEndsAt ${endsAt.toISOString()} (+${TRIAL_DAYS}d), ` +
      `on ${targets.length} tenant(s).`
  );
  targets.forEach((r) =>
    console.log(`  ${r.slug} (${r.plan}, ${r.subscriptionStatus} → trialing)`)
  );

  if (!targets.length) {
    console.log('  Nothing to convert.\n');
    return;
  }
  if (!APPLY) {
    console.log('\nNothing written. Re-run with --apply to write.\n');
    return;
  }

  // Re-matched on the same condition rather than by id alone, so a tenant who
  // was sold a plan between the read and the write is not dragged back onto a
  // trial. Same reasoning as backfillOpenEnded.
  const result = await Tenant.updateMany(
    {
      _id: { $in: targets.map((r) => r.id) },
      subscriptionStatus: 'active',
      plan: 'free_trial',
    },
    { $set: { subscriptionStatus: 'trialing', trialEndsAt: endsAt } }
  );
  console.log(`\nWrote ${result.modifiedCount} document(s).\n`);
}

async function main() {
  const MODES = [BACKFILL_OPEN_ENDED, GRANDFATHER_DAYS > 0, CONVERT_COMPED].filter(Boolean);
  if (MODES.length > 1) {
    throw new Error(
      'Pass ONE write mode per run: --backfill-open-ended, --grandfather-elapsed=<days> or --convert-comped-to-trial. They target different populations.'
    );
  }
  if (BACKFILL_OPEN_ENDED && GRANDFATHER_DAYS > 0) {
    throw new Error(
      'Pass --backfill-open-ended OR --grandfather-elapsed=<days>, not both: they target different populations and one run should do one thing.'
    );
  }
  if (argOf('grandfather-elapsed') && !(GRANDFATHER_DAYS > 0)) {
    throw new Error('--grandfather-elapsed must be a positive number of days.');
  }

  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    throw new Error('No MONGODB_URI in environment. Aborting.');
  }

  await mongoose.connect(uri);

  const now = new Date();
  const tenants = await Tenant.find({})
    .select('_id name slug status plan customCapabilities subscriptionStatus trialEndsAt currentPeriodEnd addOns')
    .sort({ status: 1, subscriptionStatus: 1, name: 1 })
    .lean();

  const rows = tenants.map((t) => rowFor(t, now));

  if (AS_JSON) {
    console.log(JSON.stringify({ generatedAt: now.toISOString(), tenants: rows }, null, 2));
  } else {
    printReport(rows, now);
  }

  if (BACKFILL_OPEN_ENDED) await backfillOpenEnded(rows, now);
  if (GRANDFATHER_DAYS > 0) await grandfatherElapsed(rows, now);
  if (CONVERT_COMPED) await convertCompedToTrial(rows, now);

  if (!BACKFILL_OPEN_ENDED && GRANDFATHER_DAYS === 0 && !CONVERT_COMPED && !AS_JSON) {
    console.log('This run changed nothing.\n');
  }

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('auditTrialState failed:', err.message);
  try {
    await mongoose.disconnect();
  } catch {
    /* already closed */
  }
  process.exit(1);
});
