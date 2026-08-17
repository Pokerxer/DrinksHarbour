/* READ-ONLY investigation. Writes nothing. */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const mongoose = require('mongoose');
const AppraisalCycle = require('../models/AppraisalCycle');
const AppraisalTemplate = require('../models/AppraisalTemplate');
const Appraisal = require('../models/Appraisal');
const User = require('../models/User');
const { filterSections } = require('../services/appraisal.helpers');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const cycle = await AppraisalCycle.findOne({
    name: /Scored Performance Assessment Wyn City - Aug 2026/i,
  }).lean();
  if (!cycle) {
    console.log('CYCLE NOT FOUND');
    // list candidates
    const all = await AppraisalCycle.find({}, 'name status').lean();
    console.log('Existing cycles:', all.map((c) => `${c.name} [${c.status}]`));
    return mongoose.disconnect();
  }
  console.log('CYCLE:', cycle.name, '| status:', cycle.status, '| _id:', String(cycle._id));
  console.log('  pinned template:', String(cycle.template), '| family:', String(cycle.templateFamily));

  const tpl = await AppraisalTemplate.findById(cycle.template).lean();
  console.log('TEMPLATE:', tpl?.name, '| version:', tpl?.version, '| sections:', tpl?.sections?.length);

  // Find Chukwuma
  const chukwuma = await User.findOne({ email: /chukwuma@wyncity/i }, 'name email').lean();
  console.log('\nCHUKWUMA:', chukwuma ? `${chukwuma.name} <${chukwuma.email}> ${String(chukwuma._id)}` : 'NOT FOUND');

  // Appraisals in this cycle where Chukwuma is the manager (appraiser)
  const managed = await Appraisal.find({ cycle: cycle._id, manager: chukwuma?._id })
    .populate('employee', 'name email')
    .lean();
  console.log(`\nAppraisals Chukwuma manages in this cycle: ${managed.length}`);
  for (const a of managed) {
    const asked = filterSections(tpl.sections, {
      kind: 'manager',
      departmentId: a.department,
      roleIds: a.roles,
    });
    const qCount = asked.reduce((n, s) => n + s.questions.length, 0);
    console.log(`  - ${a.employee?.name} (${a.employee?.email}) dept=${a.department} roles=${(a.roles||[]).length} -> manager-questions=${qCount}`);
  }

  // Dump the manager-kind questions for the FIRST managed subject as the representative "20 questions"
  if (managed[0]) {
    const a = managed[0];
    const asked = filterSections(tpl.sections, { kind: 'manager', departmentId: a.department, roleIds: a.roles });
    console.log(`\n===== MANAGER-KIND QUESTIONS for subject "${a.employee?.name}" =====`);
    asked.forEach((s) => {
      console.log(`\n## SECTION: ${s.title}  (departments=${(s.departments||[]).length}, roles=${(s.roles||[]).length})`);
      s.questions.forEach((q, i) => {
        console.log(`  [${i + 1}] (${q.type}${q.scaleMax ? ' max' + q.scaleMax : ''}) ${q.label}`);
        if (q.options?.length) console.log(`       options: ${JSON.stringify(q.options)}${q.optionScores?.length ? ' scores:' + JSON.stringify(q.optionScores) : ''}`);
      });
    });
  }

  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
