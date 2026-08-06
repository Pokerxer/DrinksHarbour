/**
 * Migration: give pre-Phase-3 AppraisalTemplate documents their versioning identity.
 *
 * Phase 3 makes AppraisalTemplate copy-on-write versioned. Every template written
 * before Phase 3 lacks `family`, `version`, `isLatest` and `isDefault`, and `family`
 * is `required: true` with NO schema default — so reads still work, but any `.save()`
 * of such a document now fails validation. Closing that is the whole job of this
 * script.
 *
 * Why no schema default for `family`: a silently-defaulted family would hand two
 * unrelated templates the same family identity, which is exactly the corruption the
 * versioning design exists to prevent. The identity has to be assigned deliberately,
 * once, here.
 *
 * What identity: `family = row._id`, `version = row.version || 1`, `isLatest = true`.
 * That is byte-for-byte the normalisation `updateTemplate`'s fork already applies to a
 * legacy row it is about to version (see controllers/appraisalTemplate.controller.js).
 * If the two paths disagreed about which family a legacy row belongs to, a template
 * forked before this script ran would end up split between a family-less v1 and a v2
 * pointing at nothing.
 *
 * Idempotent: a template that already has a `family` is skipped entirely, so a second
 * run plans zero changes.
 *
 * Usage:
 *   node -r dotenv/config scripts/backfill-appraisal-template-versions.js            # DRY RUN (default)
 *   node -r dotenv/config scripts/backfill-appraisal-template-versions.js --apply    # actually write
 *
 * The dry run is the default on purpose. This runs against a live production Atlas
 * cluster; writing must be an explicit, deliberate act.
 */
const mongoose = require('mongoose');

const AppraisalTemplate = require('../models/AppraisalTemplate');

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
// Opt-IN to writing. Absent the flag this script only reads and prints.
const APPLY = process.argv.includes('--apply');

/**
 * Pure planner, shared with the test — no DB access, no clock, no randomness, so its
 * decisions can be proved against in-memory fixtures without touching a cluster.
 *
 * Returns `[{ _id, set }]` for every template needing backfill, and nothing else.
 *
 * Default selection: the OLDEST non-archived legacy template per tenant, which is the
 * one the pre-Phase-3 `findOne({ tenant, isArchived: false })` would have returned.
 * Preserving that keeps every existing cycle falling back to the same form it already
 * fell back to, rather than silently switching it.
 *
 * Two guards the naive version gets wrong:
 *   1. A tenant that ALREADY has a Phase-3 default (seeded by `ensureDefaultTemplate`)
 *      gets no legacy promotion at all. The `{tenant, isDefault}` index is unique and
 *      partial on `{isDefault: true, isLatest: true}`, so a second default row is an
 *      E11000 the instant the plan is applied — the migration would abort mid-way.
 *      This means the whole collection must be fed in, not just the rows needing work.
 *   2. Ties and missing `createdAt` are broken by `_id`, so the answer does not depend
 *      on the order Mongo happened to return documents in. A default chosen by input
 *      order is a default that changes between runs.
 *
 * @param {Array<object>} templates every AppraisalTemplate in the collection (lean)
 * @returns {Array<{_id: any, set: object}>}
 */
function planTemplateBackfill(templates) {
  const all = templates || [];
  const needing = all.filter((t) => !t.family);
  if (!needing.length) return [];

  // Tenants already holding a live default — legacy rows there must stay non-default.
  const tenantsWithDefault = new Set(
    all
      .filter((t) => t.isDefault === true && t.isLatest !== false)
      .map((t) => String(t.tenant))
  );

  const oldestLiveByTenant = new Map();
  for (const t of needing) {
    if (t.isArchived) continue;
    const key = String(t.tenant);
    if (tenantsWithDefault.has(key)) continue;
    const held = oldestLiveByTenant.get(key);
    const at = t.createdAt ? new Date(t.createdAt).getTime() : 0;
    const id = String(t._id);
    // `_id` is the tiebreaker, and ObjectIds are time-ordered, so equal/absent
    // timestamps still resolve to the genuinely older document.
    if (!held || at < held.at || (at === held.at && id < held.id)) {
      oldestLiveByTenant.set(key, { id, at });
    }
  }

  return needing.map((t) => ({
    _id: t._id,
    set: {
      // Its own id — unique by construction, stable, tenant-local, and obviously
      // not shared with any other template.
      family: t._id,
      version: t.version || 1,
      isLatest: true,
      isDefault: oldestLiveByTenant.get(String(t.tenant))?.id === String(t._id),
    },
  }));
}

async function main() {
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is not defined in environment variables');
  }

  await mongoose.connect(MONGODB_URI);
  try {
    const templates = await AppraisalTemplate.find({})
      .select('_id tenant name isArchived createdAt family version isLatest isDefault')
      .lean();
    const plan = planTemplateBackfill(templates);

    console.log(`${templates.length} templates, ${plan.length} need backfill`);
    for (const p of plan) {
      const row = templates.find((t) => String(t._id) === String(p._id));
      console.log(
        `  ${p._id} [${row?.name || 'unnamed'}] tenant=${row?.tenant} → v${p.set.version}` +
          `${p.set.isDefault ? ' (default)' : ''}${row?.isArchived ? ' (archived)' : ''}`
      );
    }

    if (!APPLY) {
      console.log('\nDRY RUN — nothing written. Re-run with --apply to write.');
      return;
    }

    for (const p of plan) {
      await AppraisalTemplate.updateOne({ _id: p._id }, { $set: p.set });
    }
    // Mongoose does NOT add indexes to an existing collection on its own, and the
    // partial unique indexes are what close the ensureDefaultTemplate race and the
    // two-isLatest-per-family hole. Creating them is the point of running this
    // script, not a side effect — and it has to happen AFTER the data is consistent
    // or the unique builds fail.
    await AppraisalTemplate.syncIndexes();
    console.log(`Backfilled ${plan.length} templates and synced indexes.`);
  } finally {
    await mongoose.disconnect();
  }
}

module.exports = { planTemplateBackfill };

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
