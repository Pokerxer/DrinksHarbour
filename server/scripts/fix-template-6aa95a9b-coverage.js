/**
 * Fix template 6aa95a9bc118772bff37fdff to cover all employees.
 *
 * Two problems:
 * 1. Retail sections are scoped to role Attendant (6a774a5dce8af457bda41955)
 *    only — Cashiers and other Retail employees get zero questions.
 *    FIX: remove roles from Retail sections so ALL Retail employees see them.
 *
 * 2. Six departments have no sections: Digital Marketing & Sales,
 *    Administration, Accounts, Utility, Operations, Sales & Marketing.
 *    FIX: add a general "Core Competencies" section with no department/role
 *    scoping, so every employee gets at least a basic review form.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const mongoose = require('mongoose');
const AppraisalTemplate = require('../models/AppraisalTemplate');
const { hasLaunchedCycleFor } = require('../controllers/appraisalTemplate.controller');

const APPLY = process.argv.includes('--apply');
const TID = '6aa95a9bc118772bff37fdff';
const TENANT = '699165839f3308b1baeca8fc';

// Retail sections whose roles array to clear
const RETAIL_SECTION_IDS = [
  '6aa95a9bc118772bff37fe00', // Customer Service & Sales
  '6aa95a9bc118772bff37fe05', // Store Operations & Compliance
  '6aa95a9bc118772bff37fe0a', // Transactions & Responsibility
  '6aa95a9bc118772bff37fe0e', // Working with this person (peer section)
];

// New section to add for uncovered departments
const FALLBACK_SECTION = {
  title: 'Core Competencies',
  departments: [],
  roles: [],
  questions: [
    {
      type: 'scale',
      label: 'Completes work assignments accurately and on time',
      helpText: 'Rate how reliably the employee meets deadlines and produces accurate work.',
      required: true,
      scaleMax: 5,
      options: [],
      multiple: false,
      optionScores: [],
      scaleLabels: {
        low: 'Frequently misses deadlines or produces inaccurate work',
        high: 'Consistently completes work accurately and on time',
      },
      askOf: ['self', 'manager'],
    },
    {
      type: 'scale',
      label: 'Communicates effectively with colleagues and supervisors',
      helpText: 'Rate clarity, timeliness, and professionalism in day-to-day communication.',
      required: true,
      scaleMax: 5,
      options: [],
      multiple: false,
      optionScores: [],
      scaleLabels: {
        low: 'Communication is unclear, infrequent, or unprofessional',
        high: 'Communication is clear, timely, and professional',
      },
      askOf: ['self', 'manager'],
    },
    {
      type: 'scale',
      label: 'Adapts to changing priorities and handles pressure constructively',
      helpText: 'Rate flexibility and composure when work demands shift or intensify.',
      required: true,
      scaleMax: 5,
      options: [],
      multiple: false,
      optionScores: [],
      scaleLabels: {
        low: 'Struggles to adapt; frequently overwhelmed by change',
        high: 'Adapts quickly and maintains composure under pressure',
      },
      askOf: ['self', 'manager'],
    },
    {
      type: 'scale',
      label: 'Demonstrates initiative and looks for ways to improve processes',
      helpText: 'Rate how often the employee proactively identifies and acts on improvement opportunities.',
      required: true,
      scaleMax: 5,
      options: [],
      multiple: false,
      optionScores: [],
      scaleLabels: {
        low: 'Rarely suggests improvements; waits to be told',
        high: 'Regularly identifies and acts on improvement opportunities',
      },
      askOf: ['self', 'manager'],
    },
    {
      type: 'text',
      label: 'Describe one thing you did well this month and one area where you would like to improve.',
      helpText: 'Provide a brief, honest reflection on your recent performance.',
      required: true,
      scaleMax: 5,
      options: [],
      multiple: false,
      optionScores: [],
      askOf: ['self'],
    },
  ],
};

async function main() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  await mongoose.connect(uri);

  const t = await AppraisalTemplate.findOne({ _id: TID, tenant: TENANT }).lean();
  if (!t) { console.error('Template not found'); process.exit(1); }

  console.log(`Template: "${t.name}" v${t.version}  _id=${t._id}\n`);

  const launched = await hasLaunchedCycleFor(TENANT, t._id);
  if (launched) {
    console.error('A launched cycle pins this version — abort.');
    await mongoose.disconnect();
    process.exit(1);
  }

  const ops = [];

  // 1. Remove roles from Retail sections
  for (const sectionId of RETAIL_SECTION_IDS) {
    const section = t.sections.find((s) => String(s._id) === sectionId);
    if (!section) {
      console.error(`Section ${sectionId} not found — skipping`);
      continue;
    }
    if (section.roles && section.roles.length > 0) {
      console.log(`~ ${section.title}: removing roles [${section.roles.join(', ')}]`);
      ops.push({
        updateOne: {
          filter: { _id: TID, tenant: TENANT },
          update: { $set: { [`sections.$[s].roles`]: [] } },
          arrayFilters: [{ 's._id': new mongoose.Types.ObjectId(sectionId) }],
        },
      });
    } else {
      console.log(`  ${section.title}: roles already empty — no change`);
    }
  }

  // 2. Add fallback section for uncovered departments
  const hasFallback = t.sections.some((s) => s.title === 'Core Competencies');
  if (!hasFallback) {
    console.log(`\n+ Adding "Core Competencies" fallback section (${FALLBACK_SECTION.questions.length} questions)`);
    ops.push({
      updateOne: {
        filter: { _id: TID, tenant: TENANT },
        update: { $push: { sections: FALLBACK_SECTION } },
      },
    });
  } else {
    console.log('\n  "Core Competencies" section already exists — skipping');
  }

  console.log(`\n${ops.length} operation(s) to apply.\n`);

  if (!APPLY) {
    console.log('Dry run — nothing written. Re-run with --apply to write.');
  } else if (ops.length === 0) {
    console.log('Nothing to write.');
  } else {
    const res = await AppraisalTemplate.bulkWrite(ops);
    console.log(`Applied. matched=${res.matchedCount} modified=${res.modifiedCount}`);
  }

  await mongoose.disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });