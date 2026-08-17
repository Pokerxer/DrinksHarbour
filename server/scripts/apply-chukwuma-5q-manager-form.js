/**
 * Cut Chukwuma's MANAGER form down to 5 consolidated questions per department,
 * for the "Scored Performance Assessment Wyn City - Aug 2026" cycle only.
 *
 * WHY IT IS SHAPED THIS WAY
 *
 * Template sections are scoped by the SUBJECT'S DEPARTMENT (filterSections in
 * services/appraisal.helpers.js), never by who is doing the appraising. So
 * "only Chukwuma's questions" is expressed as "the department forms his five
 * subjects sit in": Management, Digital Marketing & Sales, and Warehouse.
 *
 * Two constraints drive every choice below:
 *
 *  1. The same 20 questions are ALSO the self-assessment, and several people
 *     have already submitted answers against them. So the questions are NOT
 *     deleted — 'manager' is stripped from their `askOf`, leaving them
 *     self-only. Every question _id survives verbatim, so every stored self
 *     answer still resolves.
 *
 *  2. Template v2 is pinned by TWO live cycles in this tenant. Editing it in
 *     place would rewrite the other one too, so this forks a new version and
 *     repoints ONLY the Wyn City cycle. The fork is deliberately NOT isLatest:
 *     the family's latest must stay v2 so the admin editor and any future
 *     cycle keep seeing the standard 20-question form.
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
const Department = require('../models/Department');
const User = require('../models/User');
const { filterSections } = require('../services/appraisal.helpers');

const APPLY = process.argv.includes('--apply');
const CYCLE_NAME = /^Scored Performance Assessment Wyn City - Aug 2026$/i;
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, '..', '..', '.backups');

const sid = (v) => (v == null ? '' : String(v));

// AppraisalTemplate's own caps. Asserted here rather than discovered at
// create time: a validation error surfaces as forty stack traces naming
// `sections.29.questions.4.options.3`, which says nothing about WHICH anchor
// is too long. Checked in dry run too — a dry run that cannot fail the way the
// real run fails is not a rehearsal.
const MAX_OPTION = 200;
const MAX_LABEL = 300;

// A consolidated question, in the same house style as the ones it replaces:
// likert, five behavioural anchors, best first, scored 5..1.
const q = (label, anchors) => {
  if (label.length > MAX_LABEL) {
    throw new Error(`Label ${label.length} > ${MAX_LABEL}: ${label}`);
  }
  if (anchors.length !== 5) {
    throw new Error(`"${label}" has ${anchors.length} anchors, expected 5`);
  }
  anchors.forEach((a, i) => {
    if (a.length > MAX_OPTION) {
      throw new Error(`"${label}" anchor ${i + 1} is ${a.length} chars (max ${MAX_OPTION}): ${a}`);
    }
  });
  return {
    type: 'likert',
    label,
    required: true,
    scaleMax: 5,
    options: anchors,
    // Distinct by construction, which validateOptionScores requires.
    optionScores: [5, 4, 3, 2, 1],
    askOf: ['manager'],
  };
};

// The replacement forms, keyed by department NAME. Each set of five covers all
// twenty themes of the department form it replaces; the mapping is recorded in
// the comment above each question so a later reader can check the coverage
// without diffing against the old template.
const NEW_FORMS = {
  Management: [
    // Leadership & Team Mgmt + Staff Supervision + Staff Development & Coaching
    // + Staff Scheduling & Attendance Mgmt + Discipline & Policy Enforcement
    q('Leadership, Supervision & Team Development', [
      'Clear direction and willing effort; rota covered, standards hold whether or not they are present, policy applied consistently to everyone, and staff visibly improve',
      'Leads and supervises effectively; the team knows what is expected, rules are enforced reliably, and useful feedback is given',
      'Manages the day to day, but standards slip without direct presence, and development and enforcement are uneven',
      'Team lacks direction; lateness, absence and rule-breaking go unchallenged and staff stagnate',
      'Leadership is absent or demotivating; nothing is supervised, developed or enforced',
    ]),
    // Sales Performance + Customer Service Mgmt + Product Knowledge + Merchandising & Store Standards
    q('Sales, Customer Service & Store Standards', [
      'Targets consistently met or exceeded, service standards enforced and escalations fully resolved, authoritative across the range, and the store always well presented',
      'Targets met in most periods; good service and presentation standards, strong product knowledge',
      'Around target only when conditions are favourable; handles escalations but does not drive standards, and presentation slips without reminders',
      'Below target more often than not; complaints recur, product knowledge is thin, and presentation is regularly below standard',
      'Sustained underperformance; customer experience and store standards are poor enough to cost sales',
    ]),
    // Stock & Inventory Control + Loss & Shrinkage Control + Cash & Financial Control
    q('Stock, Cash & Loss Control', [
      'Stock known and controlled at all times, losses minimal with every incident followed through, cash procedures enforced without exception, and reconciliations clean and timely',
      'Stock monitored and issues addressed; losses low and investigated; cash controls sound with discrepancies rare and resolved',
      'Monitored periodically; stock problems and losses addressed only once obvious, and cash controls not consistently enforced',
      'Little effective control; discrepancies accumulate, and unexplained losses and recurring cash shortfalls persist',
      'Stock, losses and cash are effectively unmanaged',
    ]),
    // Problem Solving & Decision Making + Initiative & Proactiveness + Operational Efficiency
    q('Decision Making, Initiative & Operational Efficiency', [
      'Decisive and sound; problems resolved at the right level, opportunities and risks acted on before being raised, and operations run smoothly because problems are anticipated',
      'Makes good decisions and acts promptly, acts on clear needs unprompted, and runs the operation efficiently with minor friction',
      'Decides slowly or escalates what could be handled locally; raises issues but waits for instruction, and avoidable delays and rework persist',
      'Avoids decisions and acts only on direction; recurring operational problems go unresolved',
      'Poor decisions and inaction create further problems; operations are disorganised',
    ]),
    // Communication + Reporting & Documentation + Integrity & Accountability
    // + Punctuality/Attendance/Reliability + Overall Business Contribution
    q('Communication, Reporting, Integrity & Overall Contribution', [
      'Information flows both ways, reports accurate and on time with the meaning drawn out, outcomes fully owned, attendance sets the standard, and contribution to growth is clear and evidenced',
      'Communicates clearly and promptly, reports accurate and on time, honest and accountable, reliable in attendance, and a solid positive contribution',
      'Communicates when asked and upward reporting is thin; reports need chasing, problems are not volunteered, and the position is held steady without improving it',
      'Poor communication leaves people uninformed; reporting late or incomplete, responsibility deflected, and lateness undermines their authority to enforce it',
      'Communication failures cause real problems, reports are not produced, results are concealed, and the role is a net drag on the business',
    ]),
  ],

  'Digital Marketing & Sales': [
    // Sales Target Achievement + Lead Generation + Lead Conversion
    q('Sales Targets, Lead Generation & Conversion', [
      'Consistently meets or exceeds target with growth sustained, on a steady flow of well-qualified leads sourced unprompted and followed through to purchase at a high rate',
      'Meets target in most periods; good lead volume, and reliable follow-up closes most serious enquiries',
      'Around target in the stronger months only; leads come in but many are unqualified, and only the easy enquiries convert',
      'Below target more often than not; few leads, mostly inbound, and enquiries are answered but rarely closed',
      'Well short of target with no recovery trend; little genuine lead generation and enquiries go cold without follow-up',
    ]),
    // Customer Acquisition + Customer Retention + Digital Enquiry Response + Upselling & Cross-Selling
    q('Customer Acquisition, Retention & Enquiry Handling', [
      'A measurable stream of new buyers, existing customers actively nurtured with visible repeat purchases, enquiries answered quickly and fully, and suitable additions routinely accepted',
      'New customers gained steadily, follow-up produces repeat business, enquiries prompt and helpful, and relevant complementary items regularly suggested',
      'Some new customers but mostly incidental; follow-up when convenient, enquiries answered eventually with thin detail, and extras suggested only when prompted',
      'Very few genuinely new customers, existing ones rarely contacted after the first sale, responses slow enough that customers chase, and rarely goes beyond the ask',
      'No measurable acquisition, no follow-up, enquiries regularly unanswered, and no attempt to upsell or unsuitable items pushed',
    ]),
    // Social Media Growth + Content Quality + Content Consistency + Audience Engagement + Campaign Performance
    q('Content Quality, Audience Growth & Campaign Performance', [
      'Sustained growth in a relevant audience on polished, on-brand work published exactly to calendar, provoking real interaction, with campaigns delivering measured results',
      'Audience grows steadily, content is of a good standard and almost always on schedule, engagement good and replies prompt, and campaigns generally achieve their aim',
      'Growth slow or in one channel only; content acceptable but formulaic with gaps in busy weeks, comments often unanswered, and campaign results mixed and unmeasured',
      'Audience flat despite activity; content rough or inconsistent and posting irregular, little interaction, and campaigns run but results weak or unmeasured',
      'Audience static or declining; content below the standard the brand can be seen with, posted only when remembered, no engagement, and campaigns deliver nothing',
    ]),
    // Product Knowledge + Creativity & Initiative + Brand Representation
    q('Product Knowledge, Creativity & Brand Representation', [
      'Deep, current knowledge advising on alternatives and pricing without checking, brings workable new ideas and follows them through, and is consistently on-brand across every channel',
      'Solid knowledge across the main range, contributes ideas regularly and acts on them once agreed, and represents the brand well with the occasional off-tone piece',
      'Knows the popular lines but unsure beyond them, will improve on an instruction but rarely originates anything, and brand voice drifts between posts',
      'Frequently has to check basics, works only to instruction, and is frequently off-brand in tone or presentation',
      'Weak enough to give customers wrong information, resists new approaches, and has published material that damaged how the business is seen',
    ]),
    // Marketing & Sales Reporting + Teamwork & Collaboration + Punctuality & Reliability
    // + Accountability & Use of Resources + Overall Business Contribution
    q('Reporting, Reliability, Teamwork & Overall Contribution', [
      'Reports accurate, on time and interpreted; coordinates with shop floor and management unasked; deadlines always met; spend documented and reconciled; clear contribution to revenue',
      'Reports accurate and on time, cooperates well and responds to requests, reliable with rare slips flagged early, resources used responsibly, and a solid positive contribution',
      'Reports need chasing or correcting, stays in own lane, deadlines need reminding, spend not always documented, and contribution modest or hard to evidence',
      'Reports late or incomplete and figures do not reconcile, coordination poor so others learn late, deadlines missed enough to disrupt plans, and little measurable contribution',
      'Reports not produced, creates friction or works around the team, unreliable on attendance and deadlines, resources unaccounted for, and no demonstrable contribution',
    ]),
  ],

  Warehouse: [
    // Inventory Accuracy + Stock Receiving Accuracy + Dispatch Accuracy + Stock Reconciliation
    q('Inventory Accuracy, Receiving, Dispatch & Reconciliation', [
      'Counts agree with the system consistently, every delivery checked in full before acceptance, outbound loads right every time, and scheduled counts documented and closed out',
      'Accurate with small variances resolved quickly, thorough checking on receipt, accurate dispatch with rare errors caught early, and regular counts properly recorded',
      'Broadly accurate but variances recur; quantities checked on receipt but not condition or batch, occasional wrong item or count, and count documentation thin or late',
      'Frequent discrepancies that take time to resolve, deliveries signed for after only a cursory look, dispatch errors customers notice, and counts irregular and poorly recorded',
      'System and physical stock cannot be relied on to agree, stock accepted without checking, regular wrong deliveries from picking, and no reliable reconciliation',
    ]),
    // Loss & Shrinkage Control + Breakage & Damage Control + Warehouse Security
    q('Loss, Damage & Security Control', [
      'Losses negligible with the controls preventing them visible, very little avoidable damage and every incident recorded with its cause, and access properly controlled throughout',
      'Shrinkage low and investigated when it occurs, damage low and incidents reported, and security procedures followed reliably',
      'Some unexplained loss addressed only once raised, occasional avoidable damage not always recorded, and procedures followed only when convenient',
      'Persistent unexplained shortages, regular poorly documented breakages, and loose access control that makes unauthorised entry possible',
      'Significant losses with no control or explanation, frequent damage often concealed, and security effectively absent',
    ]),
    // Stock Rotation + Storage Standards + Warehouse Organisation
    // + Stock Movement Documentation + System / Inventory Management
    q('Storage, Rotation, Organisation & Records', [
      'Rotation applied without exception and ageing stock caught early, everything stored and protected correctly, layout logical and labelled, and the system live and accurate',
      'Rotation followed and expiry monitored, storage sound, well organised with current labelling, movements recorded reliably, and the system updated promptly',
      'Rotation inconsistent across product groups, some products stored without regard to condition, layout relies on knowing where things are, and the system updated in batches',
      'Rotation often ignored and ageing stock accumulates, storage exposes stock to damage, disorganised so time is lost, and records reconstructed later',
      'No rotation discipline and expired stock reaches customers, storage conditions causing loss, no usable location system, and the system not maintained',
    ]),
    // Replenishment & Stock Availability + Warehouse Team Supervision + Safety & Housekeeping
    q('Stock Availability, Team Supervision & Safety', [
      'Shortages anticipated and prevented so the shop rarely runs out, duties clearly assigned and followed up, and the space consistently clean, clear and safe with hazards cleared at once',
      'Low stock flagged in good time, the team supervised effectively, and good housekeeping standards maintained',
      'Replenishment often only once stock is already short, supervision present but inconsistent, and aisles and hazards need prompting',
      'Stock-outs common and reactive, little effective oversight so work is left unchecked, and the area regularly cluttered or obstructed',
      'No monitoring, so shortages are found by the sales floor; no supervision and team performance drifts; and conditions present a genuine safety risk',
    ]),
    // Reporting + Problem Solving & Initiative + Communication & Coordination
    // + Integrity & Accountability + Overall Warehouse Performance
    q('Reporting, Initiative, Communication, Integrity & Overall Performance', [
      'Reports accurate, on time and flagging what needs attention; problems solved before reaching anyone else; teams informed ahead of need; discrepancies owned; the warehouse a clear asset',
      'Reports accurate and on time, acts on issues promptly, communicates clearly and responds quickly, owns errors, and the warehouse runs well with only minor issues',
      'Reports need chasing or correcting, raises problems but waits for direction, communicates only when asked, and the warehouse functions adequately but needs oversight',
      'Reports late or incomplete, problems noticed late after impact, poor coordination delaying others, responsibility deflected, and recurring problems disrupt other departments',
      'Reports not produced, problems ignored until escalated, communication breakdown affecting operations, stock misreported, and warehouse performance drags on the business',
    ]),
  ],
};

// The title the five consolidated questions sit under. Identical across the
// three departments because a form only ever shows one of them — they are
// department-scoped and cannot appear together.
const NEW_SECTION_TITLE = 'Overall Performance Assessment';

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const cycle = await AppraisalCycle.findOne({ name: CYCLE_NAME });
  if (!cycle) throw new Error('Cycle not found');

  const v2 = await AppraisalTemplate.findById(cycle.template).lean();
  if (!v2) throw new Error('Pinned template not found');
  if (v2.family == null) throw new Error('Template has no family — refusing to fork');

  const depts = await Department.find({ tenant: cycle.tenant }).lean();
  const deptIdByName = new Map(depts.map((d) => [d.name, sid(d._id)]));
  const deptNameById = new Map(depts.map((d) => [sid(d._id), d.name]));

  const targetNames = Object.keys(NEW_FORMS);
  for (const n of targetNames) {
    if (!deptIdByName.has(n)) throw new Error(`Department not found: ${n}`);
  }

  // --- Build the forked sections -------------------------------------------
  // Question _ids are carried over VERBATIM. They are the join key for every
  // stored answer (AppraisalFeedback.answers[].questionId), so reminting them
  // would orphan every self-assessment already submitted against this form.
  let stripped = 0;
  const sections = v2.sections.map((s) => {
    const names = (s.departments || []).map((d) => deptNameById.get(sid(d)));
    const isTarget = names.some((n) => targetNames.includes(n));
    if (!isTarget) return s;
    return {
      ...s,
      questions: (s.questions || []).map((qq) => {
        if (!(qq.askOf || []).includes('manager')) return qq;
        stripped += 1;
        return { ...qq, askOf: (qq.askOf || []).filter((k) => k !== 'manager') };
      }),
    };
  });

  for (const name of targetNames) {
    sections.push({
      title: NEW_SECTION_TITLE,
      departments: [new mongoose.Types.ObjectId(deptIdByName.get(name))],
      roles: [],
      questions: NEW_FORMS[name],
    });
  }

  // The next free version for this family. Computed as max+1 to match
  // updateTemplate's own fork logic, so a later UI edit cannot collide.
  const siblings = await AppraisalTemplate.find({ tenant: v2.tenant, family: v2.family })
    .select('version')
    .lean();
  const nextVersion = siblings.reduce((max, r) => Math.max(max, r.version || 0), 0) + 1;

  const forked = {
    tenant: v2.tenant,
    family: v2.family,
    version: nextVersion,
    // NOT the family's latest, deliberately — see the header note.
    isLatest: false,
    isDefault: false,
    name: v2.name,
    description: v2.description,
    isArchived: false,
    sections,
    createdBy: v2.createdBy,
  };

  // Chukwuma's already-submitted Warehouse assessment. Its answers point at
  // questions that are about to stop being asked of a manager, and a submitted
  // row can never be reopened (appraisalFeedback.controller.js rejects any
  // save/submit on a non-pending row) — so left alone it would score `null`
  // for ever with no way to redo it.
  const chukwuma = await User.findOne({ email: /chukwuma@wyncity/i }).lean();
  const cycleAppraisals = await Appraisal.find({ cycle: cycle._id }).lean();
  const staleRows = await AppraisalFeedback.find({
    appraisal: { $in: cycleAppraisals.map((a) => a._id) },
    reviewer: chukwuma._id,
    kind: 'manager',
    status: 'submitted',
  }).lean();

  console.log(`Template v${v2.version} -> forked v${nextVersion} (isLatest:false)`);
  console.log(`  'manager' stripped from ${stripped} existing questions across ${targetNames.join(', ')}`);
  console.log(`  ${targetNames.length} new sections appended, 5 questions each`);
  console.log(`  submitted rows of Chukwuma's to reset to pending: ${staleRows.length}`);

  if (!APPLY) {
    console.log('\nDRY RUN — nothing written. Re-run with --apply.');
    return mongoose.disconnect();
  }

  // --- Backup before writing ------------------------------------------------
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = cycle._id.getTimestamp().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(BACKUP_DIR, `chukwuma-5q-${stamp}.json`);
  fs.writeFileSync(
    backupPath,
    JSON.stringify({ templateV2: v2, cycleTemplateWas: sid(cycle.template), staleRows }, null, 2)
  );
  console.log(`\nBackup written: ${backupPath}`);

  const created = await AppraisalTemplate.create(forked);
  cycle.template = created._id;
  await cycle.save();

  for (const row of staleRows) {
    await AppraisalFeedback.updateOne(
      { _id: row._id },
      { $set: { status: 'pending', answers: [] }, $unset: { submittedAt: 1 } }
    );
  }

  console.log(`APPLIED. Cycle now pinned to template ${created._id} (v${nextVersion}).`);

  // --- Verify ---------------------------------------------------------------
  const check = await AppraisalTemplate.findById(created._id).lean();
  console.log('\n=== VERIFY: questions asked per appraisal in this cycle ===');
  for (const a of cycleAppraisals) {
    const mgr = filterSections(check.sections, { kind: 'manager', departmentId: a.department, roleIds: a.roles });
    const self = filterSections(check.sections, { kind: 'self', departmentId: a.department, roleIds: a.roles });
    const n = (ss) => ss.reduce((t, s) => t + s.questions.length, 0);
    console.log(
      `  ${(deptNameById.get(sid(a.department)) || 'NONE').padEnd(26)} manager=${String(n(mgr)).padEnd(3)} self=${n(self)}`
    );
  }

  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
