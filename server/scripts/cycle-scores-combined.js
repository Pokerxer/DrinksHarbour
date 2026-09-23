require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const mongoose = require('mongoose');
const User = require('../models/User');
const Appraisal = require('../models/Appraisal');
const AppraisalFeedback = require('../models/AppraisalFeedback');
const AppraisalCycle = require('../models/AppraisalCycle');
const AppraisalTemplate = require('../models/AppraisalTemplate');
const { filterSections, scoreAppraisal } = require('../services/appraisal.helpers');

const CYCLE_ID = '6aa962e0d7a3d8d63f24923f';
const TENANT = '699165839f3308b1baeca8fc';

async function main() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  await mongoose.connect(uri);
  const cycle = await AppraisalCycle.findOne({ _id: CYCLE_ID }).select('template').lean();
  const t = await AppraisalTemplate.findOne({ _id: cycle.template, tenant: TENANT }).lean();

  const apps = await Appraisal.find({ tenant: TENANT, cycle: CYCLE_ID })
    .select('employee department roles manager state').lean();

  const rows = [];
  for (const a of apps) {
    const emp = await User.findById(a.employee).select('firstName lastName').lean();
    const mgr = a.manager ? await User.findById(a.manager).select('firstName lastName').lean() : null;
    const fbs = await AppraisalFeedback.find({ tenant: TENANT, appraisal: a._id })
      .select('kind status answers').lean();

    const sectionsByKind = {};
    for (const kind of ['self', 'manager']) {
      sectionsByKind[kind] = filterSections(t.sections, { kind, departmentId: a.department, roleIds: a.roles });
    }

    const self = scoreAppraisal(sectionsByKind.self, fbs, { kind: 'self' });
    const mgrScore = scoreAppraisal(sectionsByKind.manager, fbs, { kind: 'manager' });

    const earned = (self.earned || 0) + (mgrScore.earned || 0);
    const possible = (self.possible || 0) + (mgrScore.possible || 0);
    const combinedPct = possible > 0 ? Math.round((earned / possible) * 1000) / 10 : null;

    rows.push({
      name: `${emp?.firstName ?? '?'} ${emp?.lastName ?? ''}`.trim(),
      manager: `${mgr?.firstName ?? ''} ${mgr?.lastName ?? ''}`.trim() || '—',
      self: self.pct,
      managerScore: mgrScore.pct,
      combined: combinedPct,
      raw: `${earned}/${possible}`,
    });
  }

  rows.sort((x, y) => (y.combined ?? -1) - (x.combined ?? -1));
  console.log('name | manager | grade | combined% | self% | manager% | raw');
  for (const r of rows) {
    console.log(`${r.name} | ${r.manager} | ${gradeOf(r.combined)} | ${r.combined ?? '—'} | ${r.self ?? '—'} | ${r.managerScore ?? '—'} | ${r.raw}`);
  }
  await mongoose.disconnect();
}

function gradeOf(pct) {
  if (pct == null) return '—';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B';
  if (pct >= 60) return 'C';
  return 'D';
}

main().catch((e) => { console.error(e); process.exit(1); });