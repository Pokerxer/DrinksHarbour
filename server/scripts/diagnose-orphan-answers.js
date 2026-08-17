/* READ-ONLY. Attributes orphaned answers to v2 (pre-existing) or v3 (my change). */
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
  const wyn = await AppraisalCycle.findOne({ name: /Wyn City - Aug 2026$/i }).lean();
  const v3 = await AppraisalTemplate.findById(wyn.template).lean();
  const v2 = await AppraisalTemplate.findOne({ family: v3.family, version: 2 }).lean();

  const depts = await Department.find({}).lean();
  const dname = new Map(depts.map((d) => [sid(d._id), d.name]));

  const appraisals = await Appraisal.find({ cycle: wyn._id }).lean();
  const byId = new Map(appraisals.map((a) => [sid(a._id), a]));
  const rows = await AppraisalFeedback.find({ cycle: wyn._id }).lean();

  const askedSet = (tpl, kind, a) => {
    const s = new Set();
    filterSections(tpl.sections, { kind, departmentId: a.department, roleIds: a.roles })
      .forEach((sec) => sec.questions.forEach((q) => s.add(sid(q._id))));
    return s;
  };

  let preExisting = 0;
  let causedByChange = 0;
  const detail = [];

  for (const r of rows) {
    if (!(r.answers || []).length) continue;
    const a = byId.get(sid(r.appraisal));
    const inV2 = askedSet(v2, r.kind, a);
    const inV3 = askedSet(v3, r.kind, a);
    let pre = 0;
    let now = 0;
    for (const ans of r.answers) {
      const id = sid(ans.questionId);
      const okV2 = inV2.has(id);
      const okV3 = inV3.has(id);
      if (!okV2) pre += 1;
      else if (!okV3) now += 1;
    }
    if (pre || now) {
      const rev = await User.findById(r.reviewer, 'firstName lastName').lean();
      const emp = await User.findById(a.employee, 'firstName lastName').lean();
      detail.push(
        `  ${r.kind.padEnd(7)} reviewer=${`${rev?.firstName || ''} ${rev?.lastName || ''}`.trim().padEnd(20)} subj=${`${emp?.firstName || ''} ${emp?.lastName || ''}`.trim().padEnd(18)} dept=${(dname.get(sid(a.department)) || '?').padEnd(26)} answers=${r.answers.length} preExisting=${pre} causedByChange=${now}`
      );
    }
    preExisting += pre;
    causedByChange += now;
  }

  console.log('ORPHANED ANSWERS IN THE WYN CITY CYCLE\n');
  detail.forEach((d) => console.log(d));
  console.log(`\n  pre-existing (already orphaned under v2): ${preExisting}`);
  console.log(`  caused by the v3 change:                  ${causedByChange}`);

  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
