/**
 * Follow-up to apply-chukwuma-5q-manager-form.js.
 *
 * That script reset only CHUKWUMA's stale manager row, because the question put
 * to the user was about his form. But the cut lands on three DEPARTMENT forms,
 * so it also stranded the other managers who appraise into those departments:
 *
 *   - Chisom Okpala -> Janice, Rejoice   (submitted, 20 answers each)
 *   - Mercy         -> Victor            (pending, 7 draft answers)
 *
 * Both states are dead ends rather than cosmetic problems. A submitted row can
 * never be reopened (appraisalFeedback.controller.js rejects save/submit/decline
 * on anything not 'pending'), so those two appraisals would score `null` for
 * ever. And a pending row holding answers to questions no longer asked of the
 * reviewer is rejected at submit — "Answers were submitted for question id(s)
 * not asked of this reviewer" — so Mercy could not finish Victor's either.
 *
 * Resetting is the only route back to a completable cycle. Every answer removed
 * is written to the backup file first, so the original scores stay recoverable.
 *
 * Dry run by default. Pass --apply to write.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const AppraisalCycle = require('../models/AppraisalCycle');
const AppraisalTemplate = require('../models/AppraisalTemplate');
const Appraisal = require('../models/Appraisal');
const AppraisalFeedback = require('../models/AppraisalFeedback');
const User = require('../models/User');
const { filterSections } = require('../services/appraisal.helpers');

const APPLY = process.argv.includes('--apply');
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, '..', '..', '.backups');
const sid = (v) => (v == null ? '' : String(v));

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const cycle = await AppraisalCycle.findOne({ name: /Wyn City - Aug 2026$/i }).lean();
  const tpl = await AppraisalTemplate.findById(cycle.template).lean();
  const appraisals = await Appraisal.find({ cycle: cycle._id }).lean();
  const byId = new Map(appraisals.map((a) => [sid(a._id), a]));

  // Anything holding an answer the reviewer is no longer asked. Derived from
  // the template rather than from a hardcoded list of names, so this stays
  // correct if the cut is ever widened to another department.
  const rows = await AppraisalFeedback.find({ cycle: cycle._id }).lean();
  const stale = [];
  for (const r of rows) {
    if (!(r.answers || []).length) continue;
    const a = byId.get(sid(r.appraisal));
    const asked = new Set();
    filterSections(tpl.sections, { kind: r.kind, departmentId: a.department, roleIds: a.roles })
      .forEach((s) => s.questions.forEach((q) => asked.add(sid(q._id))));
    const orphaned = r.answers.filter((ans) => !asked.has(sid(ans.questionId)));
    if (orphaned.length) stale.push({ row: r, orphaned: orphaned.length });
  }

  console.log(`Rows holding answers their reviewer is no longer asked: ${stale.length}\n`);
  for (const { row, orphaned } of stale) {
    const a = byId.get(sid(row.appraisal));
    const rev = await User.findById(row.reviewer, 'firstName lastName').lean();
    const emp = await User.findById(a.employee, 'firstName lastName').lean();
    const nm = (u) => `${u?.firstName || ''} ${u?.lastName || ''}`.trim();
    console.log(
      `  ${nm(rev).padEnd(22)} -> ${nm(emp).padEnd(18)} ${row.kind.padEnd(7)} status=${row.status.padEnd(10)} answers=${row.answers.length} orphaned=${orphaned}`
    );
  }

  if (!stale.length) {
    console.log('\nNothing to reset.');
    return mongoose.disconnect();
  }
  if (!APPLY) {
    console.log('\nDRY RUN — nothing written. Re-run with --apply.');
    return mongoose.disconnect();
  }

  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const backupPath = path.join(BACKUP_DIR, `stale-manager-rows-${sid(cycle._id)}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(stale.map((s) => s.row), null, 2));
  console.log(`\nBackup written: ${backupPath}`);

  for (const { row } of stale) {
    await AppraisalFeedback.updateOne(
      { _id: row._id },
      { $set: { status: 'pending', answers: [] }, $unset: { submittedAt: 1 } }
    );
  }
  console.log(`APPLIED. ${stale.length} rows reset to pending with answers cleared.`);

  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
