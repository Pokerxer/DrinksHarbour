/**
 * Create the Facilities "Cleaner Performance Assessment" — a scored rating
 * sheet built on scored anchors.
 *
 * WHAT MAKES THIS FORM DIFFERENT
 * ------------------------------
 * Every question is an ordinal `likert` with five BEHAVIOURAL DESCRIPTIONS in
 * `options` and the points each is worth in `optionScores`. The rater reads
 * the descriptions and picks one; the score is stored as an ordinary `rating`
 * and is never rendered to them (ScoredOptionsField in
 * review-question-card.tsx renders no number, and formatAnswer reads the
 * answer back as the chosen wording rather than "4 of 5").
 *
 * Hiding the weight is the point, not decoration: a rater who can see that one
 * option is worth 5 and the next 4 answers the number, not the behaviour.
 *
 * The scores are what `scoreAppraisal` (services/appraisal.helpers.js) totals
 * into the appraisal's final mark. 20 criteria x 5 points = 100 available,
 * with a floor of 20 — every anchor is worth at least 1, so the sheet has no
 * "zero" verdict, matching the source document.
 *
 * WHY THE ANCHORS ARE WORDED WITHOUT NAMING A PERSON
 * --------------------------------------------------
 * Each question is asked of BOTH `self` and `manager`, and one label serves
 * every kind (nothing rewrites wording per reviewer — see
 * fix-appraisal-template-person-wording.js). So an anchor saying "this
 * cleaner" would be wrong on the employee's own form. Every anchor here is
 * person-neutral and reads correctly as both a self-assessment and a review.
 *
 * Peers are not asked. These are supervisor-observable criteria, and a scored
 * peer rating is exactly what PEER_EVIDENCE_QUESTIONS exists to avoid.
 *
 * Creates a NEW family. It does not touch "360° Feedback v3", which stays the
 * tenant's general instrument.
 *
 * Usage:
 *   node scripts/create-cleaner-scored-template.js            # dry run
 *   node scripts/create-cleaner-scored-template.js --apply    # write
 *
 * Writes nothing without --apply. Idempotent: refuses to create a second copy
 * if a live template of the same name already exists.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const mongoose = require('mongoose');
const AppraisalTemplate = require('../models/AppraisalTemplate');
const { validateTemplateShape } = require('../controllers/appraisalTemplate.controller');

const APPLY = process.argv.includes('--apply');
const TENANT = '699165839f3308b1baeca8fc';
const FACILITIES = '6a77b54786eb9115f01c8844';
const NAME = 'Cleaner Performance Assessment';

/** [criterion, helpText, [5, 4, 3, 2, 1] anchors] */
const CRITERIA = [
  ['Reliability & Presentation', [
    ['Punctuality', 'Reporting for duty and starting work at the scheduled time.', [
      'Ready to start at the scheduled time on effectively every shift; no reminders needed',
      'On time for almost all shifts; rare lateness communicated in advance',
      'Generally on time, but late often enough to be noticed',
      'Late regularly, or on time but not ready to start work',
      'Frequently late without notice, and it continues after being raised',
    ]],
    ['Attendance & Reliability', 'Consistent attendance and dependable availability.', [
      'Present for every scheduled shift; absences rare, planned and properly notified',
      'Good attendance; occasional absence, always notified in good time',
      'Attendance acceptable, but notice is often short',
      'Absences frequent enough to disrupt cover',
      "Absent without notice often enough that the rota can't be relied on",
    ]],
    ['Personal Hygiene & Appearance', 'Personal cleanliness, uniform and presentation on duty.', [
      'Always clean, neatly turned out, correct uniform/PPE at the start of every shift',
      'Generally well presented; occasional lapse in uniform or grooming',
      'Acceptable, but uniform or grooming needs occasional prompting',
      'Presentation inconsistent, or uniform/PPE often incomplete',
      'Falls below what the role requires and has had to be formally raised',
    ]],
  ]],
  ['Cleaning Quality', [
    ['Quality of Cleaning', 'The overall standard achieved across assigned areas.', [
      'Assigned areas consistently spotless; passes inspection without follow-up',
      'Clean to standard; minor touch-ups occasionally needed',
      'Meets standard in most areas, but not reliably across all of them',
      'Standard varies by shift or area; re-cleaning regularly required',
      'Routinely left below standard and must be redone by someone else',
    ]],
    ['Attention to Detail', 'Noticing and cleaning areas that are easily overlooked.', [
      'Corners, skirting, high surfaces and under furniture done without being asked',
      'Detail work generally thorough; the odd overlooked spot',
      'Does detail work when prompted, but does not seek it out',
      'Obvious areas done, less visible ones regularly missed',
      'Only what is in plain sight gets cleaned; hidden areas consistently skipped',
    ]],
    ['Floor Cleaning & Maintenance', 'Sweeping, mopping and keeping floors presentable.', [
      'Swept, mopped and dry, with no streaks, marks or missed edges',
      'Clean to standard; minor streaking or edges occasionally missed',
      'Generally acceptable, but edges and corners are often left',
      'Condition varies; re-mopping or spot-cleaning often needed',
      'Routinely left dirty, streaked or wet without being finished',
    ]],
    ['Toilet & Washroom Cleanliness', 'Hygiene and supply levels in washrooms.', [
      'Hygienic and fully stocked at every check, including peak hours',
      'Clean and stocked; supplies occasionally run low before being noticed',
      'Clean at the scheduled rounds, but not checked between them',
      'Cleanliness or stock slips noticeably during the shift',
      'Regularly found unclean or unstocked, and complaints have resulted',
    ]],
    ['Dust & Surface Cleaning', 'Shelves, counters, furniture and other non-floor surfaces.', [
      'Shelves, counters, furniture and fittings dust-free, high and low',
      'Generally clean; occasional dust on less-used fittings',
      'Main surfaces kept clean, but high and low fittings are missed',
      'Visible surfaces wiped, but dust builds on ledges or behind stock',
      'Routinely left dusty or sticky and has to be redone',
    ]],
  ]],
  ['Work Management', [
    ['Waste Disposal', 'Emptying bins promptly and disposing of waste correctly.', [
      'Bins emptied before overflowing, liners replaced, waste taken to the correct point every time',
      'Handled properly; bins occasionally left slightly over',
      'Bins emptied on schedule, but not checked in between',
      'Bins emptied late, or waste left at collection points too long',
      'Left overflowing or disposed of in the wrong place, creating hygiene issues',
    ]],
    ['Cleaning Frequency', 'Maintaining standards across the shift, not only at open and close.', [
      'Areas checked and maintained throughout the shift, not just at open and close',
      'Regular checks happen; occasionally a busy period passes',
      'Checks happen, but only when the shift is quiet',
      'Concentrated at start and end of shift; mid-shift standards drop',
      'Cleaned once and left, so standards have visibly fallen by mid-shift',
    ]],
    ['Cleaning Equipment Care', 'Correct use, cleaning and storage of equipment.', [
      'Used correctly, cleaned after use, returned to its proper place every time',
      'Looked after; occasionally left out or put away uncleaned',
      'Generally cared for, but needs reminding to clean or store it',
      'Often left dirty or stored in the wrong place',
      'Misused, left unwashed, or damaged through carelessness',
    ]],
    ['Cleaning Materials Management', 'Responsible use of supplies and avoidance of waste.', [
      'Correctly diluted and used sparingly; stock lasts as it should, no waste',
      'Used sensibly; occasional over-use',
      'Broadly correct, but dilution is judged by eye rather than measured',
      'Used heavily or wastefully; stock runs down faster than expected',
      'Wasted, over-poured or used for the wrong task, driving avoidable cost',
    ]],
  ]],
  ['Safety & Conduct', [
    ['Safety Awareness', 'Warning signs, wet floors and safe handling of cleaning chemicals.', [
      'Warning signs always placed; chemicals correctly diluted, stored, never mixed unsafely',
      'Safe practice is the norm; occasional lapse corrected when pointed out',
      'Follows safety rules when reminded, but not consistently unprompted',
      'Signs or safe chemical handling skipped when in a hurry',
      'Wet floors left unmarked or chemicals misused, creating real risk',
    ]],
    ['Following Instructions', "Carrying out assigned duties and supervisors' instructions.", [
      'Duties and supervisor instructions carried out fully and correctly, first time',
      'Followed; occasionally needs a reminder on detail',
      'Carried out, but needs checking to confirm they were done properly',
      'Partly followed, or need repeating before the work is done properly',
      'Regularly ignored, or work done differently without agreement',
    ]],
    ['Initiative', 'Identifying areas needing attention without always being instructed.', [
      'Spots areas needing attention and deals with them without waiting to be told',
      'Acts on obvious needs unprompted; waits for direction on less clear ones',
      'Will raise a problem when noticed, but waits for instruction to act',
      'Does what is assigned but rarely notices or acts beyond it',
      'Waits to be told everything, and walks past problems in plain sight',
    ]],
    ['Speed & Efficiency', 'Completing duties in reasonable time without compromising quality.', [
      'Completed well within time and to standard, with time left for extra checks',
      'Finished on time, to standard',
      'Finished on time, but with little margin and no room for extra work',
      'Runs over time, or finished on time by cutting quality',
      'Regularly unfinished at end of shift and passes to someone else',
    ]],
  ]],
  ['Teamwork & Responsibility', [
    ['Teamwork', 'Cooperating with colleagues and assisting where reasonably required.', [
      'Actively helps colleagues, covers willingly, shares the load unasked',
      'Cooperates well and helps when asked',
      'Works alongside others without difficulty, but does not offer help',
      'Keeps to own duties, reluctant to assist outside them',
      'Creates friction, refuses reasonable assistance, or leaves work for others',
    ]],
    ['Care of Company Property', 'Avoiding damage to products, furniture, equipment and facilities.', [
      'No damage to stock, fittings or equipment; care taken around fragile and high-value items',
      'Careful; very occasional minor knock, reported when it happens',
      'Generally careful, but needs reminding around fragile or high-value items',
      'Occasional avoidable damage, or items moved and not replaced properly',
      'Repeated breakages through carelessness, sometimes unreported',
    ]],
    ['Integrity & Accountability', 'Honesty and responsibility for assigned duties.', [
      'Reports own mistakes, breakages and missed areas unprompted; nothing concealed',
      'Honest and reliable; owns errors when they come up',
      'Honest when asked directly, but does not volunteer problems',
      'Tends to explain away lapses, or waits to be asked before disclosing',
      'Conceals mistakes, misreports work as done, or handles property dishonestly',
    ]],
    ['Overall Attitude & Commitment', 'Discipline, respect and willingness to work.', [
      'Consistently disciplined, respectful and willing; sets the tone for others',
      'Positive and dependable in approach to the work',
      'Does the job willingly, without particular energy either way',
      'Varies with mood or workload; needs occasional correction',
      'Resistant, disrespectful or unwilling, and it affects the rest of the team',
    ]],
  ]],
];

// Best-to-worst, matching the order the anchors are written in. Distinct by
// construction — the score is what identifies which anchor was chosen when the
// answer is read back, so duplicates are rejected at validation.
const SCORES = [5, 4, 3, 2, 1];

function buildSections() {
  return CRITERIA.map(([title, rows]) => ({
    title,
    departments: [new mongoose.Types.ObjectId(FACILITIES)],
    questions: rows.map(([label, helpText, options]) => ({
      type: 'likert',
      label,
      helpText,
      required: true,
      scaleMax: 5,
      options,
      optionScores: SCORES,
      askOf: ['self', 'manager'],
    })),
  }));
}

async function main() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGO_URI is not set');
  await mongoose.connect(uri);

  const sections = buildSections();
  const questionCount = sections.reduce((n, s) => n + s.questions.length, 0);
  const maxScore = sections.reduce(
    (n, s) => n + s.questions.reduce((m, q) => m + Math.max(...q.optionScores), 0),
    0
  );
  const minScore = sections.reduce(
    (n, s) => n + s.questions.reduce((m, q) => m + Math.min(...q.optionScores), 0),
    0
  );

  // The same predicate the API applies, so this script cannot create a
  // document the editor would then refuse to save.
  const errors = validateTemplateShape(sections);
  if (errors.length) {
    console.error('Template shape is invalid:\n');
    for (const e of errors) console.error(`  ✗ ${e}`);
    await mongoose.disconnect();
    process.exit(1);
  }
  console.log('✓ shape valid (options/scores pair, in range, distinct)\n');

  console.log(`${NAME}`);
  console.log(`  ${sections.length} sections, ${questionCount} criteria`);
  console.log(`  score range: ${minScore}–${maxScore}`);
  for (const s of sections) console.log(`   - ${s.title} (${s.questions.length})`);

  const existing = await AppraisalTemplate.findOne({
    tenant: TENANT, name: NAME, isLatest: true, isArchived: false,
  }).select('_id version').lean();
  if (existing) {
    console.log(`\nAlready exists: ${existing._id} (v${existing.version}). Nothing to do.`);
    await mongoose.disconnect();
    return;
  }

  if (!APPLY) {
    console.log('\nDry run — nothing written. Re-run with --apply to create.');
    await mongoose.disconnect();
    return;
  }

  const family = new mongoose.Types.ObjectId();
  const created = await AppraisalTemplate.create({
    tenant: TENANT,
    name: NAME,
    description:
      'Scored assessment for cleaning staff. Each criterion is answered by choosing one of five ' +
      'behavioural descriptions; the score behind the description is not shown to the rater and is ' +
      'totalled into the final mark out of 100.',
    family,
    version: 1,
    isLatest: true,
    isDefault: false,
    isArchived: false,
    sections,
  });

  // Read back rather than trusting the write: the scores are the whole point,
  // and a silently-dropped array would leave a form that renders but cannot be
  // scored.
  const fresh = await AppraisalTemplate.findById(created._id).lean();
  const withScores = fresh.sections.reduce(
    (n, s) => n + s.questions.filter((q) => (q.optionScores || []).length === 5).length,
    0
  );
  console.log(`\nCreated ${created._id} (family ${family})`);
  console.log(`${withScores === questionCount ? '✓' : '✗'} ${withScores}/${questionCount} criteria persisted with five scored options`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
