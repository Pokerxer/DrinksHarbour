/**
 * READ-ONLY. Exports the cycle's ratings to an .xlsx workbook.
 *
 * Every number is recomputed from the stored answers here rather than copied
 * from the terminal report, so the workbook cannot drift from the database.
 * Four sheets: the ratings, the people still unrated, per-rater severity, and
 * the full per-question answer detail.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const mongoose = require('mongoose');
const AppraisalCycle = require('../models/AppraisalCycle');
const AppraisalTemplate = require('../models/AppraisalTemplate');
const Appraisal = require('../models/Appraisal');
const AppraisalFeedback = require('../models/AppraisalFeedback');
const User = require('../models/User');
const Department = require('../models/Department');
const { filterSections, scoreAppraisal } = require('../services/appraisal.helpers');

const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, '..', '..', '.backups');
const OUT = process.argv.find((a) => a.endsWith('.xlsx'))
  || path.join(__dirname, '..', '..', 'Wyn City Appraisal Ratings - Aug 2026.xlsx');

const sid = (v) => (v == null ? '' : String(v));
const nm = (u) => `${u?.firstName || ''} ${u?.lastName || ''}`.trim() || u?.email || '';

// The codebase's own band thresholds (services/attendanceRating.helpers.js).
const band = (pct) => {
  if (pct === null || pct === undefined) return '';
  if (pct >= 90) return 'Excellent';
  if (pct >= 75) return 'Good';
  if (pct >= 60) return 'Fair';
  return 'Needs attention';
};

// Blank, not 0 — "not rated" and "rated zero" are different facts, and a 0 in a
// spreadsheet column will be averaged by whoever opens it.
const num = (v) => (v === null || v === undefined ? '' : v);

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const cycle = await AppraisalCycle.findOne({ name: /Wyn City - Aug 2026$/i }).lean();
  const v3 = await AppraisalTemplate.findById(cycle.template).lean();
  const v2 = await AppraisalTemplate.findOne({ family: v3.family, version: 2 }).lean();
  const dname = new Map((await Department.find({}).lean()).map((d) => [sid(d._id), d.name]));

  const appraisals = await Appraisal.find({ cycle: cycle._id }).lean();
  const rows = await AppraisalFeedback.find({ cycle: cycle._id }).lean();
  const users = new Map((await User.find({}, 'firstName lastName email').lean()).map((u) => [sid(u._id), u]));

  const fbByAppraisal = new Map();
  for (const r of rows) {
    const k = sid(r.appraisal);
    if (!fbByAppraisal.has(k)) fbByAppraisal.set(k, []);
    fbByAppraisal.get(k).push(r);
  }

  // Answers archived by today's 5-question cut. Keyed by appraisal+reviewer so
  // a recovered score can stand in where the live row was reset to pending.
  const archived = new Map();
  if (fs.existsSync(BACKUP_DIR)) {
    for (const f of fs.readdirSync(BACKUP_DIR)) {
      if (!f.endsWith('.json')) continue;
      const doc = JSON.parse(fs.readFileSync(path.join(BACKUP_DIR, f), 'utf8'));
      for (const r of Array.isArray(doc) ? doc : doc.staleRows || []) {
        if ((r.answers || []).length) archived.set(`${sid(r.appraisal)}:${r.kind}`, r);
      }
    }
  }

  const rated = [];
  const unrated = [];
  const detail = [];

  for (const a of appraisals) {
    const emp = users.get(sid(a.employee));
    const mgr = users.get(sid(a.manager));
    const dept = dname.get(sid(a.department)) || '';
    const fb = fbByAppraisal.get(sid(a._id)) || [];

    const scoreOf = (tpl, kind, feedback) => {
      const sections = filterSections(tpl.sections, { kind, departmentId: a.department, roleIds: a.roles });
      return { ...scoreAppraisal(sections, feedback, { kind }), asked: sections.reduce((n, s) => n + s.questions.length, 0) };
    };

    const self = scoreOf(v3, 'self', fb);
    let managerScore = scoreOf(v3, 'manager', fb);
    let source = 'current';

    // Fall back to the archived pre-cut answers only where the live row has
    // nothing — never override a real current rating with a historical one.
    if (managerScore.pct === null && archived.has(`${sid(a._id)}:manager`)) {
      const arch = archived.get(`${sid(a._id)}:manager`);
      managerScore = scoreOf(v2, 'manager', [{ ...arch, status: 'submitted' }]);
      source = arch.status === 'submitted' ? 'recovered (pre-cut)' : 'recovered (partial draft)';
    }

    const gap = managerScore.pct !== null && self.pct !== null
      ? Math.round((self.pct - managerScore.pct) * 10) / 10 : null;

    const record = {
      Employee: nm(emp),
      Department: dept,
      'Rated by': nm(mgr),
      'Manager %': num(managerScore.pct),
      'Self %': num(self.pct),
      'Gap (self − mgr)': num(gap),
      'Rating /10': managerScore.pct === null ? '' : Math.round(managerScore.pct) / 10,
      Band: band(managerScore.pct),
      'Questions answered': managerScore.pct === null ? '' : `${managerScore.counted}/${managerScore.asked}`,
      Source: managerScore.pct === null ? '' : source,
    };

    if (managerScore.pct === null) {
      const mrow = fb.find((f) => f.kind === 'manager');
      const srow = fb.find((f) => f.kind === 'self');
      unrated.push({
        Employee: nm(emp),
        Department: dept,
        'Rated by': nm(mgr),
        'Self %': num(self.pct),
        'Manager row': mrow ? mrow.status : 'none',
        'Self row': srow ? srow.status : 'none',
        'Manager questions to answer': scoreOf(v3, 'manager', []).asked,
      });
    } else {
      rated.push(record);
    }

    // Per-question detail, for anyone who wants to see behind a score.
    for (const kind of ['self', 'manager']) {
      const live = fb.find((f) => f.kind === kind && (f.answers || []).length);
      const arch = archived.get(`${sid(a._id)}:${kind}`);
      const row = live || arch;
      if (!row) continue;
      const tpl = live ? v3 : v2;
      const byId = new Map();
      filterSections(tpl.sections, { kind, departmentId: a.department, roleIds: a.roles })
        .forEach((s) => s.questions.forEach((q) => byId.set(sid(q._id), { section: s.title, q })));
      for (const ans of row.answers || []) {
        const hit = byId.get(sid(ans.questionId));
        if (!hit) continue;
        detail.push({
          Employee: nm(emp),
          Department: dept,
          Reviewer: nm(users.get(sid(row.reviewer))),
          Kind: kind,
          Section: hit.section,
          Question: hit.q.label,
          Score: num(ans.rating),
          'Out of': hit.q.scaleMax ?? 5,
          Answer: (ans.selected || []).join('; ') || (typeof ans.rating === 'number' && hit.q.options?.length
            ? hit.q.options[(hit.q.optionScores || []).indexOf(ans.rating)] || '' : ''),
          Note: ans.comment || '',
        });
      }
    }
  }

  rated.sort((x, y) => y['Manager %'] - x['Manager %']);
  rated.forEach((r, i) => { r.Rank = i + 1; });
  const ratedOrdered = rated.map((r) => ({ Rank: r.Rank, ...r }));

  // Rater severity — the mean each manager awards. Ranking across departments
  // is only meaningful next to this.
  const byRater = new Map();
  for (const r of rated) {
    if (!byRater.has(r['Rated by'])) byRater.set(r['Rated by'], []);
    byRater.get(r['Rated by']).push(r['Manager %']);
  }
  const severity = [...byRater.entries()]
    .map(([rater, xs]) => ({
      'Rated by': rater,
      'People rated': xs.length,
      'Mean awarded %': Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 10) / 10,
      'Lowest %': Math.min(...xs),
      'Highest %': Math.max(...xs),
    }))
    .sort((a, b) => b['Mean awarded %'] - a['Mean awarded %']);

  const wb = XLSX.utils.book_new();
  const add = (name, data, widths) => {
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = widths.map((w) => ({ wch: w }));
    if (data.length) ws['!autofilter'] = { ref: ws['!ref'] };
    ws['!freeze'] = { xSplit: 0, ySplit: 1 };
    XLSX.utils.book_append_sheet(wb, ws, name);
  };

  add('Ratings', ratedOrdered, [6, 20, 26, 24, 11, 9, 17, 11, 17, 20, 20]);
  add('Not yet rated', unrated, [20, 26, 24, 9, 14, 12, 28]);
  add('Rater severity', severity, [24, 14, 16, 11, 12]);
  add('Answer detail', detail, [20, 26, 24, 9, 30, 42, 8, 8, 60, 30]);

  XLSX.writeFile(wb, OUT);
  console.log(`Written: ${OUT}`);
  console.log(`  Ratings:       ${ratedOrdered.length} rows`);
  console.log(`  Not yet rated: ${unrated.length} rows`);
  console.log(`  Rater severity:${severity.length} rows`);
  console.log(`  Answer detail: ${detail.length} rows`);

  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
