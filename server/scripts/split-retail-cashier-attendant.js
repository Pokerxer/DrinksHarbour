/**
 * Split Retail's scored sheet into a shared core plus a cashier block and an
 * attendant block.
 *
 * Retail employs cashiers and guest-services attendants, and until now both
 * answered the SAME 20 criteria — a merge of the two source lists, because
 * sections could only be scoped by department and Cashier/Attendant are
 * EmployeeRoles. Sections now carry `roles` as well, ANDed with `departments`,
 * so this replaces Retail's five sections with:
 *
 *   shared core   departments:[Retail]  roles:[]                    8 criteria
 *   cashier block departments:[Retail]  roles:[Cashier]            12 criteria
 *   attendant     departments:[Retail]  roles:[Attendant]          12 criteria
 *
 * Each role therefore answers 8 + 12 = 20 criteria at 5 points each: the same
 * clean /100 with a floor of 20 that every other department scores, which is
 * what HR's A–E grade bands are read off. A shared core rather than two
 * self-contained 20-question sheets because punctuality and integrity are the
 * same thing to assess whichever till someone stands at, and two copies would
 * be two sets of wording to keep in step.
 *
 * ── Why the role blocks name Retail as well as the role (decided 2026-08-09) ──
 * Janice and Rejoice hold the Attendant role while sitting in WAREHOUSE, where
 * they answer Warehouse's own 20 criteria. A role block naming only the role
 * would reach them on top of that — 40 criteria, scored out of 200 — because
 * the two dimensions are ANDed and there is no way to say "except in
 * Warehouse". Naming Retail keeps them on the warehouse sheet they already
 * have, which is the work they actually do.
 *
 * ── Why this also writes to three employee records ──
 * The split only holds if every Retail employee HAS a role: a role-less one
 * would match the shared core and neither block, and open an 8-criterion form
 * scored out of 40 with nothing to say so. Mark, Nico and Tony are the three,
 * and they are floor staff, so they are given the Attendant role here. Doing
 * it in the same run is deliberate — a template split applied without them is
 * a half-applied change that looks finished.
 *
 * REPLACES Retail's sections rather than appending. That is destructive to
 * their question `_id`s, so it makes the same in-place-vs-fork decision
 * `updateTemplate` makes, using the same `hasLaunchedCycleFor` predicate:
 *
 *   no launched cycle → edit v1 in place; no stored answer can be orphaned
 *   a cycle pins it   → FORK to v(N+1); the launched cycle keeps the exact
 *                       form its reviewers are part-way through
 *
 * Either way every OTHER department's sections, and every question `_id`
 * beneath them, are carried across untouched.
 *
 * Usage:
 *   node scripts/split-retail-cashier-attendant.js            # dry run
 *   node scripts/split-retail-cashier-attendant.js --apply    # write
 *
 * Writes nothing without --apply. Idempotent: a template already carrying
 * role-scoped Retail sections is left alone, as is an employee who already has
 * a role. Resolves the family's LATEST version, so a second --apply after a
 * fork sees the forked version and does nothing.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const mongoose = require('mongoose');
const AppraisalTemplate = require('../models/AppraisalTemplate');
const User = require('../models/User');
const { validateTemplateShape, hasLaunchedCycleFor } = require('../controllers/appraisalTemplate.controller');

const APPLY = process.argv.includes('--apply');
const TENANT = '699165839f3308b1baeca8fc';
// The FAMILY, not a version. A fork moves `isLatest` to a new _id, so a script
// pinned to one version id would edit a superseded form on its second run.
const FAMILY = '6a78434262e70bb58fd574b7';
const RETAIL = '6a774a5bce8af457bda41942';
const CASHIER = '6a774a5dce8af457bda41953';
const ATTENDANT = '6a774a5dce8af457bda4194f';

// Targeted by email, which is unique and stable, rather than by first name.
// Every one of them must still be role-less or the script stops: a name
// reused by a new joiner must not silently hand them a role.
const NEEDS_ATTENDANT_ROLE = ['mark@wyncity.ng', 'nico@wyncity.ng', 'tony@wyncity.ng'];

// Best-to-worst, matching the order the anchors are written in. Distinct by
// construction — the score is what identifies which anchor was chosen when the
// answer is read back, so duplicates are rejected at validation. The reviewer
// never sees these numbers, and the form shuffles the anchors per rater, so
// nothing may encode rank by position.
const SCORES = [5, 4, 3, 2, 1];

/**
 * [sectionTitle, [ [label, helpText, [a5,a4,a3,a2,a1]] ]]
 *
 * Wording is person-neutral throughout: each criterion is asked of BOTH `self`
 * and `manager`, one label serves both, and an anchor saying "this cashier"
 * would be wrong on the employee's own form.
 */

// ── Shared core — every Retail employee, whatever their role (8) ───────────
const SHARED = [
  ['Reliability & Presentation', [
    ['Punctuality', 'Arriving ready to work at the start of the shift.', [
      'Always on the floor and ready before the shift starts',
      'On time nearly always; the rare lateness is flagged in advance',
      'Generally on time, but late often enough to be noticed',
      'Late frequently, and it holds up the opening or the handover',
      'Lateness is routine and no longer explained',
    ]],
    ['Attendance & Reliability', 'Working the shifts rostered, and giving notice when unable to.', [
      'Works every rostered shift; absence is rare and always notified early',
      'Reliable attendance; the odd absence is properly notified',
      'Attends most shifts, but notice is often short',
      'Absent often, and cover has to be arranged at the last minute',
      'Absent without notice, leaving the shift short',
    ]],
    ['Personal Appearance & Professionalism', 'Turning out in a way that fits a customer-facing role.', [
      'Consistently smart and correctly dressed; sets the standard for the floor',
      'Neat and appropriate at every shift',
      'Presentable, though it slips towards the end of a long shift',
      'Untidy often enough for customers to notice',
      'Appearance regularly falls below what a customer-facing role needs',
    ]],
  ]],
  ['Conduct & Commitment', [
    ['Customer Service', 'How customers are treated across the whole interaction.', [
      'Customers are treated so well they ask for this person by name',
      'Courteous and helpful throughout; customers leave satisfied',
      'Polite and correct, without going further than asked',
      'Service is transactional and occasionally curt',
      'Customers are left frustrated or ignored',
    ]],
    ['Teamwork', 'Working with the rest of the shift rather than alongside it.', [
      'Actively makes the shift work — covers, shares, and steps in unasked',
      'Cooperative and easy to work with; helps when asked',
      'Does their own part; leaves the rest to others',
      'Creates friction, or leaves work for the next person',
      'Uncooperative, and the shift works around them',
    ]],
    ['Following Company Procedures', 'Working the way the store is meant to be run.', [
      'Follows procedure exactly and helps others get it right',
      'Follows procedure reliably; lapses are minor and self-corrected',
      'Follows the familiar procedures; shortcuts the less familiar ones',
      'Needs reminding regularly, and works around procedure when busy',
      'Ignores procedure, and it has caused problems',
    ]],
    ['Integrity & Trustworthiness', 'Being straight about money, stock and mistakes.', [
      'Completely trustworthy; reports own errors before anyone finds them',
      'Honest and open; discrepancies are raised straight away',
      'Honest, but slow to own a mistake',
      'Accounts of events have needed checking',
      'Trust has been broken over stock, cash or the truth of a report',
    ]],
    ['Overall Attitude & Commitment', 'The energy and willingness brought to the job.', [
      'Committed and positive; noticeably invested in how the store does',
      'Positive and dependable in approach to the work',
      'Does the job willingly, without particular energy either way',
      'Varies with mood or workload; needs occasional correction',
      'Resistant or unwilling, and it affects the rest of the team',
    ]],
  ]],
];

