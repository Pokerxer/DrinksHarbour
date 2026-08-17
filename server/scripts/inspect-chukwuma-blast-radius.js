/* READ-ONLY investigation. Writes nothing. */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const mongoose = require('mongoose');
const AppraisalCycle = require('../models/AppraisalCycle');
const AppraisalTemplate = require('../models/AppraisalTemplate');
const Appraisal = require('../models/Appraisal');
const AppraisalFeedback = require('../models/AppraisalFeedback');
const User = require('../models/User');
const Department = require('../models/Department');
const { filterSections } = require('../services/appraisal.helpers');

const sid = (v) => (v == null ? '' : String(v));

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const cycle = await AppraisalCycle.findOne({
    name: /Scored Performance Assessment Wyn City - Aug 2026/i,
  }).lean();
  const tpl = await AppraisalTemplate.findById(cycle.template).lean();
  const chukwuma = await User.findOne({ email: /chukwuma@wyncity/i }).lean();

  const depts = await Department.find({}).lean();
  const deptName = new Map(depts.map((d) => [sid(d._id), d.name]));

  // --- 1. The whole template: which sections exist, scoped to what, asked of whom
  console.log('=== TEMPLATE SECTION MAP (v%s, %d sections) ===', tpl.version, tpl.sections.length);
  tpl.sections.forEach((s, i) => {
    const kinds = new Set();
    s.questions.forEach((q) => (q.askOf || []).forEach((k) => kinds.add(k)));
    console.log(
      `[${i}] "${s.title}" q=${s.questions.length} askOf={${[...kinds].join(',')}} depts=[${(s.departments || [])
        .map((d) => deptName.get(sid(d)) || sid(d))
        .join(' | ')}] roles=${(s.roles || []).length}`
    );
  });

  // --- 2. Every appraisal in the cycle: who manages it, how many manager-questions
  const all = await Appraisal.find({ cycle: cycle._id })
    .populate('employee', 'firstName lastName email name')
    .populate('manager', 'firstName lastName email name')
    .lean();
  const nameOf = (u) => (u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email : '??');

  console.log(`\n=== ALL ${all.length} APPRAISALS IN CYCLE ===`);
  const sectionUsers = new Map(); // section title -> Set of manager names
  for (const a of all) {
    const asked = filterSections(tpl.sections, {
      kind: 'manager',
      departmentId: a.department,
      roleIds: a.roles,
    });
    const titles = asked.map((s) => s.title);
    for (const t of titles) {
      if (!sectionUsers.has(t)) sectionUsers.set(t, new Set());
      sectionUsers.get(t).add(nameOf(a.manager));
    }
    const isChuk = sid(a.manager?._id) === sid(chukwuma._id);
    console.log(
      `  ${isChuk ? '*CHUK*' : '      '} subj=${nameOf(a.employee).padEnd(22)} mgr=${nameOf(a.manager).padEnd(22)} dept=${(
        deptName.get(sid(a.department)) || 'NONE'
      ).padEnd(18)} state=${a.state} mgrQ=${asked.reduce((n, s) => n + s.questions.length, 0)} [${titles.join(' + ')}]`
    );
  }

  console.log('\n=== WHICH MANAGERS SEE EACH MANAGER-KIND SECTION ===');
  for (const [title, mgrs] of sectionUsers) {
    console.log(`  "${title}" -> ${[...mgrs].join(', ')}`);
  }

  // --- 3. Other cycles pinned to this same template version / family
  const otherCycles = await AppraisalCycle.find({
    $or: [{ template: tpl._id }, { templateFamily: tpl.family }],
  }, 'name status template').lean();
  console.log('\n=== CYCLES TOUCHING THIS TEMPLATE FAMILY ===');
  otherCycles.forEach((c) =>
    console.log(`  ${c.name} [${c.status}] pinnedVersion=${sid(c.template) === sid(tpl._id) ? 'THIS ONE' : sid(c.template)}`)
  );
  const versions = await AppraisalTemplate.find({ family: tpl.family }, 'version isLatest name').lean();
  console.log('  family versions:', versions.map((v) => `v${v.version}${v.isLatest ? '(latest)' : ''}`).join(', '));

  // --- 4. Has any manager feedback already been submitted?
  const fbs = await AppraisalFeedback.find({
    appraisal: { $in: all.map((a) => a._id) },
  })
    .populate('reviewer', 'firstName lastName email')
    .lean();
  console.log(`\n=== FEEDBACK ROWS: ${fbs.length} ===`);
  for (const f of fbs) {
    const a = all.find((x) => sid(x._id) === sid(f.appraisal));
    console.log(
      `  kind=${String(f.kind).padEnd(7)} reviewer=${nameOf(f.reviewer).padEnd(22)} subj=${nameOf(a?.employee).padEnd(22)} submitted=${!!f.submittedAt} answers=${
        (f.answers || []).length
      }`
    );
  }

  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
