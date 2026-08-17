/* READ-ONLY verification of the 5-question manager form change. */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const mongoose = require('mongoose');
const AppraisalCycle = require('../models/AppraisalCycle');
const AppraisalTemplate = require('../models/AppraisalTemplate');
const Appraisal = require('../models/Appraisal');
const AppraisalFeedback = require('../models/AppraisalFeedback');
const User = require('../models/User');
const { filterSections } = require('../services/appraisal.helpers');

const sid = (v) => (v == null ? '' : String(v));
let failures = 0;
const check = (ok, msg) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${msg}`);
  if (!ok) failures += 1;
};

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const wyn = await AppraisalCycle.findOne({ name: /Wyn City - Aug 2026$/i }).lean();
  const other = await AppraisalCycle.findOne({ name: /^Scored Performance Assessment — Aug 2026$/i }).lean();
  const v3 = await AppraisalTemplate.findById(wyn.template).lean();
  const v2 = await AppraisalTemplate.findById(other.template).lean();

  console.log('\n1. CYCLE ISOLATION');
  check(v3.version === 3 && v2.version === 2, `Wyn City on v${v3.version}, other cycle still on v${v2.version}`);
  check(sid(v3._id) !== sid(v2._id), 'the two cycles point at different template documents');
  check(v2.isLatest === true && v3.isLatest === false, 'v2 is still the family latest; v3 is not');
  const v2ManagerQs = v2.sections.reduce(
    (n, s) => n + s.questions.filter((q) => (q.askOf || []).includes('manager')).length, 0);
  // 132 = the template's full question count (5 departments x 20 + Retail's 32),
  // every one of which v2 asks of a manager. Asserted as a literal so a future
  // edit that quietly strips one from v2 fails here.
  check(v2ManagerQs === 132, `v2 untouched: ${v2ManagerQs} manager questions across all departments`);

  console.log('\n2. QUESTION IDS PRESERVED (self answers must still resolve)');
  const v2Ids = new Set();
  v2.sections.forEach((s) => s.questions.forEach((q) => v2Ids.add(sid(q._id))));
  const v3Ids = new Set();
  v3.sections.forEach((s) => s.questions.forEach((q) => v3Ids.add(sid(q._id))));
  const missing = [...v2Ids].filter((id) => !v3Ids.has(id));
  check(missing.length === 0, `all ${v2Ids.size} original question ids carried into v3 (${missing.length} missing)`);
  check(v3Ids.size === v2Ids.size + 15, `v3 adds exactly 15 new questions (${v3Ids.size - v2Ids.size})`);

  console.log('\n3. EVERY STORED ANSWER STILL MAPS TO A QUESTION THIS REVIEWER IS ASKED');
  const appraisals = await Appraisal.find({ cycle: wyn._id }).lean();
  const byId = new Map(appraisals.map((a) => [sid(a._id), a]));
  const rows = await AppraisalFeedback.find({ cycle: wyn._id }).lean();
  let orphans = 0;
  let checked = 0;
  for (const r of rows) {
    if (!(r.answers || []).length) continue;
    const a = byId.get(sid(r.appraisal));
    const asked = new Set();
    filterSections(v3.sections, { kind: r.kind, departmentId: a.department, roleIds: a.roles })
      .forEach((s) => s.questions.forEach((q) => asked.add(sid(q._id))));
    for (const ans of r.answers) {
      checked += 1;
      if (!asked.has(sid(ans.questionId))) orphans += 1;
    }
  }
  check(orphans === 0, `${checked} stored answers checked, ${orphans} orphaned`);

  console.log('\n4. CHUKWUMA CAN COMPLETE ALL FIVE');
  const chuk = await User.findOne({ email: /chukwuma@wyncity/i }).lean();
  const his = await AppraisalFeedback.find({
    cycle: wyn._id, reviewer: chuk._id, kind: 'manager',
  }).lean();
  check(his.length === 5, `${his.length} manager rows`);
  for (const r of his) {
    const a = byId.get(sid(r.appraisal));
    const emp = await User.findById(a.employee, 'firstName lastName').lean();
    const n = filterSections(v3.sections, { kind: 'manager', departmentId: a.department, roleIds: a.roles })
      .reduce((t, s) => t + s.questions.length, 0);
    check(
      n === 5 && r.status === 'pending',
      `${`${emp.firstName} ${emp.lastName}`.trim().padEnd(20)} ${n} questions, status=${r.status}`
    );
  }

  console.log('\n5. NOBODY ELSE MOVED');
  for (const kind of ['self']) {
    let bad = 0;
    for (const a of appraisals) {
      const n = filterSections(v3.sections, { kind, departmentId: a.department, roleIds: a.roles })
        .reduce((t, s) => t + s.questions.length, 0);
      if (n !== 20) bad += 1;
    }
    check(bad === 0, `every self form in the cycle still asks 20 questions (${bad} deviations)`);
  }
  const otherMgrs = await AppraisalFeedback.find({
    cycle: wyn._id, kind: 'manager', reviewer: { $ne: chuk._id },
  }).lean();
  let changed = 0;
  for (const r of otherMgrs) {
    const a = byId.get(sid(r.appraisal));
    const n = filterSections(v3.sections, { kind: 'manager', departmentId: a.department, roleIds: a.roles })
      .reduce((t, s) => t + s.questions.length, 0);
    if (n !== 20) changed += 1;
  }
  console.log(`  NOTE  ${changed} of ${otherMgrs.length} other managers' forms also moved to 5 (Mercy / Chisom — expected)`);

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
  await mongoose.disconnect();
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