// ── Cashier block — Retail, Cashier role (12) ──────────────────────────────
const CASHIER_BLOCK = [
  ['Transactions & Cash', [
    ['Transaction Accuracy', 'Ringing up what was actually bought, at the right price.', [
      'Transactions are correct every time, including complex or mixed baskets',
      'Accurate; the rare error is caught and corrected on the spot',
      'Mostly accurate, with occasional errors on busy or unusual sales',
      'Errors are frequent enough that receipts have to be checked',
      'Errors are routine and cost the store money or goodwill',
    ]],
    ['Cash Handling Accuracy', 'Counting in, counting out, and giving correct change.', [
      'Drawer balances every shift; change is right without hesitation',
      'Drawer balances almost always; variances are tiny and explained',
      'Small variances appear more often than they should',
      'Variances are regular and unexplained',
      'Serious or repeated shortages',
    ]],
    ['Cash Reconciliation', 'Closing the till against the day’s takings.', [
      'Reconciles quickly and correctly, and investigates any gap before reporting',
      'Reconciles correctly; gaps are reported clearly',
      'Reconciles, but needs help when the figures do not agree',
      'Reconciliation is slow, incomplete, or left for someone else',
      'Reconciliation is not done properly, so the day cannot be closed cleanly',
    ]],
    ['POS System Competence', 'Working the till system, including the parts used rarely.', [
      'Fully fluent, including refunds, splits and holds; others ask for help',
      'Confident with everything the shift normally needs',
      'Handles routine sales; hesitant with anything unusual',
      'Needs help regularly, and queues build while it is sorted out',
      'Cannot work the system reliably without supervision',
    ]],
    ['Card/Transfer Verification', 'Confirming a non-cash payment actually landed.', [
      'Every transfer and card payment is verified before goods leave the counter, without exception',
      'Verifies reliably; the process is followed as written',
      'Verifies, but sometimes after the customer has gone',
      'Skips verification when busy or when the customer is known',
      'Goods have left the counter against payments that never arrived',
    ]],
    ['Speed & Efficiency', 'Keeping the queue moving without cutting corners.', [
      'Fast and accurate together; the queue never builds unnecessarily',
      'Works at a good pace and keeps the counter moving',
      'Steady, but slows noticeably at peak times',
      'Slow enough that customers wait or leave',
      'Pace holds up the whole floor',
    ]],
  ]],
  ['Control & Accountability', [
    ['Receipt & Documentation Accuracy', 'The paper trail a sale leaves behind.', [
      'Every sale is documented correctly and filed where it belongs',
      'Documentation is accurate and complete',
      'Mostly complete; occasional missing or unclear entries',
      'Documentation is often incomplete, so sales cannot be traced',
      'Records are missing or wrong often enough to be unusable',
    ]],
    ['Refund/Void/Discount Compliance', 'Using the overrides only as authorised.', [
      'Every refund, void and discount is authorised and recorded, without exception',
      'Follows the authorisation rules reliably',
      'Follows them for large amounts; casual about small ones',
      'Overrides are used without authorisation more than once',
      'Overrides have been used in a way that cannot be accounted for',
    ]],
    ['Fraud Awareness & Prevention', 'Spotting and stopping attempts to cheat the till.', [
      'Alert to fraud attempts and has prevented losses by catching them',
      'Aware of the common attempts and checks for them',
      'Follows the checks, without much awareness of why',
      'Misses obvious warning signs',
      'Has let through a loss that basic vigilance would have stopped',
    ]],
    ['Accountability', 'Owning the till, its contents, and any gap in them.', [
      'Takes full responsibility for the till and raises problems before being asked',
      'Owns their shift and any discrepancy in it',
      'Accepts responsibility once it is pointed out',
      'Deflects responsibility onto the shift or the system',
      'Refuses to account for their own till',
    ]],
    ['Handover Procedures', 'Passing the till on so the next person starts clean.', [
      'Handover is complete, counted and documented every time',
      'Handover is reliable; the next person starts without questions',
      'Handover happens, but details are sometimes missed',
      'Handover is rushed and leaves the next shift sorting it out',
      'No proper handover, so problems surface later with no owner',
    ]],
    ['Communication Skills', 'Being clear with customers and with the rest of the shift.', [
      'Clear and calm with customers and colleagues, including under pressure',
      'Communicates clearly; passes on what others need to know',
      'Communicates adequately; sometimes has to be asked twice',
      'Unclear or abrupt, and information gets lost',
      'Poor communication causes mistakes for other people',
    ]],
  ]],
];

// ── Attendant block — Retail, Attendant role (12) ──────────────────────────
const ATTENDANT_BLOCK = [
  ['Customer Service & Sales', [
    ['Customer Greeting & Approach', 'How a customer is met on arrival.', [
      'Every customer is greeted and offered help before they have to look for it',
      'Greets customers promptly and warmly',
      'Greets customers when not occupied with something else',
      'Customers often have to seek attention',
      'Customers are left standing and unacknowledged',
    ]],
    ['Product Knowledge', 'Knowing the range well enough to answer for it.', [
      'Knows the range in depth, including new lines, and is the person others ask',
      'Good knowledge across the range; answers most questions confidently',
      'Knows the popular lines; unsure beyond them',
      'Frequently has to fetch someone else to answer a basic question',
      'Cannot answer for the products on the shelf',
    ]],
    ['Product Recommendation', 'Matching what the customer wants to what the store has.', [
      'Reads what the customer actually needs and recommends accordingly; customers return on it',
      'Recommends sensibly and the customer usually takes it',
      'Recommends the obvious choice without exploring the need',
      'Recommendations are random or unhelpful',
      'Makes no attempt to recommend anything',
    ]],
    ['Upselling & Cross-selling', 'Adding to the basket without pushing the customer away.', [
      'Adds to the basket naturally and often; the customer leaves pleased, not pressured',
      'Regularly suggests a sensible addition',
      'Suggests something when prompted or when it is easy',
      'Rarely attempts it, or does it so hard the customer resists',
      'Never attempts it, and clear opportunities pass',
    ]],
    ['Sales Performance', 'What the shifts worked actually produce.', [
      'Consistently among the strongest sellers on the floor',
      'Sells well and steadily',
      'Around the middle of the floor',
      'Below the rest of the floor on comparable shifts',
      'Well below, with no sign of improvement',
    ]],
    ['Customer Complaint Handling', 'What happens when something has gone wrong.', [
      'Defuses complaints and turns them round; customers come back after one',
      'Handles complaints calmly and escalates properly when needed',
      'Handles simple complaints; passes anything difficult straight on',
      'Becomes defensive, and complaints escalate that need not have',
      'Makes complaints worse, or avoids them entirely',
    ]],
  ]],
  ['Stock & Store Standards', [
    ['Accuracy', 'Getting the details of an order or a request right.', [
      'Orders and requests are right first time, every time',
      'Accurate; the rare slip is caught before it reaches the customer',
      'Mostly accurate, with occasional mix-ups on busy shifts',
      'Mix-ups are frequent enough that orders have to be double-checked',
      'Errors are routine and customers are affected',
    ]],
    ['Stock Handling', 'Moving and storing goods without damaging or losing them.', [
      'Handles stock carefully and correctly; breakages and losses are effectively nil',
      'Handles stock properly; incidents are rare',
      'Generally careful, with occasional carelessness under pressure',
      'Careless often enough to cost the store in breakages',
      'Regular damage or loss through poor handling',
    ]],
    ['Shelf Arrangement & Display', 'How the goods on the floor actually look.', [
      'Displays are faced, priced and full, and improved without being asked',
      'Shelves are kept tidy, full and correctly priced',
      'Shelves are acceptable but need prompting',
      'Gaps, wrong prices and untidy facings are common',
      'The floor is left in a state customers comment on',
    ]],
    ['Cleanliness of Work Area', 'The state of the space this person works in.', [
      'Work area is spotless throughout the shift, not just at the end',
      'Keeps the area clean and clear',
      'Cleans when told, or at the end of the shift',
      'Area is often left dirty or cluttered',
      'Leaves the area in a state that fails a basic standard',
    ]],
    ['Initiative', 'Seeing what needs doing and doing it.', [
      'Finds the work without being directed and takes it on',
      'Takes on obvious tasks unprompted',
      'Does what is asked, and waits to be asked',
      'Has to be directed to everything, including the obvious',
      'Avoids work that has not been explicitly assigned',
    ]],
    ['Responsibility & Accountability', 'Owning the section and what happens in it.', [
      'Owns the section completely and raises problems before they are noticed',
      'Takes responsibility for their area and their mistakes',
      'Accepts responsibility once it is pointed out',
      'Deflects responsibility onto others or onto circumstances',
      'Refuses to account for their own work',
    ]],
  ]],
];

const oid = (id) => new mongoose.Types.ObjectId(id);

