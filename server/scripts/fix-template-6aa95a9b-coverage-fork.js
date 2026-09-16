/**
 * Fork template 6aa95a9bc118772bff37fdff to v2 with coverage fixes.
 *
 * A launched cycle pins v1, so in-place edit is blocked. This script forks
 * a new version (v2) with:
 *  1. Retail sections: roles removed so ALL Retail employees see them.
 *  2. A "Core Competencies" fallback section for uncovered departments.
 *
 * The cycle 6aa962e0d7a3d8d63f24923f keeps v1. HR must create a NEW cycle
 * targeting the v2 family to use the fixed form.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const mongoose = require('mongoose');
const AppraisalTemplate = require('../models/AppraisalTemplate');

const APPLY = process.argv.includes('--apply');
const TID = '6aa95a9bc118772bff37fdff';
const TENANT = '699165839f3308b1baeca8fc';

const RETAIL_SECTION_IDS = new Set([
  '6aa95a9bc118772bff37fe00',
  '6aa95a9bc118772bff37fe05',
  '6aa95a9bc118772bff37fe0a',
  '6aa95a9bc118772bff37fe0e',
]);

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
      scaleLabels: { low: 'Frequently misses deadlines or produces inaccurate work', high: 'Consistently completes work accurately and on time' },
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
      scaleLabels: { low: 'Communication is unclear, infrequent, or unprofessional', high: 'Communication is clear, timely, and professional' },
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
      scaleLabels: { low: 'Struggles to adapt; frequently overwhelmed by change', high: 'Adapts quickly and maintains composure under pressure' },
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
      scaleLabels: { low: 'Rarely suggests improvements; waits to be told', high: 'Regularly identifies and acts on improvement opportunities' },
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

  const current = await AppraisalTemplate.findOne({ _id: TID, tenant: TENANT }).lean();
  if (!current) { console.error('Template not found'); process.exit(1); }

  console.log(`Current: "${current.name}" v${current.version}  _id=${current._id}`);
  console.log(`Family: ${current.family}\n`);

  // Build v2 sections: strip roles from Retail sections, add fallback
  const sections = current.sections.map((s) => {
    if (RETAIL_SECTION_IDS.has(String(s._id)) && s.roles && s.roles.length > 0) {
      console.log(`~ ${s.title}: clearing roles`);
      return { ...s, roles: [] };
    }
    return s;
  });

  const hasFallback = sections.some((s) => s.title === 'Core Competencies');
  if (!hasFallback) {
    console.log(`\n+ Adding "Core Competencies" fallback section`);
    sections.push(FALLBACK_SECTION);
  }

  if (!APPLY) {
    console.log('\nDry run — nothing written. Re-run with --apply to fork.');
    await mongoose.disconnect();
    return;
  }

  // Fork: clear old isLatest, insert new version (same transaction pattern)
  const session = await mongoose.startSession();
  let forkedId = null;
  try {
    await session.withTransaction(async () => {
      const fresh = await AppraisalTemplate.findOne({ _id: TID, tenant: TENANT })
        .session(session).lean();
      if (!fresh) throw Object.assign(new Error('Template not found'), { statusCode: 404 });

      const family = fresh.family || fresh._id;
      const baseVersion = fresh.version || 1;

      const siblings = await AppraisalTemplate.find({ tenant: TENANT, family })
        .select('version').session(session).lean();
      const nextVersion = siblings.reduce((max, r) => Math.max(max, r.version || 0), baseVersion) + 1;

      await AppraisalTemplate.updateOne(
        { _id: fresh._id, tenant: TENANT },
        { $set: { isLatest: false, family, version: baseVersion } },
        { session }
      );

      const [next] = await AppraisalTemplate.create([{
        name: current.name,
        description: current.description,
        sections,
        tenant: TENANT,
        family,
        version: nextVersion,
        isLatest: true,
        isDefault: false,
        isArchived: false,
        createdBy: current.createdBy,
      }], { session });

      forkedId = next._id;
    });
  } finally {
    session.endSession();
  }

  console.log(`\nForked to v2: _id=${forkedId}`);

  const verify = await AppraisalTemplate.findOne({ _id: forkedId, tenant: TENANT })
    .select('name version family sections.title sections.departments sections.roles')
    .lean();
  console.log(`Verified: "${verify.name}" v${verify.version}  family=${verify.family}`);
  console.log(`Sections (${verify.sections.length}):`);
  for (const s of verify.sections) {
    const dept = s.departments?.length ? `[dept:${s.departments.length}]` : '[all depts]';
    const role = s.roles?.length ? `[role:${s.roles.length}]` : '[all roles]';
    console.log(`  ${s.title}  ${dept} ${role}`);
  }

  await mongoose.disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });