/**
 * Re-word the stored "360° Feedback v3" template so no question names a person
 * the reader isn't, and scope Retail's peer section to peers.
 *
 * WHY THIS IS A DATA FIX AND NOT A CODE FIX
 * -----------------------------------------
 * A question carries ONE label and ONE helpText, shown verbatim to every kind
 * in its `askOf`. filterSections (services/appraisal.helpers.js) decides who
 * SEES a question; nothing rewrites its words per kind, and nothing should —
 * the whole point of a shared question is that self and manager answer the
 * same thing so buildComparison can put their answers side by side. So a
 * multi-kind question that says "this attendant" is simply written wrong, and
 * the only place to fix it is the stored document.
 *
 * THE RULE APPLIED
 * ----------------
 * A question asked of more than one kind must be worded so that EVERY kind in
 * its askOf reads it correctly. In practice that means: neutral whenever
 * `self` is one of the kinds (an employee assessing themselves must not be
 * called "this attendant"), and rater-addressing "your assessment"-style
 * second person is fine because it addresses whoever is filling the form.
 *
 * Deliberately NOT changed:
 *   - Single-kind questions. A manager-only prompt SHOULD say "this employee";
 *     that is the person the manager is writing about.
 *   - `['manager','peer']` questions (Facilities "…this employee delivered
 *     particularly high-quality cleaning", Logistics "…you have observed this
 *     driver demonstrate"). Two kinds, but neither is the subject — both are
 *     writing about someone else, so third person is right for both. The rule
 *     is "no kind reads the wrong person", not "count the askOf entries".
 *   - Neutral rating statements ("Reports for scheduled shifts on time").
 *
 * WHAT IT MUST NEVER DO
 * ---------------------
 * Remint an `_id`. A question's `_id` is its identity ACROSS template
 * versions: buildComparison joins self and manager answers on a shared
 * questionId, and getAskedQuestionIds gates submission on it. Every write here
 * is a `$set` of `label` / `helpText` / `type` / `askOf` addressed through
 * arrayFilters on the existing `_id`s, so a subdocument is edited in place and
 * cannot be recreated. For the same reason it must never SPLIT a shared
 * question into a self copy and a manager copy: two ids no longer join, and
 * every comparison row would render half-empty. Neutral wording is the fix.
 *
 * SAFETY
 * ------
 * Refuses to write if a LAUNCHED cycle pins this version, reusing
 * hasLaunchedCycleFor from controllers/appraisalTemplate.controller.js — the
 * same predicate updateTemplate branches on. Templates are copy-on-write;
 * editing a version a launched cycle holds would rewrite a form reviewers may
 * have open, and the correct action then is a fork, not this script.
 *
 * Idempotent and non-clobbering: every edit states the exact text it expects
 * to find. Already-applied edits are skipped; anything that matches neither
 * the old nor the new text is reported and aborts the run, because unexpected
 * content means somebody edited the template and this script's assumptions no
 * longer hold.
 *
 * Usage:
 *   node scripts/fix-appraisal-template-person-wording.js            # dry run
 *   node scripts/fix-appraisal-template-person-wording.js --apply    # write
 *   node scripts/fix-appraisal-template-person-wording.js --tenant=<id> [--apply]
 *
 * Writes nothing without --apply.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const mongoose = require('mongoose');
const AppraisalTemplate = require('../models/AppraisalTemplate');
const { hasLaunchedCycleFor } = require('../controllers/appraisalTemplate.controller');

const APPLY = process.argv.includes('--apply');
const TENANT =
  (process.argv.find((a) => a.startsWith('--tenant=')) || '').split('=')[1] ||
  '699165839f3308b1baeca8fc';
const TEMPLATE_NAME = '360° Feedback v3';

/**
 * Every edit, keyed by the question's existing `_id`.
 *
 * `expect` is the text as it stands today; `set` is the replacement. Both are
 * spelled out in full rather than computed by regex so that the diff is
 * reviewable as English and a partially-applied run can be resumed safely.
 */
