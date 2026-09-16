/**
 * Re-pin cycle 6aa962e0d7a3d8d63f24923f to template v2
 * (6aa966367bfe8227eadfb8e6).
 *
 * The cycle launched pinned to v1 (6aa95a9bc118772bff37fdff), whose Retail
 * sections are role-scoped to Attendant only and which has no Core Competencies
 * fallback. Salome (Retail → Cashier) therefore gets zero questions: every
 * Retail section fails her role match, and no other section matches her
 * department.
 *
 * v2 clears the role scoping on the Retail sections and adds a department/role-
 * agnostic Core Competencies section. Every question v1 carried is copied
 * with its original _id into v2, so re-pinning only ADDS questions — nothing
 * an existing form already has is removed or reworded. All 29 appraisals in
 * the cycle are still state=nominating with no submitted answers, so there is
 * nothing to orphan.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const mongoose = require('mongoose');
const AppraisalCycle = require('../models/AppraisalCycle');
const Appraisal = require('../models/Appraisal');

const APPLY = process.argv.includes('--apply');
const CYCLE_ID = '6aa962e0d7a3d8d63f24923f';
const NEW_TEMPLATE = '6aa966367bfe8227eadfb8e6';
const OLD_TEMPLATE = '6aa95a9bc118772bff37fdff';
const TENANT = '699165839f3308b1baeca8fc';

async function main() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  await mongoose.connect(uri);

  const cycle = await AppraisalCycle.findOne({ _id: CYCLE_ID, tenant: TENANT }).lean();
  if (!cycle) { console.error('Cycle not found'); process.exit(1); }

  console.log(`Cycle: "${cycle.name}" status=${cycle.status} launchedAt=${cycle.launchedAt}`);
  console.log(`Current template = ${cycle.template}`);

  if (String(cycle.template) !== OLD_TEMPLATE) {
    // Already repointed to the new template or elsewhere — nothing to do.
    if (String(cycle.template) === NEW_TEMPLATE) {
      console.log('Already pinned to v2.');
    } else {
      console.error(`Unexpected template ${cycle.template} — aborting.`);
      process.exit(1);
    }
    await mongoose.disconnect();
    return;
  }

  // Safety: confirm the cycle's appraisals have no submitted answers before
  // swapping the form underneath them.
  const done = await Appraisal.countDocuments({
    tenant: TENANT,
    cycle: CYCLE_ID,
    state: { $in: ['released', 'acknowledged'] },
  });
  console.log(`Appraisals released/acknowledged: ${done} — must be 0 to proceed.`);
  if (done > 0) {
    console.error('Aborting: change the form would orphan submitted answers.');
    process.exit(1);
  }

  if (!APPLY) {
    console.log('\nDry run — nothing written. Re-run with --apply.');
  } else {
    const res = await AppraisalCycle.updateOne(
      { _id: CYCLE_ID, tenant: TENANT },
      { $set: { template: new mongoose.Types.ObjectId(NEW_TEMPLATE) } }
    );
    console.log(`\nApplied. matched=${res.matchedCount} modified=${res.modifiedCount}`);
  }

  const fresh = await AppraisalCycle.findOne({ _id: CYCLE_ID, tenant: TENANT }).select('template templateFamily').lean();
  console.log(`\nVerified: cycle.template=${fresh.template}  templateFamily=${fresh.templateFamily}`);

  await mongoose.disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });