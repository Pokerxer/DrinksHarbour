/* READ-ONLY. Rates every employee in the cycle from their stored answers. */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const mongoose = require('mongoose');
const AppraisalCycle = require('../models/AppraisalCycle');
const AppraisalTemplate = require('../models/AppraisalTemplate');
const Appraisal = require('../models/Appraisal');
const AppraisalFeedback = require('../models/AppraisalFeedback');
const User = require('../models/User');
const Department = require('../models/Department');
const { filterSections, scoreAppraisal } = require('../services/appraisal.helpers');

const sid = (v) => (v == null ? '' : String(v));

// The codebase's own band thresholds (services/attendanceRating.helpers.js).
const band = (pct) => {
  if (pct === null) return '—';
  if (pct >= 90) return 'Excellent';
  if (pct >= 75) return 'Good';
  if (pct >= 60) return 'Fair';
  return 'Needs attention';
};

// finalRating on the Appraisal model is 0..10, which is what HR writes at
// summarise time. Offered as a suggestion, not written by this script.
const outOfTen = (pct) => (pct === null ? null : Math.round((pct / 10) * 10) / 10);

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const cycle = await AppraisalCycle.findOne({ name: /Wyn City - Aug 2026$/i }).lean();
  const tpl = await AppraisalTemplate.findById(cycle.template).lean();
  const depts = await Department.find({}).lean();
  const dname = new Map(depts.map((d) => [sid(d._id), d.name]));

  const appraisals = await Appraisal.find({ cycle: cycle._id }).lean();
  const rows = await AppraisalFeedback.find({ cycle: cycle._id }).lean();
  const byAppraisal = new Map();
  for (const r of rows) {
    const k = sid(r.appraisal);
    if (!byAppraisal.has(k)) byAppraisal.set(k, []);
    byAppraisal.get(k).push(r);
  }

  const nm = (u) => `${u?.firstName || ''} ${u?.lastName || ''}`.trim() || u?.email || '??';
  const out = [];

  for (const a of appraisals) {
    const emp = await User.findById(a.employee, 'firstName lastName email').lean();
    const mgr = await User.findById(a.manager, 'firstName lastName email').lean();
    const fb = byAppraisal.get(sid(a._id)) || [];

    const score = (kind) => {
      const sections = filterSections(tpl.sections, {
        kind, departmentId: a.department, roleIds: a.roles,
      });
      return scoreAppraisal(sections, fb, { kind });
    };

    const self = score('self');
    const manager = score('manager');
    const peer = score('peer');

    out.push({
      employee: nm(emp),
      dept: dname.get(sid(a.department)) || '—',
      manager: nm(mgr),
      self,
      mgr: manager,
      peer,
      selfRow: fb.find((f) => f.kind === 'self'),
      mgrRow: fb.find((f) => f.kind === 'manager'),
    });
  }

  // Manager score is the rating of record; self is the comparison.
  out.sort((x, y) => {
    if (x.mgr.pct === null && y.mgr.pct === null) return x.employee.localeCompare(y.employee);
    if (x.mgr.pct === null) return 1;
    if (y.mgr.pct === null) return -1;
    return y.mgr.pct - x.mgr.pct;
  });

  console.log(`CYCLE: ${cycle.name}  [${cycle.status}]\n`);
  console.log(
    'EMPLOYEE'.padEnd(20) + 'DEPARTMENT'.padEnd(26) + 'MANAGER'.padEnd(22) +
    'MGR%'.padEnd(8) + 'SELF%'.padEnd(8) + 'GAP'.padEnd(8) + '/10'.padEnd(6) + 'BAND'
  );
  console.log('-'.repeat(115));
  for (const r of out) {
    const gap = r.mgr.pct !== null && r.self.pct !== null
      ? (r.self.pct - r.mgr.pct).toFixed(1).padStart(5)
      : '    —';
    console.log(
      r.employee.padEnd(20) + r.dept.padEnd(26) + r.manager.padEnd(22) +
      String(r.mgr.pct ?? '—').padEnd(8) +
      String(r.self.pct ?? '—').padEnd(8) +
      `${gap}   ` +
      String(outOfTen(r.mgr.pct) ?? '—').padEnd(6) +
      band(r.mgr.pct)
    );
  }

  console.log('\n\nCOMPLETENESS');
  const missingMgr = out.filter((r) => r.mgr.pct === null);
  const missingSelf = out.filter((r) => r.self.pct === null);
  console.log(`  rated by manager: ${out.length - missingMgr.length}/${out.length}`);
  console.log(`  self-assessed:    ${out.length - missingSelf.length}/${out.length}`);
  if (missingMgr.length) {
    console.log('\n  AWAITING MANAGER ASSESSMENT:');
    for (const r of missingMgr) {
      console.log(`    ${r.employee.padEnd(20)} manager=${r.manager.padEnd(22)} row=${r.mgrRow?.status || 'none'}`);
    }
  }
  if (missingSelf.length) {
    console.log('\n  AWAITING SELF-ASSESSMENT:');
    for (const r of missingSelf) {
      console.log(`    ${r.employee.padEnd(20)} row=${r.selfRow?.status || 'none'}`);
    }
  }

  const rated = out.filter((r) => r.mgr.pct !== null);
  if (rated.length) {
    const mean = rated.reduce((s, r) => s + r.mgr.pct, 0) / rated.length;
    console.log(`\n  mean manager score across the ${rated.length} rated: ${mean.toFixed(1)}%`);
    const counts = {};
    rated.forEach((r) => { const b = band(r.mgr.pct); counts[b] = (counts[b] || 0) + 1; });
    console.log('  distribution:', JSON.stringify(counts));
  }

  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
