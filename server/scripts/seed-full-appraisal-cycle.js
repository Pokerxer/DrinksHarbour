/**
 * Launch one cycle and fill EVERY self and manager form in it.
 *
 * A demo/QA fixture: it produces a cycle whose appraisals are all fully
 * answered, so the reporting screens (comparison, /100 scoring, the roster,
 * the cycle detail page) can be looked at with real-shaped data instead of a
 * handful of half-filled rows.
 *
 * It goes through the SAME helpers the controllers go through rather than
 * writing documents by hand:
 *
 *   planCycleLaunch          who gets an appraisal, and their snapshots
 *   filterSections           which questions each reviewer is asked
 *   normaliseAnswers         the shape an answer is stored in
 *   findUnansweredRequired   the check submitFeedback enforces
 *
 * Reimplementing any of them here would produce data that renders but is
 * subtly not what the app writes — an answer keyed to a question the reviewer
 * was never asked, or a manager comment on a self row. Every generated form is
 * run through the real validators and the script ABORTS on the first failure.
 *
 * Answers are deterministic, seeded from (employee, question), so a re-run
 * with the same roster produces the same scores and a screenshot stays
 * reproducible. Self scores are pulled slightly HIGHER than manager scores,
 * because that is the gap the comparison view exists to show; a fixture where
 * both sides always agree makes that screen look broken.
 *
 * Appraisals are left in `collecting` with both rows submitted. That is
 * exactly where the real flow parks them: `saveSummary` is what moves an
 * appraisal to `summarising`, and writing a manager's summary is a judgement
 * this script has no business faking.
 *
 * Usage:
 *   node scripts/seed-full-appraisal-cycle.js --tenant=<id> --family=<id> --name="..."
 *   node scripts/seed-full-appraisal-cycle.js ... --apply
 *
 * Writes nothing without --apply.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const Department = require('../models/Department');
const AppraisalTemplate = require('../models/AppraisalTemplate');
const AppraisalCycle = require('../models/AppraisalCycle');
const Appraisal = require('../models/Appraisal');
const AppraisalFeedback = require('../models/AppraisalFeedback');
const {
  planCycleLaunch,
  filterSections,
  getAskedQuestionIds,
  partitionAnswersByAskedQuestions,
  normaliseAnswers,
  findUnansweredRequired,
  scoreAppraisal,
  TENANT_ROLES,
} = require('../services/appraisal.helpers');

const arg = (n) => (process.argv.find((a) => a.startsWith(`--${n}=`)) || '').split('=').slice(1).join('=') || null;
const APPLY = process.argv.includes('--apply');
const TENANT = arg('tenant');
const FAMILY = arg('family');
const NAME = arg('name') || 'Full Assessment';

/**
 * A small deterministic hash, so the same person answers the same way on every
 * run. Not for security — only for spread. FNV-1a with a murmur3 fmix32
 * finalizer, the same combination the anchor shuffle needed: plain FNV-1a
 * clusters badly on short, similar keys, which here would mean every employee
 * scoring alike.
 */
function hash32(key) {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i += 1) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/**
 * How one employee tends to be rated, as a probability over anchors ordered
 * best-first.
 *
 * A PER-EMPLOYEE profile, not just a per-question roll. Sampling every one of
 * 20 questions from the same distribution makes each employee's total converge
 * on that distribution's mean — 20 draws is plenty for the law of large
 * numbers — so the whole roster lands within a few points of each other and
 * the grade bands look broken. The spread has to come from the person.
 */
const CALIBRE = [
  ['excellent', [0.74, 0.20, 0.05, 0.01, 0.00]],
  ['strong', [0.45, 0.33, 0.16, 0.05, 0.01]],
  ['solid', [0.22, 0.36, 0.28, 0.11, 0.03]],
  ['mixed', [0.08, 0.20, 0.32, 0.28, 0.12]],
  ['struggling', [0.03, 0.10, 0.25, 0.35, 0.27]],
];

const calibreFor = (employeeId) => CALIBRE[hash32(`calibre:${employeeId}`) % CALIBRE.length];

/**
 * Pick an anchor for one question from this employee's profile.
 *
 * `lift` nudges the self form upward relative to the manager form. It is
 * applied as a probability of stepping one anchor better, not as an offset on
 * the score, so a self-assessment can still land on the same anchor and the
 * effect never pushes past the best one available.
 */
