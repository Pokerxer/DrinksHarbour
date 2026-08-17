/* READ-ONLY. Scores the answers archived by the 5-question cut, against v2. */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const AppraisalCycle = require('../models/AppraisalCycle');
const AppraisalTemplate = require('../models/AppraisalTemplate');
const Appraisal = require('../models/Appraisal');
const User = require('../models/User');
const { filterSections, scoreAppraisal } = require('../services/appraisal.helpers');

const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, '..', '..', '.backups');
const sid = (v) => (v == null ? '' : String(v));

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const cycle = await AppraisalCycle.findOne({ name: /Wyn City - Aug 2026$/i }).lean();
  const v3 = await AppraisalTemplate.findById(cycle.template).lean();
  // The archived answers were written against v2, so they must be scored
  // against v2 — v3 no longer asks a manager any of those questions.
  const v2 = await AppraisalTemplate.findOne({ family: v3.family, version: 2 }).lean();

  const archived = [];
  for (const f of fs.readdirSync(BACKUP_DIR)) {
    if (!f.endsWith('.json')) continue;
    const doc = JSON.parse(fs.readFileSync(path.join(BACKUP_DIR, f), 'utf8'));
    const rows = Array.isArray(doc) ? doc : doc.staleRows || [];
    archived.push(...rows);
  }

  console.log('SCORES RECOVERED FROM THE ARCHIVED (PRE-CUT) ANSWERS\n');
  console.log(
    'EMPLOYEE'.padEnd(18) + 'RATED BY'.padEnd(24) + 'SCORE'.padEnd(9) + 'ANSWERED'.padEnd(11) + 'STATUS WAS'
  );
  console.log('-'.repeat(78));

  const seen = new Set();
  for (const row of archived) {
    if (!(row.answers || []).length) continue;
    const key = `${sid(row.appraisal)}:${sid(row.reviewer)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const a = await Appraisal.findById(row.appraisal).lean();
    const emp = await User.findById(a.employee, 'firstName lastName').lean();
    const rev = await User.findById(row.reviewer, 'firstName lastName').lean();
    const nm = (u) => `${u?.firstName || ''} ${u?.lastName || ''}`.trim();

    const sections = filterSections(v2.sections, {
      kind: row.kind, departmentId: a.department, roleIds: a.roles,
    });
    const asked = sections.reduce((n, s) => n + s.questions.length, 0);
    // scoreAppraisal only counts a row it considers submitted; the archived
    // pending row (Victor) is scored on the same basis so the partial total is
    // comparable, and flagged by its answered-count rather than hidden.
    const s = scoreAppraisal(sections, [{ ...row, status: 'submitted' }], { kind: row.kind });

    console.log(
      nm(emp).padEnd(18) + nm(rev).padEnd(24) +
      `${s.pct ?? '—'}%`.padEnd(9) +
      `${s.counted}/${asked}`.padEnd(11) +
      row.status
    );
  }

  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