const EDITS = [
  // ---------------------------------------------------------------- Retail --
  {
    id: '6a77c6291d5b1889c97674aa',
    where: 'Retail › Reliability and Professionalism',
    // "you (or this attendant)" is the defect stated outright: the author knew
    // one label had to serve both kinds and hedged instead of neutralising.
    expect: {
      label:
        'Describe a specific example of when you (or this attendant) went above expectations in maintaining professionalism or punctuality.',
      helpText:
        'Provide one concrete incident you observed or experienced, including what happened and why it stood out.',
    },
    set: {
      label:
        'Describe a specific example of going above expectations in maintaining professionalism or punctuality.',
      helpText: 'One concrete incident: what happened, and why it stood out.',
    },
  },
  {
    id: '6a77c6291d5b1889c97674a7',
    where: 'Retail › Reliability and Professionalism',
    expect: {
      helpText:
        'Assess how consistently this attendant arrives ready to work at their scheduled start time.',
    },
    set: { helpText: 'Assess how consistently the scheduled start time is met, ready to work.' },
  },
  {
    id: '6a77c6291d5b1889c97674ac',
    where: 'Retail › Customer Service and Sales',
    expect: {
      helpText: 'Assess how quickly and warmly the attendant engages with customers on the shop floor.',
    },
    set: { helpText: 'Assess how quickly and warmly customers are engaged on the shop floor.' },
  },
  {
    id: '6a77c6291d5b1889c97674ae',
    where: 'Retail › Customer Service and Sales',
    expect: {
      helpText: "Evaluate the attendant's ability to answer customer questions and locate items accurately.",
    },
    set: { helpText: 'Evaluate the ability to answer customer questions and locate items accurately.' },
  },
  {
    id: '6a77c6291d5b1889c97674af',
    where: 'Retail › Customer Service and Sales',
    expect: {
      helpText: 'Assess whether the attendant listens to customer requirements and suggests suitable products.',
    },
    set: {
      helpText: 'Assess whether customer requirements are listened to and suitable products suggested.',
    },
  },
  {
    id: '6a77c6291d5b1889c97674b0',
    where: 'Retail › Customer Service and Sales',
    expect: {
      helpText:
        'Rate how often the attendant identifies and suggests add-on or premium items during customer interactions.',
    },
    set: {
      helpText:
        'Rate how often add-on or premium items are identified and suggested during customer interactions.',
    },
  },
  {
    id: '6a77c6291d5b1889c97674b2',
    where: 'Retail › Customer Service and Sales',
    expect: {
      label:
        'Describe a specific customer interaction where this attendant demonstrated excellent service or sales skills.',
      helpText:
        'Provide one concrete example, including what the customer wanted, what the attendant did, and the outcome.',
    },
    set: {
      label:
        'Describe a specific customer interaction that demonstrated excellent service or sales skills.',
      helpText: 'One concrete example: what the customer wanted, what was done, and the outcome.',
    },
  },
  {
    id: '6a77c6291d5b1889c97674b4',
    where: 'Retail › Problem-Solving and Responsibility',
    expect: {
      helpText: 'Rate how calmly and constructively the attendant manages upset or dissatisfied customers.',
    },
    set: {
      helpText: 'Rate how calmly and constructively upset or dissatisfied customers are managed.',
    },
  },
  {
    id: '6a77c6291d5b1889c97674b5',
    where: 'Retail › Problem-Solving and Responsibility',
    expect: {
      helpText:
        'Assess whether the attendant knows their limits and seeks help appropriately rather than attempting to resolve beyond their authority.',
    },
    set: {
      helpText:
        "Assess whether limits are recognised and help sought appropriately, rather than attempting to resolve beyond the role's authority.",
    },
  },
  {
    id: '6a77c6291d5b1889c97674b6',
    where: 'Retail › Problem-Solving and Responsibility',
    expect: {
      label: 'Describe a challenging situation this attendant resolved or escalated appropriately.',
      helpText: "Provide one specific example of a problem, the attendant's actions, and how it was handled.",
    },
    set: {
      label: 'Describe a challenging situation that was resolved or escalated appropriately.',
      helpText: 'One specific example: the problem, the actions taken, and how it was handled.',
    },
  },
  {
    // PROBLEM 2. The only rating in any department's peer-evidence section, and
    // the only one of the six such sections that self and manager could see at
    // all. Converted to text and narrowed to peers, which lands Retail on the
    // same shape as the other five: an incident, from someone who was there.
    //
    // That is the position recorded in appraisal.helpers.js' PEER_EVIDENCE_
    // QUESTIONS — peers are asked what happened, not for a score, because a
    // mean of three or four peer ratings reads as measurement when it is not.
    // Keeping it on self and manager was doubly wrong: an employee rating
    // their own collaboration is not peer evidence of anything.
    //
    // `scaleMax` is left on the subdocument. It is inert for a text question
    // (renderers key on `type`), and clearing it would be churn on a field no
    // longer read.
    id: '6a77c6291d5b1889c97674ba',
    where: 'Retail › Working with this person',
    expect: {
      type: 'rating',
      askOf: ['self', 'manager', 'peer'],
      label: 'Collaborates effectively and communicates clearly with team members',
      helpText: 'Rate how well the attendant works as part of the wider retail team and shares information.',
    },
    set: {
      type: 'text',
      askOf: ['peer'],
      label: 'Describe how this attendant communicates and shares information with the rest of the team.',
      helpText:
        'Give a specific example — something they passed on, or a moment when communication mattered.',
    },
  },
  {
    id: '6a77c6291d5b1889c97674bc',
    where: 'Retail › Overall Assessment',
    // Reduced to the bare statement, matching the neutral idiom every other
    // rating row in this template already uses ("Reports for scheduled shifts
    // on time"). helpText already addresses the rater and is left alone.
    expect: { label: 'This attendant consistently meets the expectations of the role' },
    set: { label: 'Consistently meets the expectations of the role' },
  },
  {
    id: '6a77c6291d5b1889c97674bd',
    where: 'Retail › Overall Assessment',
    expect: {
      label: "What is this attendant's greatest strength in their current role?",
      helpText: 'Identify one key competency or behaviour where the attendant excels.',
    },
    set: {
      label: 'What is the greatest strength shown in this role?',
      helpText: 'Identify one key competency or behaviour that stands out as a strength.',
    },
  },
  {
    id: '6a77c6291d5b1889c97674be',
    where: 'Retail › Overall Assessment',
    expect: { label: 'What is one area where this attendant could develop or improve?' },
    set: { label: 'What is one area to develop or improve?' },
  },

  // ------------------------------------- Digital Marketing & Sales ----------
  {
    id: '6a77c3b5c8a931ed974db11a',
    where: 'Digital Marketing & Sales › Digital Communication & Product Knowledge',
    // The mirror image of the Retail defect: second person on a question the
    // manager also answers, so the manager was asked to describe their own use
    // of product knowledge.
    expect: {
      label:
        'Give an example of how you used your product knowledge to resolve a customer enquiry or drive a sale.',
      helpText:
        'Describe a specific situation where your knowledge of products, pricing or offers made a difference.',
    },
    set: {
      label:
        'Give an example of product knowledge being used to resolve a customer enquiry or drive a sale.',
      helpText:
        'Describe a specific situation where knowledge of products, pricing or offers made a difference.',
    },
  },
  {
    id: '6a77c3b5c8a931ed974db109',
    where: 'Digital Marketing & Sales › Sales & Lead Generation Performance',
    expect: { helpText: 'Rate how consistently the employee meets or exceeds assigned sales targets.' },
    set: { helpText: 'Rate how consistently assigned sales targets are met or exceeded.' },
  },
  {
    id: '6a77c3b5c8a931ed974db10a',
    where: 'Digital Marketing & Sales › Sales & Lead Generation Performance',
    expect: { helpText: 'Rate the volume and quality of qualified leads this employee sources.' },
    set: { helpText: 'Rate the volume and quality of qualified leads sourced.' },
  },
  {
    id: '6a77c3b5c8a931ed974db10b',
    where: 'Digital Marketing & Sales › Sales & Lead Generation Performance',
    expect: { helpText: 'Rate how effectively the employee moves prospects through the sales pipeline.' },
    set: { helpText: 'Rate how effectively prospects are moved through the sales pipeline.' },
  },
  {
    id: '6a77c3b5c8a931ed974db10c',
    where: 'Digital Marketing & Sales › Sales & Lead Generation Performance',
    expect: {
      helpText:
        'Provide one specific example of a target met or prospect successfully converted, including what steps you took.',
    },
    set: {
      helpText:
        'Provide one specific example of a target met or prospect successfully converted, including the steps taken.',
    },
  },
  {
    id: '6a77c3b5c8a931ed974db118',
    where: 'Digital Marketing & Sales › Digital Communication & Product Knowledge',
    expect: {
      helpText:
        'Rate how quickly and thoroughly the employee answers customer queries across digital channels.',
    },
    set: {
      helpText: 'Rate how quickly and thoroughly customer queries are answered across digital channels.',
    },
  },

  // ------------------------------------------------------- Management -------
  {
    id: '6a77c3b5c8a931ed974db165',
    where: 'Management › Leadership & Team Management',
    expect: {
      helpText:
        'Rate how effectively this manager communicates objectives, success criteria and individual responsibilities.',
    },
    set: {
      helpText:
        'Rate how effectively objectives, success criteria and individual responsibilities are communicated.',
    },
  },
  {
    id: '6a77c3b5c8a931ed974db167',
    where: 'Management › Leadership & Team Management',
    expect: {
      helpText:
        'Rate how well this manager creates a positive work environment and inspires commitment to goals.',
    },
    set: {
      helpText:
        'Rate how well a positive work environment is created and commitment to goals inspired.',
    },
  },
  {
    id: '6a77c3b5c8a931ed974db16b',
    where: 'Management › Sales Performance & Business Results',
    expect: {
      helpText:
        "Rate the manager's approach to identifying opportunities, coaching team on sales techniques and executing plans.",
    },
    set: {
      helpText:
        'Rate the approach to identifying opportunities, coaching the team on sales techniques and executing plans.',
    },
  },
  {
    id: '6a77c3b5c8a931ed974db16f',
    where: 'Management › Staff Supervision & Operational Control',
    expect: {
      helpText:
        'Rate how effectively this manager monitors task completion, quality and adherence to procedures.',
    },
    set: {
      helpText:
        'Rate how effectively task completion, quality and adherence to procedures are monitored.',
    },
  },
  {
    id: '6a77c3b5c8a931ed974db174',
    where: 'Management › Customer Service & Accountability',
    expect: {
      helpText:
        "Rate the manager's focus on customer experience, service standards and team accountability for customer satisfaction.",
    },
    set: {
      helpText:
        'Rate the focus on customer experience, service standards and team accountability for customer satisfaction.',
    },
  },
  {
    id: '6a77c3b5c8a931ed974db175',
    where: 'Management › Customer Service & Accountability',
    expect: {
      helpText:
        'Rate how readily this manager accepts responsibility, acts on feedback and follows through on commitments.',
    },
    set: {
      helpText:
        'Rate how readily responsibility is accepted, feedback acted on, and commitments followed through.',
    },
  },

  // -------------------------------------------------------- Warehouse -------
  {
    id: '6a77c3b5c8a931ed974db134',
    where: 'Warehouse › Overall Performance & Development',
    expect: {
      helpText: 'Identify a specific competency or skill where growth would benefit their performance.',
    },
    set: {
      helpText: 'Identify a specific competency or skill where growth would make the biggest difference.',
    },
  },

  // -------------------------------------------------------- Logistics ------
  {
    id: '6a77c3b5c8a931ed974db14d',
    where: 'Logistics › Safety and Compliance',
    expect: {
      helpText:
        'Rate how consistently this driver follows safe driving practices and maintains awareness of road hazards.',
    },
    set: {
      helpText:
        'Rate how consistently safe driving practices are followed and awareness of road hazards is maintained.',
    },
  },
  {
    id: '6a77c3b5c8a931ed974db14f',
    where: 'Logistics › Safety and Compliance',
    expect: {
      helpText:
        'Rate how the driver manages risk, avoids collisions or damage, and communicates incidents when they occur.',
    },
    set: {
      helpText:
        'Rate how risk is managed, how collisions or damage are avoided, and how promptly incidents are communicated.',
    },
  },
];

/**
 * Individual FIELDS (`<questionId>.<field>`) whose person-marker is
 * legitimate, so the residual report below stops flagging them. Listed rather
 * than silently pattern-matched away because each is a judgement someone made,
 * and a future reader deserves the reason rather than an unexplained
 * exclusion.
 *
 * Keyed per field, not per question, deliberately: 74ac's LABEL is fine but
 * its helpText was one of the defects fixed above, and exempting the whole
 * question would blind the check to a regression on the very field it exists
 * to watch.
 */
const MARKER_EXEMPT = new Map([
  [
    '6a77c6291d5b1889c97674ac.label',
    '"upon their arrival" — "their" is the CUSTOMERS\', not the subject\'s. Reads correctly for every kind.',
  ],
]);

/**
 * Words that name a specific person. Used only to REPORT what a human should
 * look at after the run — never to rewrite anything. Second person is not on
 * the list: "Provide your overall assessment" addresses whoever is filling the
 * form and is correct for every kind.
 */
const PERSON_MARKERS =
  /\b(this|the)\s+(attendant|employee|person|driver|manager|staff member)\b|\btheir\b|\bthey\b|\bhe\b|\bshe\b/i;

const sameArray = (a, b) =>
  Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => v === b[i]);
const equal = (a, b) => (Array.isArray(b) ? sameArray(a, b) : a === b);

async function main() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGO_URI is not set');
  await mongoose.connect(uri);

  const template = await AppraisalTemplate.findOne({
    tenant: TENANT,
    name: TEMPLATE_NAME,
    isLatest: true,
  }).lean();
  if (!template) throw new Error(`No isLatest template named "${TEMPLATE_NAME}" for tenant ${TENANT}`);

  console.log(`Template: ${template.name} v${template.version}  _id=${template._id}`);
  console.log(`Family:   ${template.family}  sections=${template.sections.length}\n`);

  // Constraint 3: copy-on-write. An in-place edit is only legal while no
  // launched cycle is pinned to this exact version.
  const launched = await hasLaunchedCycleFor(template.tenant, template._id);
  if (launched) {
    throw new Error(
      'A LAUNCHED cycle pins this template version. An in-place edit would rewrite a form ' +
        'reviewers may already have open. Fork a new version through updateTemplate instead.'
    );
  }
  console.log('✓ No launched cycle pins this version — in-place edit is legal.\n');

  // Index every question by id, remembering the section it lives in.
  const byId = new Map();
  for (const section of template.sections) {
    for (const q of section.questions) byId.set(String(q._id), { q, section });
  }

  const ops = [];
  const problems = [];
  let changed = 0;
  let already = 0;

  for (const edit of EDITS) {
    const hit = byId.get(edit.id);
    if (!hit) {
      problems.push(`${edit.id} (${edit.where}): no such question in this template`);
      continue;
    }
    const { q } = hit;
    const set = {};

    for (const [field, want] of Object.entries(edit.set)) {
      const current = field === 'askOf' ? (q.askOf || []).map(String) : q[field];
      const expected = edit.expect[field];

      if (equal(current, want)) continue; // already applied
      if (expected !== undefined && !equal(current, expected)) {
        problems.push(
          `${edit.id} (${edit.where}) .${field}: unexpected current value\n` +
            `      expected: ${JSON.stringify(expected)}\n` +
            `      found:    ${JSON.stringify(current)}`
        );
        continue;
      }
      set[`sections.$[s].questions.$[q].${field}`] = want;
    }

    if (Object.keys(set).length === 0) {
      already += 1;
      continue;
    }
    changed += 1;

    console.log(`~ ${edit.where}  [${edit.id}]`);
    for (const [path, want] of Object.entries(set)) {
      const field = path.split('.').pop();
      const current = field === 'askOf' ? (q.askOf || []).map(String) : q[field];
      console.log(`    ${field}:`);
      console.log(`      - ${JSON.stringify(current)}`);
      console.log(`      + ${JSON.stringify(want)}`);
    }
    console.log('');

    // Addressed through arrayFilters on the existing _ids: this edits the
    // subdocument in place and cannot mint a new one.
    ops.push({
      updateOne: {
        filter: { _id: template._id, tenant: template.tenant },
        update: { $set: set },
        arrayFilters: [
          { 's._id': new mongoose.Types.ObjectId(String(hit.section._id)) },
          { 'q._id': new mongoose.Types.ObjectId(edit.id) },
        ],
      },
    });
  }

  if (problems.length) {
    console.error('\nABORTING — the template does not look the way this script expects:\n');
    for (const p of problems) console.error(`  ✗ ${p}`);
    console.error(
      '\nSomebody has edited the template since this script was written. Re-read it before proceeding.'
    );
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(`${changed} question(s) to change, ${already} already correct.\n`);

  if (!APPLY) {
    console.log('Dry run — nothing written. Re-run with --apply to write.');
  } else if (ops.length === 0) {
    console.log('Nothing to write.');
  } else {
    const res = await AppraisalTemplate.bulkWrite(ops);
    console.log(`Applied. matched=${res.matchedCount} modified=${res.modifiedCount}`);
  }

  await verify(template._id, APPLY && ops.length > 0);
  await mongoose.disconnect();
}

/**
 * Re-read and check the two things that must hold, plus a human-review report.
 */
async function verify(templateId, expectApplied) {
  const fresh = await AppraisalTemplate.findById(templateId).lean();

  // 1. No _id was reminted. This is the constraint that silently orphans
  //    stored answers if it is ever broken, so it is checked explicitly rather
  //    than trusted to the update operator.
  const expectedIds = new Set();
  for (const s of fresh.sections) {
    expectedIds.add(String(s._id));
    for (const q of s.questions) expectedIds.add(String(q._id));
  }
  const missing = EDITS.filter((e) => !expectedIds.has(e.id));
  console.log(
    `\n${missing.length === 0 ? '✓' : '✗'} identity: all ${EDITS.length} edited question _ids still present` +
      (missing.length ? ` (MISSING: ${missing.map((m) => m.id).join(', ')})` : '')
  );
  console.log(
    `✓ shape: ${fresh.sections.length} sections, ` +
      `${fresh.sections.reduce((n, s) => n + s.questions.length, 0)} questions`
  );

  // 2. Residual person-markers on questions a self-assessor can see. Reported,
  //    not asserted: some are legitimate (a peer-only prompt naming the
  //    subject is correct), so a human decides.
  const residual = [];
  for (const s of fresh.sections) {
    for (const q of s.questions) {
      const askOf = q.askOf || [];
      if (askOf.length < 2 || !askOf.includes('self')) continue;
      for (const field of ['label', 'helpText']) {
        if (MARKER_EXEMPT.has(`${q._id}.${field}`)) continue;
        if (q[field] && PERSON_MARKERS.test(q[field])) {
          residual.push(`  ${s.title} [${askOf.join(',')}] .${field}: ${JSON.stringify(q[field])}`);
        }
      }
    }
  }
  console.log(
    residual.length === 0
      ? '✓ wording: no self-inclusive question names a third person'
      : `! wording: ${residual.length} self-inclusive field(s) still name a person — review:\n${residual.join('\n')}`
  );
  for (const [id, why] of MARKER_EXEMPT) console.log(`  (exempt ${id}: ${why})`);

  if (expectApplied) console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