function buildSections(groups, { departments, roles }) {
  return groups.map(([title, rows]) => ({
    title,
    departments: departments.map(oid),
    roles: roles.map(oid),
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

const countQuestions = (sections) => sections.reduce((n, s) => n + s.questions.length, 0);

/**
 * Give the three role-less Retail employees the Attendant role.
 *
 * Refuses to touch anyone who already has one — this is a backfill of missing
 * data, not a reassignment — and refuses to run at all if an email no longer
 * resolves, because a silently skipped employee is exactly the empty form this
 * whole change exists to prevent.
 */
async function backfillAttendantRoles() {
  const rows = await User.find({ tenant: TENANT, email: { $in: NEEDS_ATTENDANT_ROLE } })
    .select('_id firstName lastName email employeeProfile.work.department employeeProfile.planning')
    .lean();

  const missing = NEEDS_ATTENDANT_ROLE.filter((e) => !rows.some((r) => r.email === e));
  if (missing.length) throw new Error(`No such employee: ${missing.join(', ')}`);

  const toSet = [];
  for (const u of rows) {
    const planning = u.employeeProfile?.planning || {};
    const has = (planning.roles || []).length > 0 || planning.defaultRole;
    const name = [u.firstName, u.lastName].filter(Boolean).join(' ');
    if (String(u.employeeProfile?.work?.department) !== RETAIL) {
      throw new Error(`${name} is no longer in Retail — decide their role deliberately, not here`);
    }
    if (has) {
      console.log(`= ${name.padEnd(12)} already has a role — leaving alone`);
      continue;
    }
    console.log(`+ ${name.padEnd(12)} → Attendant`);
    toSet.push(u._id);
  }
  if (!toSet.length || !APPLY) return toSet.length;

  await User.updateMany(
    { _id: { $in: toSet }, tenant: TENANT },
    {
      $set: {
        'employeeProfile.planning.roles': [oid(ATTENDANT)],
        'employeeProfile.planning.defaultRole': oid(ATTENDANT),
      },
    }
  );
  return toSet.length;
}

async function editInPlace(template, sections) {
  await AppraisalTemplate.updateOne(
    { _id: template._id, tenant: template.tenant },
    { $set: { sections } }
  );
  return template._id;
}

/**
 * Copy this version to v(N+1) carrying the new sections, exactly as
 * `updateTemplate` forks.
 *
 * Order matters: the {tenant, family} partial unique index permits one
 * `isLatest` row per family, so the old row's flag is cleared BEFORE the new
 * row is inserted, and both writes share one transaction. Failing halfway
 * leaves the family with no latest version, which createCycle resolves
 * against — a visible failure rather than a silently duplicated form.
 *
 * `isDefault` rides across because the default is a property of the FAMILY,
 * not of a version.
 */
async function forkWithSections(template, sections) {
  const session = await mongoose.startSession();
  // Assigned, never accumulated, inside the callback: withTransaction re-runs
  // the whole callback on a transient error.
  let forkedId = null;
  try {
    await session.withTransaction(async () => {
      // Re-read INSIDE the callback — a document loaded outside would be
      // reused across attempts and write into a rolled-back version.
      const fresh = await AppraisalTemplate.findOne({ _id: template._id, tenant: TENANT })
        .session(session)
        .lean();
      if (!fresh) throw new Error('Template vanished mid-fork');

      const siblings = await AppraisalTemplate.find({ tenant: TENANT, family: fresh.family })
        .select('version')
        .session(session)
        .lean();
      const nextVersion =
        siblings.reduce((max, r) => Math.max(max, r.version || 0), fresh.version || 1) + 1;

      await AppraisalTemplate.updateOne(
        { _id: fresh._id, tenant: TENANT },
        { $set: { isLatest: false } },
        { session }
      );
      const [next] = await AppraisalTemplate.create([{
        tenant: TENANT,
        family: fresh.family,
        version: nextVersion,
        isLatest: true,
        isDefault: fresh.isDefault === true,
        isArchived: false,
        name: fresh.name,
        description: fresh.description,
        createdBy: fresh.createdBy,
        sections,
      }], { session });
      forkedId = next._id;
    });
  } finally {
    session.endSession();
  }
  return forkedId;
}

async function main() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGO_URI is not set');
  await mongoose.connect(uri);

  const template = await AppraisalTemplate.findOne({
    tenant: TENANT,
    family: FAMILY,
    isLatest: true,
  }).lean();
  if (!template) throw new Error(`No latest version for family ${FAMILY}`);

  // The same decision updateTemplate makes, through the same predicate: edit
  // in place while nothing has launched against this version, fork once
  // something has. Here it is also what makes REPLACING sections safe — a
  // version nothing pins has no stored answer to orphan.
  const mustFork = await hasLaunchedCycleFor(template.tenant, template._id);
  console.log(`Template: ${template.name} v${template.version} ${template._id}`);
  console.log(`Currently ${template.sections.length} sections, ${countQuestions(template.sections)} criteria`);
  console.log(
    mustFork
      ? `→ a LAUNCHED cycle pins v${template.version}; this will fork to v${template.version + 1}\n`
      : '✓ no launched cycle pins this version — editing in place\n'
  );

  const isRetail = (s) => (s.departments || []).some((d) => String(d) === RETAIL);
  const retailNow = template.sections.filter(isRetail);
  const alreadySplit = retailNow.some((s) => (s.roles || []).length > 0);

  const shared = buildSections(SHARED, { departments: [RETAIL], roles: [] });
  const cashier = buildSections(CASHIER_BLOCK, { departments: [RETAIL], roles: [CASHIER] });
  const attendant = buildSections(ATTENDANT_BLOCK, { departments: [RETAIL], roles: [ATTENDANT] });

  const perRole = countQuestions(shared) + countQuestions(cashier);
  if (countQuestions(cashier) !== countQuestions(attendant)) {
    throw new Error('The two role blocks differ in size — one role would be scored out of a different total');
  }
  if (perRole !== 20) {
    throw new Error(`A role answers ${perRole} criteria, expected 20 — every sheet must total /100`);
  }

  console.log('RETAIL, AFTER:');
  console.log(`  shared core    ${shared.length} sections, ${countQuestions(shared)} criteria — everyone in Retail`);
  console.log(`  cashier block  ${cashier.length} sections, ${countQuestions(cashier)} criteria — Retail + Cashier`);
  console.log(`  attendant      ${attendant.length} sections, ${countQuestions(attendant)} criteria — Retail + Attendant`);
  console.log(`  → each role answers ${perRole} criteria, scored ${perRole}–${perRole * 5}\n`);

  console.log('RETAIL EMPLOYEES WITH NO ROLE:');
  const backfilled = await backfillAttendantRoles();
  console.log('');

  if (alreadySplit) {
    console.log('Retail already carries role-scoped sections — template left alone.');
    if (APPLY && backfilled) console.log(`Applied the role backfill only (${backfilled} employees).`);
    await mongoose.disconnect();
    return;
  }

  const kept = template.sections.filter((s) => !isRetail(s));
  const next = [...kept, ...shared, ...cashier, ...attendant];

  // Validated as a whole, so this cannot produce a document the editor would
  // then refuse to save.
  const errors = validateTemplateShape(next);
  if (errors.length) {
    console.error('Shape invalid:\n');
    for (const e of errors) console.error(`  ✗ ${e}`);
    await mongoose.disconnect();
    process.exit(1);
  }
  console.log('✓ shape valid across the whole template');
  console.log(`  replacing ${retailNow.length} Retail sections (${countQuestions(retailNow)} criteria)`);
  console.log(`  ${kept.length} sections in other departments untouched`);

  if (!APPLY) {
    console.log('\nDry run — nothing written. Re-run with --apply to write.');
    await mongoose.disconnect();
    return;
  }

  const writtenId = mustFork
    ? await forkWithSections(template, next)
    : await editInPlace(template, next);

  const fresh = await AppraisalTemplate.findById(writtenId).lean();
  const keptIds = new Set(kept.flatMap((s) => s.questions.map((q) => String(q._id))));
  const stillThere = [...keptIds].filter((id) =>
    fresh.sections.some((s) => s.questions.some((q) => String(q._id) === id))
  ).length;

  console.log(`\nApplied — ${mustFork ? `forked to v${fresh.version} ${fresh._id}` : `edited v${fresh.version} in place`}.`);
  console.log(`${stillThere === keptIds.size ? '✓' : '✗'} identity: ${stillThere}/${keptIds.size} other-department question _ids unchanged`);
  console.log(`✓ now ${fresh.sections.length} sections, ${countQuestions(fresh.sections)} criteria`);
  console.log(`\nNext: node scripts/check-template-coverage.js --template=${fresh._id} --verbose`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
