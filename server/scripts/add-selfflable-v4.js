/**
 * Fork template v3 → v4, adding `selfLabel` (first-person) to the six marketing
 * questions so Mercy's OWN self-review reads "How accurately do you..." while
 * the manager form keeps "How accurately does the staff member...".
 *
 * Copy-on-write: v3 is pinned by the launched cycle, so v3 is untouched. v4
 * becomes isLatest and the cycle is re-pinned to v4.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const mongoose = require('mongoose');
const AppraisalTemplate = require('../models/AppraisalTemplate');
const AppraisalCycle = require('../models/AppraisalCycle');

const APPLY = process.argv.includes('--apply');
const TENANT = '699165839f3308b1baeca8fc';
const V3_ID = '6aaa9f863eef3f49e622823c';
const CYCLE_ID = '6aa962e0d7a3d8d63f24923f';

// Third-person label (exact question `label`) → first-person self version.
const SELFLABEL_BY_LABEL = new Map([
  [
    'How accurately does the staff member track campaign costs, leads, conversions, revenue, and return on effort?',
    'How accurately do you track campaign costs, leads, conversions, revenue, and return on effort?',
  ],
  [
    'How well does the staff member identify opportunities for cross-selling, repeat business, partnerships, or new audiences?',
    'How well do you identify opportunities for cross-selling, repeat business, partnerships, or new audiences?',
  ],
  [
    'How consistently does the staff member contribute measurable ideas that improve awareness, enquiries, customer loyalty, or revenue?',
    'How consistently do you contribute measurable ideas that improve awareness, enquiries, customer loyalty, or revenue?',
  ],
  [
    'How consistently does the staff member coordinate promotions with Accounts, Retail, Operations, and Warehouse?',
    'How consistently do you coordinate promotions with Accounts, Retail, Operations, and Warehouse?',
  ],
  [
    'How responsibly does the staff member use customer data, marketing permissions, images, and brand assets?',
    'How responsibly do you use customer data, marketing permissions, images, and brand assets?',
  ],
  [
    'How professionally does the staff member represent Wyn City to customers, partners, media, and suppliers?',
    'How professionally do you represent Wyn City to customers, partners, media, and suppliers?',
  ],
]);

async function main() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  await mongoose.connect(uri);

  const v3 = await AppraisalTemplate.findOne({ _id: V3_ID, tenant: TENANT }).lean();
  if (!v3) { console.error('v3 template not found'); process.exit(1); }
  if (v3.version !== 3) { console.error(`Expected v3, got v${v3.version}`); process.exit(1); }

  const existingV4 = await AppraisalTemplate.findOne({
    tenant: TENANT, family: v3.family, version: 4,
  }).lean();
  if (existingV4) {
    console.error(`v4 already exists (${existingV4._id}) — aborting.`);
    await mongoose.disconnect();
    process.exit(1);
  }

  // Build v4 sections, cloning v3 and adding selfLabel to the six marketing Qs.
  const sections = v3.sections.map((s) => ({
    ...s,
    questions: s.questions.map((q) => {
      const selfLabel = SELFLABEL_BY_LABEL.get(q.label);
      return selfLabel ? { ...q, selfLabel } : q;
    }),
  }));

  let matched = 0;
  for (const s of sections) for (const q of s.questions) if (q.selfLabel) matched++;
  console.log(`Marketing questions receiving selfLabel: ${matched} (expect 6)`);

  if (!APPLY) {
    console.log('\nDry run — nothing written. Re-run with --apply.');
    await mongoose.disconnect();
    return;
  }

  await AppraisalTemplate.updateOne(
    { _id: V3_ID, tenant: TENANT },
    { $set: { isLatest: false } }
  );

  const v4 = await AppraisalTemplate.create({
    tenant: v3.tenant,
    family: v3.family,
    version: 4,
    isLatest: true,
    isDefault: v3.isDefault || false,
    name: v3.name,
    description: v3.description,
    sections,
    createdBy: v3.createdBy || null,
  });
  console.log(`Created v4: ${v4._id}`);

  const cycle = await AppraisalCycle.findOneAndUpdate(
    { _id: CYCLE_ID, tenant: TENANT },
    { $set: { template: v4._id } },
    { new: true }
  );
  console.log(`Cycle "${cycle?.name}" re-pinned to v4 (${cycle?.template}).`);

  await mongoose.disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });