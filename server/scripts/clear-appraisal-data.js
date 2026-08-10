/**
 * Clear a tenant's appraisal RECORDS, keeping the forms.
 *
 * Deletes every cycle, appraisal, feedback row, nudge and peer standing
 * feedback for one tenant, and deliberately leaves `AppraisalTemplate`
 * alone — the forms are authored work, the records are what a cycle
 * produces from them. Starting a fresh cycle after this rebuilds
 * everything it deleted; re-authoring 26 sections of scored anchors does not.
 *
 * ⚠ IRREVERSIBLE, and it does not spare RELEASED appraisals. A released
 * appraisal carries the manager's signed-off summary, the agreed
 * commitments and the employee's own written response — a completed HR
 * record, not scratch data. The count is printed before anything is
 * written so the operator sees what they are about to lose; if any of it
 * matters, stop and dump it first.
 *
 * Order matters: children before parents. A crash halfway then leaves
 * orphaned parents, which the app tolerates (a cycle with no appraisals
 * reads as un-launched), rather than orphaned children, which it does not
 * — an AppraisalFeedback whose appraisal is gone is a row every reader
 * dereferences and none can resolve.
 *
 * Usage:
 *   node scripts/clear-appraisal-data.js --tenant=<id>            # dry run
 *   node scripts/clear-appraisal-data.js --tenant=<id> --apply    # delete
 *
 * Writes nothing without --apply. `--tenant` is REQUIRED and never
 * defaulted: a delete that picks its own scope is one keystroke from
 * clearing the wrong company.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');
const AppraisalCycle = require('../models/AppraisalCycle');
const Appraisal = require('../models/Appraisal');
const AppraisalFeedback = require('../models/AppraisalFeedback');
const AppraisalNudge = require('../models/AppraisalNudge');
const PeerStandingFeedback = require('../models/PeerStandingFeedback');

const APPLY = process.argv.includes('--apply');
const TENANT = (process.argv.find((a) => a.startsWith('--tenant=')) || '').split('=')[1] || null;

// Children first — see the note above on which orphan the app survives.
const TARGETS = [
  ['PeerStandingFeedback', PeerStandingFeedback],
  ['AppraisalNudge', AppraisalNudge],
  ['AppraisalFeedback', AppraisalFeedback],
  ['Appraisal', Appraisal],
  ['AppraisalCycle', AppraisalCycle],
];

async function main() {
  if (!TENANT) throw new Error('--tenant=<id> is required');
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGO_URI is not set');
  await mongoose.connect(uri);

  const tenant = await Tenant.findById(TENANT).select('name').lean();
  if (!tenant) throw new Error(`No tenant ${TENANT}`);
  console.log(`Tenant: ${tenant.name} (${TENANT})\n`);

  const filter = { tenant: new mongoose.Types.ObjectId(TENANT) };
  let total = 0;
  for (const [label, Model] of TARGETS) {
    const n = await Model.countDocuments(filter);
    total += n;
    console.log(`  ${label.padEnd(22)} ${String(n).padStart(5)}`);
  }

  // Named explicitly rather than left implicit: "everything appraisal" that
  // silently included the forms would be a very expensive surprise.
  const AppraisalTemplate = require('../models/AppraisalTemplate');
  const templates = await AppraisalTemplate.countDocuments(filter);
  console.log(`  ${'AppraisalTemplate'.padEnd(22)} ${String(templates).padStart(5)}   ← KEPT`);

  const released = await Appraisal.countDocuments({ ...filter, releasedAt: { $ne: null } });
  console.log(`\n${total} rows to delete, of which ${released} appraisals are RELEASED.`);

  if (!APPLY) {
    console.log('\nDry run — nothing deleted. Re-run with --apply.');
    await mongoose.disconnect();
    return;
  }

  console.log('');
  for (const [label, Model] of TARGETS) {
    const { deletedCount } = await Model.deleteMany(filter);
    console.log(`  deleted ${String(deletedCount).padStart(5)}  ${label}`);
  }

  console.log('\nVerifying:');
  for (const [label, Model] of TARGETS) {
    const left = await Model.countDocuments(filter);
    console.log(`  ${left === 0 ? '✓' : '✗'} ${label.padEnd(22)} ${left} left`);
  }
  const templatesAfter = await AppraisalTemplate.countDocuments(filter);
  console.log(`  ${templatesAfter === templates ? '✓' : '✗'} templates intact: ${templatesAfter}/${templates}`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
