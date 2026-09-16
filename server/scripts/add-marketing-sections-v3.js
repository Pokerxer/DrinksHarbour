/**
 * Fork template v2 → v3, adding two Sales & Marketing sections scoped to the
 * Digital Marketing & Sales department (6a77b54886eb9115f01c884a).
 *
 * Departments WITHOUT dedicated sections fall back to Core Competencies only;
 * the four marketers (Mercy, Ochanya, Oluchi, Victor) currently get 5 self / 4
 * manager questions from that fallback alone. This adds role-relevant content.
 *
 * Copy-on-write: v2 is pinned by the launched cycle 6aa962e0d7a3d8d63f24923f,
 * so v2 is left untouched. v3 becomes isLatest; the cycle is then re-pinned to
 * v3 (same re-pin as the earlier v1→v2 fix) so the live September 2026 cycle
 * picks the sections up.
 *
 * Question shape mirrors Core Competencies: scale 1-5, required, self+manager.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const mongoose = require('mongoose');
const AppraisalTemplate = require('../models/AppraisalTemplate');
const AppraisalCycle = require('../models/AppraisalCycle');

const APPLY = process.argv.includes('--apply');
const TENANT = '699165839f3308b1baeca8fc';
const V2_ID = '6aa966367bfe8227eadfb8e6';
const CYCLE_ID = '6aa962e0d7a3d8d63f24923f';
const DMS_DEPT = '6a77b54886eb9115f01c884a';

// Scale question builder matching the Core Competencies questions in v2.
function scaleQ(label, low, high) {
  return {
    type: 'scale',
    label,
    helpText: '',
    required: true,
    scaleMax: 5,
    options: [],
    multiple: false,
    optionScores: [],
    scaleLabels: { low, high },
    askOf: ['self', 'manager'],
    _id: new mongoose.Types.ObjectId(),
  };
}

const MARKETING_SECTIONS = [
  {
    title: 'Marketing Performance & Growth',
    departments: [DMS_DEPT],
    roles: [],
    questions: [
      scaleQ(
        'How accurately does the staff member track campaign costs, leads, conversions, revenue, and return on effort?',
        'Rarely tracks or reports campaign results reliably',
        'Consistently produces accurate, timely campaign and ROI reporting'
      ),
      scaleQ(
        'How well does the staff member identify opportunities for cross-selling, repeat business, partnerships, or new audiences?',
        'Misses obvious opportunities to grow sales or reach',
        'Actively surfaces and acts on growth, referral, and partnership opportunities'
      ),
      scaleQ(
        'How consistently does the staff member contribute measurable ideas that improve awareness, enquiries, customer loyalty, or revenue?',
        'Rarely contributes new, measurable ideas',
        'Regularly brings forward ideas with clear, measurable impact'
      ),
    ],
  },
  {
    title: 'Marketing Coordination & Conduct',
    departments: [DMS_DEPT],
    roles: [],
    questions: [
      scaleQ(
        'How consistently does the staff member coordinate promotions with Accounts, Retail, Operations, and Warehouse?',
        'Promotions are often uncoordinated or communicated late',
        'Coordinates seamlessly so promotions run on time with full buy-in'
      ),
      scaleQ(
        'How responsibly does the staff member use customer data, marketing permissions, images, and brand assets?',
        'Careless with data, permissions, or brand assets',
        'Handles data, permissions, images, and brand assets responsibly at all times'
      ),
      scaleQ(
        'How professionally does the staff member represent Wyn City to customers, partners, media, and suppliers?',
        'Representation is inconsistent or unprofessional',
        'Is a consistently professional, positive face of Wyn City'
      ),
    ],
  },
];

async function main() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  await mongoose.connect(uri);

  const v2 = await AppraisalTemplate.findOne({ _id: V2_ID, tenant: TENANT }).lean();
  if (!v2) { console.error('v2 template not found'); process.exit(1); }
  if (v2.version !== 2) { console.error(`Expected v2, got v${v2.version}`); process.exit(1); }

  console.log(`v2: "${v2.name}" family=${v2.family} isLatest=${v2.isLatest}`);

  // Already forked? Guard against double-run.
  const existingV3 = await AppraisalTemplate.findOne({
    tenant: TENANT,
    family: v2.family,
    version: 3,
  }).lean();
  if (existingV3) {
    console.error(`v3 already exists (${existingV3._id}) — aborting to avoid duplicate forks.`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const preview = ([...v2.sections, ...MARKETING_SECTIONS]).map((s) =>
    `${s.title} (${s.questions.length}q, dept=${(s.departments || []).length ? 'scoped' : 'everyone'})`);
  console.log('\nPlanned v3 sections:');
  preview.forEach((p, i) => console.log(`  ${i + 1}. ${p}`));
  console.log(`\nNew: ${MARKETING_SECTIONS.length} marketing section(s) for dept ${DMS_DEPT}.`);

  if (!APPLY) {
    console.log('\nDry run — nothing written. Re-run with --apply.');
    await mongoose.disconnect();
    return;
  }

  // 1) Demote v2 from latest so the partial unique index accepts v3 as latest.
  const demoted = await AppraisalTemplate.updateOne(
    { _id: V2_ID, tenant: TENANT },
    { $set: { isLatest: false } }
  );
  if (demoted.matchedCount !== 1) { console.error('Failed to demote v2'); process.exit(1); }

  // 2) Create v3 with v2's sections + the new marketing sections.
  const v3 = await AppraisalTemplate.create({
    tenant: v2.tenant,
    family: v2.family,
    version: 3,
    isLatest: true,
    isDefault: v2.isDefault || false,
    name: v2.name,
    description: v2.description,
    sections: [...v2.sections, ...MARKETING_SECTIONS],
    createdBy: v2.createdBy || null,
  });
  console.log(`\nCreated v3: ${v3._id}`);

  // 3) Re-pin the launched cycle to v3 (same as the v1→v2 data fix).
  const cycle = await AppraisalCycle.findOneAndUpdate(
    { _id: CYCLE_ID, tenant: TENANT },
    { $set: { template: v3._id } },
    { new: true }
  );
  if (!cycle) { console.error('Cycle not found'); process.exit(1); }
  console.log(`Cycle "${cycle.name}" re-pinned to v3 (${cycle.template}).`);

  await mongoose.disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });