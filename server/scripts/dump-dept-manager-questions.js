/* READ-ONLY. Dumps the manager-kind questions for the given department names. */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const mongoose = require('mongoose');
const AppraisalCycle = require('../models/AppraisalCycle');
const AppraisalTemplate = require('../models/AppraisalTemplate');
const Department = require('../models/Department');

const WANT = ['Digital Marketing & Sales', 'Warehouse'];

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const cycle = await AppraisalCycle.findOne({
    name: /Scored Performance Assessment Wyn City - Aug 2026/i,
  }).lean();
  const tpl = await AppraisalTemplate.findById(cycle.template).lean();
  const depts = await Department.find({}).lean();
  const nameById = new Map(depts.map((d) => [String(d._id), d.name]));

  for (const want of WANT) {
    console.log(`\n\n########## DEPARTMENT: ${want} ##########`);
    let n = 0;
    for (const s of tpl.sections) {
      const names = (s.departments || []).map((d) => nameById.get(String(d)));
      if (!names.includes(want)) continue;
      console.log(`\n## SECTION: ${s.title}`);
      s.questions.forEach((q) => {
        if (!(q.askOf || []).includes('manager')) return;
        n += 1;
        console.log(`  [${n}] (${q.type} max${q.scaleMax}) ${q.label}`);
        (q.options || []).forEach((o, i) => console.log(`       ${q.optionScores?.[i]} = ${o}`));
      });
    }
    console.log(`\n  -> total manager questions: ${n}`);
  }
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
