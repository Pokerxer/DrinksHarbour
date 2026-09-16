/**
 * Strip empty optionScores arrays from every question in template
 * 6aa95a9bc118772bff37fdff.
 *
 * The template was created with `"optionScores": []` on every question, even
 * ones that are not scored-anchor questions. The client's `hasOptionScores`
 * check treats ANY present array (even empty) as "scoring is ON", then
 * requires ≥ 2 options — which these questions do not have, so the editor
 * blocks saving with "A scored question needs at least two options."
 *
 * Removing the empty arrays restores the intended default: no array present =
 * scoring is OFF.
 *
 * Safety: refuses to touch if a launched cycle pins this version.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const mongoose = require('mongoose');
const AppraisalTemplate = require('../models/AppraisalTemplate');
const { hasLaunchedCycleFor } = require('../controllers/appraisalTemplate.controller');

const APPLY = process.argv.includes('--apply');
const TID = '6aa95a9bc118772bff37fdff';
const TENANT = '699165839f3308b1baeca8fc';

async function main() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  await mongoose.connect(uri);

  const t = await AppraisalTemplate.findOne({ _id: TID, tenant: TENANT }).lean();
  if (!t) {
    console.error(`Template ${TID} not found`);
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(`Template: "${t.name}" v${t.version}  _id=${t._id}`);
  console.log(`Sections: ${t.sections.length}\n`);

  const launched = await hasLaunchedCycleFor(TENANT, t._id);
  if (launched) {
    console.error('A launched cycle pins this version — abort.');
    await mongoose.disconnect();
    process.exit(1);
  }

  // Build bulkWrite ops: unset optionScores on every question where it is
  // an empty array (or any array shorter than 2 — same fix).
  const ops = [];
  let affected = 0;
  for (let si = 0; si < t.sections.length; si++) {
    const section = t.sections[si];
    for (let qi = 0; qi < section.questions.length; qi++) {
      const q = section.questions[qi];
      if (Array.isArray(q.optionScores) && q.optionScores.length < 2) {
        ops.push({
          updateOne: {
            filter: { _id: TID, tenant: TENANT },
            update: {
              $unset: {
                [`sections.${si}.questions.${qi}.optionScores`]: '',
              },
            },
          },
        });
        affected += 1;
      }
    }
  }

  console.log(`${affected} question(s) have empty/short optionScores to strip.\n`);

  if (!APPLY) {
    console.log('Dry run — nothing written. Re-run with --apply to write.');
  } else if (ops.length === 0) {
    console.log('Nothing to write — all questions already clean.');
  } else {
    const res = await AppraisalTemplate.bulkWrite(ops);
    console.log(`Applied. matched=${res.matchedCount} modified=${res.modifiedCount}`);
  }

  // Verify
  const fresh = await AppraisalTemplate.findOne({ _id: TID, tenant: TENANT }).lean();
  let remaining = 0;
  let withScores = 0;
  for (const s of fresh.sections) {
    for (const q of s.questions) {
      if (Array.isArray(q.optionScores) && q.optionScores.length > 0) withScores += 1;
      if (Array.isArray(q.optionScores) && q.optionScores.length < 2) remaining += 1;
    }
  }
  console.log(`\nVerification: ${withScores} question(s) with real optionScores`);
  console.log(`Verification: ${remaining} question(s) still with empty/short optionScores (should be 0)`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});