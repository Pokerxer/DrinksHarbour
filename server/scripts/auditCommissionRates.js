/**
 * Is every tenant actually charged the rate their plan sells?
 *
 * WHY THIS EXISTS. Plan `commissionRate` is sold on the pricing page
 * (13/11/10/9); `syncCommission` writes it onto `Tenant.commissionPercentage`;
 * the order path spends it — but ONLY for `revenueModel: 'commission'`
 * tenants, where `platformCostPrice = baseSellingPrice × (1 − commissionPct%)`.
 * On a `markup` tenant that field is dead weight: the tenant's margin is
 * `markupPercentage` and the platform's is derived from it. Flagging the two
 * as "0% != sold 13%" was therefore a false alarm, which is exactly the kind of
 * finding this script must never ship — so it only flags the operative field.
 *
 * Sources of truth (never copied here):
 *   - expected  → `getCommissionRate(plan) * 100`  (server/config/erm-plans.js)
 *   - actual    → `Tenant.commissionPercentage ?? expected`
 *                 (the same fallback controller/erm.controller.js:95 uses)
 *   - how the two revenue models spend them →
 *                 order.controller.js calcPlatformCostPrice, Tenant schema
 *
 * This script WRITES NOTHING. The findings feed human decisions: re-sync
 * (POST /admin/sync-commission) for commission-model tenants, and the
 * commercial call on any `active` tenant with no `currentPeriodEnd` — a
 * paid-config tenant providing ₦0 in subscription revenue.
 *
 * Usage:
 *   node scripts/auditCommissionRates.js           # report only (default)
 *   node scripts/auditCommissionRates.js --all     # list every tenant, not just flagged
 *   node scripts/auditCommissionRates.js --json    # machine-readable
 */

require('dotenv').config();

const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');
const { getCommissionRate } = require('../config/erm-plans');

const JSON_OUT = process.argv.includes('--json');
const LIST_ALL = process.argv.includes('--all');

async function main() {
  const tenants = await Tenant.find({})
    .select(
      'slug name plan revenueModel subscriptionStatus currentPeriodEnd commissionPercentage markupPercentage createdAt'
    )
    .lean();

  const rows = tenants.map((t) => {
    const expectedBase = getCommissionRate(t.plan); // decimal
    const expectedPct = +(expectedBase * 100).toFixed(2);
    const actualPct = t.commissionPercentage ?? expectedPct;
    const freeActive = t.subscriptionStatus === 'active' && !t.currentPeriodEnd;
    const isCommissionModel = t.revenueModel === 'commission';
    const mismatched =
      isCommissionModel && t.plan !== 'custom' && Math.abs(actualPct - expectedPct) > 0.001;
    return { tenant: t, expectedPct, actualPct, mismatched, freeActive };
  });

  const breakdown = {};
  for (const r of rows) {
    const k = r.tenant.subscriptionStatus || 'unknown';
    breakdown[k] = (breakdown[k] || 0) + 1;
  }

  const flagged = rows.filter((r) => r.mismatched || r.freeActive);
  const shown = LIST_ALL ? rows : flagged;

  if (JSON_OUT) {
    console.log(
      JSON.stringify(
        {
          asAt: new Date().toISOString(),
          breakdown,
          flagged: rows.map((r) => ({
            slug: r.tenant.slug,
            plan: r.tenant.plan,
            status: r.tenant.subscriptionStatus,
            revenueModel: r.tenant.revenueModel,
            expectedPct: r.expectedPct,
            actualPct: r.tenant.commissionPercentage ?? null,
            markupPct: r.tenant.markupPercentage ?? null,
            mismatched: r.mismatched,
            freeActive: r.freeActive,
            hasPeriodEnd: !!r.tenant.currentPeriodEnd,
          })),
        },
        null,
        2
      )
    );
    return;
  }

  console.log(`Commission audit — ${rows.length} tenant(s), as at ${new Date().toISOString()}`);
  console.log('\nPopulation breakdown');
  for (const [k, v] of Object.entries(breakdown)) console.log(`  ${k.padEnd(12)} ${v}`);
  console.log(`\n  ${rows.length - flagged.length} tenant(s) match the plan's sold rate`);
  console.log(`  ${flagged.length} tenant(s) flagged (see below)`);

  console.log('\nFlagged / all tenants');
  for (const r of shown) {
    const t = r.tenant;
    const isCommissionModel = t.revenueModel === 'commission';
    const why = [
      r.mismatched ? `rate ${r.actualPct}% != sold ${r.expectedPct}%` : null,
      r.freeActive ? 'active but NO currentPeriodEnd → free' : null,
    ]
      .filter(Boolean)
      .join('; ');
    console.log(
      `  ${t.slug.padEnd(22)} ${(t.plan || '?').padEnd(12)} ${(t.subscriptionStatus || '?').padEnd(9)} ` +
        `${(t.revenueModel || '?').padEnd(10)}` +
        (isCommissionModel
          ? `commission ${t.commissionPercentage ?? '(unset→expected)'}% vs sold ${r.expectedPct}%`
          : `markup ${t.markupPercentage ?? '?'}% (commission field unused)` +
            (t.commissionPercentage != null ? `; commission% set to ${t.commissionPercentage}` : '')) +
        (why ? `   ← ${why}` : '')
    );
  }

  if (rows.some((r) => r.freeActive)) {
    console.log('\nFree `active` tenants (no subscription period): a paid-setting tenant');
    console.log('providing ₦0 in subscription revenue. Decide and record it in README');
    console.log('§4a — do not fix it by syncing commissions.');
  }
  if (rows.some((r) => r.mismatched)) {
    console.log('\nCommission-model mismatches are either stale (fix: POST /admin/sync-commission)');
    console.log('or a deliberate override. Choose per tenant — do not blanket-sync.');
  }
}

mongoose
  .connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 })
  .then(main)
  .then(() => mongoose.disconnect())
  .catch((err) => {
    console.error('audit failed:', err.message);
    process.exit(1);
  });