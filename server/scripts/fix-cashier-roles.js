require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const mongoose = require('mongoose');
const User = require('../models/User');
const Appraisal = require('../models/Appraisal');
const AppraisalFeedback = require('../models/AppraisalFeedback');

const TENANT = '699165839f3308b1baeca8fc';
const CYCLE_ID = '6aa962e0d7a3d8d63f24923f';
const SALES_DEPT = '6a774a5cce8af457bda4194a';
const CASHIER_ROLE = '6a774a5dce8af457bda41953';

const CASHIER_QS = new Set([
  '6aa95a9bc118772bff37fe41',
  '6aa95a9bc118772bff37fe42',
  '6aa95a9bc118772bff37fe43',
  '6aa95a9bc118772bff37fe44',
  '6aa95a9bc118772bff37fe46',
  '6aa95a9bc118772bff37fe47',
  '6aa95a9bc118772bff37fe48',
  '6aa95a9bc118772bff37fe49',
  '6aa95a9bc118772bff37fe4b',
  '6aa95a9bc118772bff37fe4c',
  '6aa95a9bc118772bff37fe4d',
  '6aa95a9bc118772bff37fe4e',
  '6aa966367bfe8227eadfb954',
  '6aa966367bfe8227eadfb955',
  '6aa966367bfe8227eadfb956',
  '6aa966367bfe8227eadfb957',
  '6aa966367bfe8227eadfb958',
]);

const NAMES = [{ re: /^cynthia$/i, label: 'Cynthia' }, { re: /^goodness$/i, label: 'Goodness' }, { re: /^progress$/i, label: 'Progress' }, { re: /^salom/i, label: 'Salome' }];

async function main() {
  if (!process.argv.includes("--apply")) throw new Error("Pass --apply to modify roles and appraisal answers");
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  await mongoose.connect(uri);

  const users = await User.find({ tenant: TENANT, firstName: { $in: NAMES.map((n) => n.re) } }).lean();
  const report = [];

  for (const u of users) {
    const label = NAMES.find((n) => n.re.test(u.firstName))?.label || u.firstName;
    const apps = await Appraisal.find({ tenant: TENANT, cycle: CYCLE_ID, employee: u._id })
      .select('_id state department roles').lean();
    if (!apps.length) {
      report.push({ label, user: String(u._id), noAppraisal: true });
      continue;
    }

    const oldRoles = (u.roles || []).map(String).join(',') || '(none)';
    await User.updateOne({ _id: u._id, tenant: TENANT }, { $set: { department: SALES_DEPT, roles: [CASHIER_ROLE] } });

    let droppedTotal = 0;
    const droppedQB = new Set();
    for (const a of apps) {
      await Appraisal.updateOne(
        { _id: a._id, tenant: TENANT },
        { $set: { department: SALES_DEPT, roles: [CASHIER_ROLE] } }
      );
      const fbs = await AppraisalFeedback.find({ tenant: TENANT, appraisal: a._id }).select('_id kind status answers').lean();
      for (const fb of fbs) {
        const drop = (fb.answers || []).filter((x) => !CASHIER_QS.has(String(x.questionId)));
        const answersByQ = {};
        (fb.answers || []).forEach((x) => { answersByQ[String(x.questionId)] = x; });
        if (drop.length) {
          const remaining = (fb.answers || []).filter((x) => CASHIER_QS.has(String(x.questionId)));
          await AppraisalFeedback.updateOne(
            { _id: fb._id, tenant: TENANT },
            { $set: { answers: remaining, status: 'pending' } }
          );
          droppedTotal += drop.length;
          drop.forEach((x) => droppedQB.add(String(x.questionId)));
        }
      }
    }

    report.push({
      label,
      user: String(u._id),
      oldRoles,
      appraisal: apps.map((a) => String(a._id)),
      droppedAnswers: droppedTotal,
      droppedQuestionIds: [...droppedQB],
    });
  }

  console.log(JSON.stringify(report, null, 2));
  await mongoose.disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });