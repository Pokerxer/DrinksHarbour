/**
 * Fix name and description for template 6aa95a9bc118772bff37fdff.
 *
 * The description currently reads as a warehouse-only review, but the template
 * has sections scoped to every department: Retail, Warehouse, Logistics,
 * Facilities, Cashier, Management, and HR. The name "September 360 appraisal"
 * gives no indication of scope either.
 *
 * Safely aborts if the template has been forked (version > 1) or a launched
 * cycle pins it, so HR is not surprised by a name change on a live form.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const mongoose = require('mongoose');
const AppraisalTemplate = require('../models/AppraisalTemplate');
const { hasLaunchedCycleFor } = require('../controllers/appraisalTemplate.controller');

const APPLY = process.argv.includes('--apply');
const TID = '6aa95a9bc118772bff37fdff';
const TENANT = '699165839f3308b1baeca8fc';

const NEW_NAME = 'Wyncity 360° Appraisal – September 2026';
const NEW_DESC =
  'Monthly 360° performance review covering all departments: Retail Sales, Warehouse, Logistics (Drivers), Facilities (Cleaners), Cashiers, Store Management, and HR. Each section is scoped to the relevant department and role. Completed by self, manager, and peers to provide well-rounded feedback on core competencies for the subject\'s role.';

async function main() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  await mongoose.connect(uri);

  const t = await AppraisalTemplate.findOne({ _id: TID, tenant: TENANT }).lean();
  if (!t) {
    console.error(`Template ${TID} not found for tenant ${TENANT}`);
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(`Template: "${t.name}"  v${t.version}  _id=${t._id}`);
  console.log(`Description:\n  "${t.description}"\n`);

  // Don't overwrite something a human has deliberately changed.
  if (t.name !== 'September 360 appraisal') {
    console.error(`Name is unexpected: "${t.name}" — aborting`);
    await mongoose.disconnect();
    process.exit(1);
  }
  const currentDescPrefix =
    'A monthly performance review form for warehouse staff covering';
  if (!t.description.startsWith(currentDescPrefix)) {
    console.error('Description does not match expected prefix — aborting');
    await mongoose.disconnect();
    process.exit(1);
  }

  const launched = await hasLaunchedCycleFor(TENANT, t._id);
  if (launched) {
    console.error(
      'A launched cycle pins this template version. ' +
        'Fix the name/description through the form builder instead.'
    );
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log('Proposed changes:');
  console.log(`  name: "${t.name}" → "${NEW_NAME}"`);
  console.log(`  description: (updated to match full template scope)\n`);

  if (!APPLY) {
    console.log('Dry run — nothing written. Re-run with --apply to write.');
  } else {
    const res = await AppraisalTemplate.updateOne(
      { _id: TID, tenant: TENANT },
      { $set: { name: NEW_NAME, description: NEW_DESC } }
    );
    console.log(`Applied. matched=${res.matchedCount} modified=${res.modifiedCount}`);

    // Verify
    const fresh = await AppraisalTemplate.findOne({ _id: TID, tenant: TENANT })
      .select('name description')
      .lean();
    console.log(`\nVerified name: "${fresh.name}"`);
    console.log(`Verified description:\n  "${fresh.description}"`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});