function pickScore(seedKey, optionScores, lift, weights) {
  const sorted = [...optionScores].sort((a, b) => b - a); // best first
  const r = hash32(seedKey) / 0xffffffff;
  let acc = 0;
  let idx = sorted.length - 1;
  for (let i = 0; i < sorted.length; i += 1) {
    acc += weights[i] ?? 1 / sorted.length;
    if (r <= acc) { idx = i; break; }
  }
  if (lift && hash32(`lift:${seedKey}`) / 0xffffffff < lift && idx > 0) idx -= 1;
  return sorted[idx];
}

const MANAGER_NOTES = [
  'Discussed at the last one-to-one; agreed what good looks like here.',
  'Consistent with what I see on the floor week to week.',
  'Has improved noticeably since the last review period.',
  'Worth setting a concrete target on this for next cycle.',
  'Raised with them directly; they were receptive.',
];

/** Build one reviewer's complete answer set for the sections they are asked. */
function buildAnswers(sections, { seed, kind, weights }) {
  const lift = kind === 'self' ? 0.35 : 0;
  const out = [];
  for (const s of sections) {
    for (const q of s.questions) {
      const key = `${seed}:${q._id}`;
      const a = { questionId: String(q._id) };

      if (Array.isArray(q.optionScores) && q.optionScores.length) {
        a.rating = pickScore(key, q.optionScores, lift, weights);
      } else if (q.type === 'rating' || q.type === 'likert' || q.type === 'scale') {
        const max = q.scaleMax || 5;
        a.rating = 1 + (hash32(key) % max);
      } else if (q.type === 'yes_no') {
        a.rating = hash32(key) % 10 < 8 ? 1 : 0;
      } else if (q.type === 'choice') {
        const opts = q.options || [];
        if (opts.length) a.selected = [opts[hash32(key) % opts.length]];
      } else {
        a.text =
          kind === 'self'
            ? 'Recorded during the self-assessment for this period.'
            : 'Recorded by the reviewing manager for this period.';
      }

      // Manager-only, and only on some answers — a note on every single line
      // is not what a real reviewer produces, and it would hide whether the
      // "manager left a note" affordance actually renders conditionally.
      if (kind === 'manager' && hash32(`note:${key}`) % 4 === 0) {
        a.comment = MANAGER_NOTES[hash32(`pick:${key}`) % MANAGER_NOTES.length];
      }
      out.push(a);
    }
  }
  return out;
}

async function main() {
  if (!TENANT) throw new Error('--tenant=<id> is required');
  if (!FAMILY) throw new Error('--family=<id> is required');
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGO_URI is not set');
  await mongoose.connect(uri);

  const tenant = await Tenant.findById(TENANT).select('name').lean();
  if (!tenant) throw new Error(`No tenant ${TENANT}`);

  const template = await AppraisalTemplate.findOne({
    tenant: TENANT, family: FAMILY, isLatest: true, isArchived: false,
  }).lean();
  if (!template) throw new Error(`No latest template for family ${FAMILY}`);

  // Exactly launchCycle's employee query and routing inputs.
  const [employees, departments, owner] = await Promise.all([
    User.find({ tenant: TENANT, role: { $in: TENANT_ROLES }, status: 'active' })
      .select([
        '_id', 'role', 'firstName', 'lastName', 'email',
        'employeeProfile.work.manager', 'employeeProfile.work.department',
        'employeeProfile.planning.roles', 'employeeProfile.planning.defaultRole',
      ].join(' '))
      .lean(),
    Department.find({ tenant: TENANT }).select('_id manager').lean(),
    User.findOne({ tenant: TENANT, role: 'tenant_owner' }).select('_id').lean(),
  ]);
  const departmentManagerOf = new Map(
    departments.filter((d) => d.manager).map((d) => [String(d._id), String(d.manager)])
  );
  const plan = planCycleLaunch(employees, [], { departmentManagerOf, ownerId: owner?._id || null });
  const byId = new Map(employees.map((e) => [String(e._id), e]));
  const nameOf = (id) => {
    const u = byId.get(String(id));
    return [u?.firstName, u?.lastName].filter(Boolean).join(' ') || String(id);
  };

  console.log(`Tenant:  ${tenant.name}`);
  console.log(`Form:    "${template.name}" v${template.version} ${template._id}`);
  console.log(`Cycle:   "${NAME}"`);
  console.log(`Creates: ${plan.toCreate.length} appraisals, ${plan.skipped.length} skipped\n`);

  // Build and VALIDATE every form before writing anything, so a form that
  // would be rejected by submitFeedback cannot reach the database.
  const work = [];
  let totalAnswers = 0;
  for (const row of plan.toCreate) {
    const scope = { departmentId: row.department, roleIds: row.roles };
    const [calibreName, weights] = calibreFor(row.employee);
    const forms = {};
    for (const kind of ['self', 'manager']) {
      const sections = filterSections(template.sections, { kind, ...scope });
      const raw = buildAnswers(sections, { seed: `${row.employee}:${kind}`, kind, weights });

      const askedIds = getAskedQuestionIds(sections);
      const { rejectedIds } = partitionAnswersByAskedQuestions(raw, askedIds);
      if (rejectedIds.length) {
        throw new Error(`${nameOf(row.employee)} ${kind}: answers for unasked questions ${rejectedIds.join(', ')}`);
      }
      const { answers, errors } = normaliseAnswers(raw, kind);
      if (errors.length) throw new Error(`${nameOf(row.employee)} ${kind}: ${errors.join(' ')}`);
      const missing = findUnansweredRequired(answers, sections);
      if (missing.length) {
        throw new Error(`${nameOf(row.employee)} ${kind}: unanswered required ${missing.join(', ')}`);
      }
      forms[kind] = { sections, answers };
      totalAnswers += answers.length;
    }
    // scoreAppraisal takes the ROW LIST, not one row: it picks the submitted
    // row of the requested kind itself.
    const score = scoreAppraisal(
      forms.manager.sections,
      [{ kind: 'manager', status: 'submitted', answers: forms.manager.answers }],
      { kind: 'manager' }
    );
    work.push({ row, forms, score, calibreName });
  }

  const band = (p) => (p >= 90 ? 'A' : p >= 80 ? 'B' : p >= 70 ? 'C' : p >= 60 ? 'D' : 'E');
  console.log('MANAGER SCORE PER EMPLOYEE (self scores run a little higher by design):');
  for (const w of work) {
    const pct = Math.round(w.score.pct ?? 0);
    console.log(`  ${nameOf(w.row.employee).padEnd(26)} ${String(w.score.earned).padStart(3)}/${w.score.possible}  ${String(pct).padStart(3)}%  ${band(pct)}   ${w.calibreName}`);
  }
  console.log(`\n✓ every form validates against normaliseAnswers + findUnansweredRequired`);
  console.log(`  ${totalAnswers} answers across ${work.length * 2} forms`);

  if (!APPLY) {
    console.log('\nDry run — nothing written. Re-run with --apply.');
    await mongoose.disconnect();
    return;
  }

  const now = new Date();
  const deadline = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const cycle = await AppraisalCycle.create({
    tenant: TENANT,
    name: NAME,
    template: template._id,
    templateFamily: template.family,
    // Self-and-manager only. With peer review on, launchCycle would open in
    // `nominating` and every appraisal would wait on nominations this script
    // has no one to make.
    peerReviewEnabled: false,
    status: 'collecting',
    feedbackDeadline: deadline,
    launchedAt: now,
    createdBy: owner?._id || null,
  });

  let created = 0;
  for (const { row, forms } of work) {
    const appraisal = await Appraisal.create({
      tenant: TENANT,
      cycle: cycle._id,
      employee: row.employee,
      manager: row.manager,
      department: row.department || undefined,
      roles: row.roles || [],
      state: 'collecting',
      reviewerIds: [row.employee, row.manager],
    });
    await AppraisalFeedback.insertMany([
      {
        tenant: TENANT, appraisal: appraisal._id, cycle: cycle._id,
        reviewer: row.employee, kind: 'self',
        answers: forms.self.answers, status: 'submitted', submittedAt: now,
      },
      {
        tenant: TENANT, appraisal: appraisal._id, cycle: cycle._id,
        reviewer: row.manager, kind: 'manager',
        answers: forms.manager.answers, status: 'submitted', submittedAt: now,
      },
    ]);
    created += 1;
  }

  const feedbackCount = await AppraisalFeedback.countDocuments({ cycle: cycle._id });
  const submitted = await AppraisalFeedback.countDocuments({ cycle: cycle._id, status: 'submitted' });
  console.log(`\nApplied.`);
  console.log(`  cycle    ${cycle._id}  "${cycle.name}"  status=${cycle.status}`);
  console.log(`  ✓ ${created} appraisals, all state=collecting`);
  console.log(`  ✓ ${submitted}/${feedbackCount} feedback rows submitted`);
  console.log(`\n  View: /appraisals/cycles/${cycle._id}`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
