// server/services/appraisal.helpers.js
//
// Pure decision logic for the appraisal module. Nothing here touches the
// database, which is what lets the security-critical access rules be unit
// tested exhaustively.

const mongoose = require('mongoose');

const APPRAISAL_STATES = [
  'draft',
  'nominating',            // Phase 2
  'pending_peer_approval', // Phase 2
  'collecting',
  'summarising',
  'released',
  'acknowledged',
  'cancelled',
];

// Phase 1 uses draft → collecting → … ; the two nomination states are declared
// so Phase 2 adds behaviour without a data migration.
const TRANSITIONS = {
  draft: ['nominating', 'collecting', 'cancelled'],
  // 'collecting' is HR's skip-peers escape hatch: an employee who never
  // nominates must not be able to hold their own appraisal hostage.
  nominating: ['pending_peer_approval', 'collecting', 'cancelled'],
  pending_peer_approval: ['collecting', 'cancelled'],
  collecting: ['summarising', 'cancelled'],
  summarising: ['released', 'cancelled'],
  released: ['acknowledged', 'cancelled'],
  acknowledged: [],
  cancelled: [],
};

function canTransition(from, to) {
  return Boolean(TRANSITIONS[from]?.includes(to));
}

function assertTransition(from, to) {
  if (!canTransition(from, to)) {
    const err = new Error(
      `Illegal appraisal transition: ${from} → ${to}`
    );
    err.status = 400;
    throw err;
  }
}

// Roles that hold appraisals:manage within their own tenant.
const HR_ROLES = ['super_admin', 'admin', 'tenant_owner', 'tenant_admin'];

// Roles that count as "a person in this tenant" for cycle launch (who gets an
// appraisal) and peer nomination (who may be nominated to review one). Kept
// as the single shared definition — appraisalCycle.controller.js and
// appraisal.controller.js both import it rather than each declaring their
// own list that could quietly drift apart.
const TENANT_ROLES = ['tenant_owner', 'tenant_admin', 'tenant_staff'];

const NO_ACCESS = {
  relation: 'none',
  canRead: false,
  canSeeReviewerNames: false,
  canSummarise: false,
  canRelease: false,
  canAcknowledge: false,
  canManageCycle: false,
  canNominate: false,
  canApprovePeers: false,
  canBackfillPeers: false,
};

const idOf = (v) => (v && v._id ? String(v._id) : v == null ? '' : String(v));

/**
 * Resolve what `user` may do with `appraisal`.
 *
 * Precedence is subject → hr → manager → reviewer. `subject` is deliberately
 * first: an HR user who is themselves being appraised must resolve as the
 * subject on their own record, or they could unmask feedback written about
 * them. `hr` precedes `manager` so HR keeps full powers over everyone else,
 * including their own direct reports.
 */
function resolveAppraisalAccess(user, appraisal) {
  if (!user || !appraisal) return { ...NO_ACCESS };

  // Cross-tenant access is never possible, whatever the ids say. A missing
  // tenant on either side denies rather than matching: idOf maps null to '',
  // so a bare equality check would let two tenant-less objects through.
  const userTenant = idOf(user.tenant);
  const appraisalTenant = idOf(appraisal.tenant);
  if (!userTenant || !appraisalTenant || userTenant !== appraisalTenant) {
    return { ...NO_ACCESS };
  }

  const uid = idOf(user._id);
  const state = appraisal.state;

  if (uid === idOf(appraisal.employee)) {
    const visible = state === 'released' || state === 'acknowledged';
    return {
      relation: 'subject',
      canRead: visible,
      canSeeReviewerNames: false,
      canSummarise: false,
      canRelease: false,
      canAcknowledge: state === 'released',
      canManageCycle: false,
      canNominate: state === 'nominating',
      canApprovePeers: false,
      canBackfillPeers: false,
    };
  }

  if (HR_ROLES.includes(user.role)) {
    return {
      relation: 'hr',
      canRead: true,
      canSeeReviewerNames: true,
      // Gated the same as the manager branch below: without this, HR could
      // silently rewrite the summary/finalRating of an appraisal that is
      // already released, acknowledged (signed off by the employee), or even
      // cancelled — saveSummary only guards the collecting→summarising
      // *transition*, not who may edit once already in a later state.
      canSummarise: state === 'collecting' || state === 'summarising',
      canRelease: state === 'summarising',
      canAcknowledge: false,
      canManageCycle: true,
      // HR holds all three so a stalled appraisal can be unblocked by acting
      // on the employee's or manager's behalf — see the spec's stall surface.
      canNominate: state === 'nominating',
      canApprovePeers: state === 'pending_peer_approval',
      canBackfillPeers: state === 'collecting',
    };
  }

  if (uid === idOf(appraisal.manager)) {
    return {
      relation: 'manager',
      canRead: true,
      canSeeReviewerNames: true,
      canSummarise: state === 'collecting' || state === 'summarising',
      canRelease: state === 'summarising',
      canAcknowledge: false,
      canManageCycle: false,
      canNominate: false,
      canApprovePeers: state === 'pending_peer_approval',
      canBackfillPeers: state === 'collecting',
    };
  }

  const reviewerIds = (appraisal.reviewerIds || []).map(idOf);
  if (reviewerIds.includes(uid)) {
    return {
      relation: 'reviewer',
      canRead: false, // reviewers see only their own feedback row
      canSeeReviewerNames: false,
      canSummarise: false,
      canRelease: false,
      canAcknowledge: false,
      canManageCycle: false,
      canNominate: false,
      canApprovePeers: false,
      canBackfillPeers: false,
    };
  }

  return { ...NO_ACCESS };
}

/**
 * Strip the reviewer identity from peer feedback for viewers who may not see
 * it. Self and manager feedback are attributed by definition — there is only
 * one possible author and hiding it would be theatre.
 *
 * Also strips `answers` from any row that is not 'submitted'. A 'declined' or
 * 'expired' row can carry draft content the reviewer typed and saved before
 * declining/timing out — saveDraft only requires status 'pending', so answers
 * can sit on a row that never reached 'submitted'. The manager/HR are told
 * only THAT a peer declined (via status/declinedAt/declineReason, so backfill
 * can be offered), never what they had drafted and chose to withhold. Doing
 * this here, at the one projection choke point every viewer's payload passes
 * through, also covers 'expired' rows and any row already sitting in the
 * database with stale draft content — clearing `answers` in declineFeedback
 * itself would not reach either of those.
 */
function projectFeedbackForViewer(feedback, access) {
  const plain =
    typeof feedback?.toObject === 'function' ? feedback.toObject() : { ...feedback };
  if (plain.kind === 'peer' && !access?.canSeeReviewerNames) {
    delete plain.reviewer;
  }
  if (plain.status !== 'submitted') {
    delete plain.answers;
  }
  return plain;
}

/**
 * Decide which appraisals a cycle launch should create.
 *
 * Employees without a manager are reported rather than given an orphan
 * appraisal nobody can complete. Employees who already have an appraisal for
 * this cycle are skipped, which makes re-launching safe.
 */
function planCycleLaunch(employees, existingEmployeeIds = []) {
  const existing = new Set(existingEmployeeIds.map(idOf));
  const toCreate = [];
  const skipped = [];
  const alreadyExists = [];

  for (const emp of employees || []) {
    const employee = idOf(emp._id);
    if (existing.has(employee)) {
      alreadyExists.push(employee);
      continue;
    }
    const manager = idOf(emp.employeeProfile?.work?.manager);
    if (!manager) {
      skipped.push({ employee, reason: 'no_manager' });
      continue;
    }
    if (manager === employee) {
      skipped.push({ employee, reason: 'self_manager' });
      continue;
    }
    toCreate.push({ employee, manager });
  }

  return { toCreate, skipped, alreadyExists };
}

/**
 * The single template Phase 1 seeds per tenant. Every question is asked of both
 * self and manager so the two answers land on the same questionId and can be
 * compared directly. `peer` is included so Phase 2 needs no data migration.
 */
function buildDefaultTemplate(tenantId, createdBy) {
  const all = ['self', 'manager', 'peer'];
  return {
    tenant: tenantId,
    // Generated per call, never shared: a fixed family id would make two
    // unrelated tenants' default templates look like versions of each other.
    family: new mongoose.Types.ObjectId(),
    version: 1,
    isLatest: true,
    isDefault: true,
    name: 'General Performance Review',
    description: 'Default appraisal form.',
    isArchived: false,
    createdBy,
    sections: [
      {
        title: 'Performance',
        questions: [
          { type: 'rating', label: 'Quality of work', scaleMax: 5, required: true, askOf: all },
          { type: 'rating', label: 'Reliability and follow-through', scaleMax: 5, required: true, askOf: all },
          { type: 'rating', label: 'Communication', scaleMax: 5, required: true, askOf: all },
          { type: 'rating', label: 'Collaboration with others', scaleMax: 5, required: true, askOf: all },
        ],
      },
      {
        title: 'Comments',
        questions: [
          { type: 'text', label: 'What went well this period?', required: true, askOf: all },
          { type: 'text', label: 'What should improve next period?', required: true, askOf: all },
        ],
      },
    ],
  };
}

/**
 * Filter a template's sections down to the questions a given reviewer `kind`
 * is actually asked (per question.askOf). Shared by every appraisal-feedback
 * read/write path so "which questions can this reviewer answer" has exactly
 * one definition instead of being reimplemented per handler.
 */
function filterSectionsForKind(sections, kind) {
  return (sections || [])
    .map((s) => ({
      ...s,
      questions: (s.questions || []).filter((q) => (q.askOf || []).includes(kind)),
    }))
    .filter((s) => s.questions.length > 0);
}

/**
 * The set of question ids (as strings) present in an already
 * kind-filtered sections array — see filterSectionsForKind.
 */
function getAskedQuestionIds(filteredSections) {
  const ids = new Set();
  for (const section of filteredSections || []) {
    for (const q of section.questions || []) {
      if (q._id != null) ids.add(String(q._id));
    }
  }
  return ids;
}

/**
 * Split submitted answers into those keyed to a question this reviewer was
 * actually asked, and those that are not (a manager/peer-only question, or a
 * fabricated id matching no question at all). Callers reject rather than
 * silently drop the rejected ones: an answer to a question the reviewer was
 * never asked is a bug or an attempted bypass of the askOf contract, not
 * data to discard quietly.
 */
function partitionAnswersByAskedQuestions(answers, askedQuestionIds) {
  const allowed = [];
  const rejected = [];
  for (const a of answers || []) {
    const qid = a && a.questionId != null ? String(a.questionId) : null;
    if (qid && askedQuestionIds.has(qid)) {
      allowed.push(a);
    } else {
      rejected.push(qid || '(missing questionId)');
    }
  }
  return { allowed, rejectedIds: [...new Set(rejected)] };
}

// Below this many SUBMITTED peer responses, releasing prompts the manager to
// confirm. A constant, not a cycle field: nobody has asked to tune it, and an
// unused knob is a maintenance cost. Phase 3 can promote it if HR asks.
const PEER_RELEASE_MIN = 2;

// Question types buildComparison will average self against manager against the
// peer mean. Membership is "is this ordinal on a 1..scaleMax axis", NOT "does
// this store a number":
//
//   rating, likert, scale -> in.  Same axis, so a mean is arithmetic that means
//                                 something, and barPercent has a denominator.
//   yes_no                -> OUT. Stored as rating 1/0, so it would sail
//                                 through a "typeof === number" check and draw
//                                 a 1-of-5 bar for "no". The honest rendering
//                                 of binary answers is a yes/no split, which is
//                                 not what this table is.
//   choice, text          -> OUT. Categorical / free text; no ordering to mean.
const COMPARABLE_QUESTION_TYPES = new Set(['rating', 'likert', 'scale']);

/**
 * A tenant with fewer eligible people than the cycle's peerCountMin must still
 * be able to run a nomination. The configured minimum is an aspiration, not a
 * reason to make the step impossible.
 */
function effectiveNominationMin(peerCountMin, eligibleCount) {
  return Math.min(Number(peerCountMin) || 0, Number(eligibleCount) || 0);
}

/**
 * Validate a proposed peer list. Returns human-readable errors because they
 * surface directly to whoever is nominating; callers reject the whole request
 * rather than partially applying, so a half-valid list never lands.
 */
function validateNominations(candidateIds, opts) {
  // Destructuring defaults fire on `undefined` only, never on `null`. A caller
  // passing `{ eligibleIds: null }` used to throw TypeError on `.map`, and
  // `{ max: null }` coerced to 0 in the comparison and rejected every
  // otherwise-valid list. Normalised explicitly here, matching the `|| []`
  // guard `candidateIds` below has always had.
  const { subjectId, managerId, eligibleIds, min, max } = opts || {};
  const minCount = Number(min) || 0;
  const maxCount = max == null ? Infinity : Number(max);
  const errors = [];
  const raw = (candidateIds || []).map(idOf).filter(Boolean);
  const userIds = [...new Set(raw)];

  if (userIds.length !== raw.length) errors.push('The same person was nominated more than once.');
  if (userIds.includes(idOf(subjectId))) errors.push('You cannot nominate yourself.');
  if (userIds.includes(idOf(managerId))) {
    errors.push('Your manager already writes a manager assessment and cannot also be a peer.');
  }

  const eligible = new Set((eligibleIds || []).map(idOf));
  if (userIds.some((u) => !eligible.has(u))) {
    errors.push('One or more of the people nominated are not eligible to review this appraisal.');
  }
  if (userIds.length < minCount) {
    errors.push(`Nominate at least ${minCount} ${minCount === 1 ? 'person' : 'people'}.`);
  }
  if (userIds.length > maxCount) {
    errors.push(`Nominate at most ${maxCount} ${maxCount === 1 ? 'person' : 'people'}.`);
  }

  return { valid: errors.length === 0, errors, userIds };
}

/**
 * Apply a manager's approve/reject/add decisions to the nomination array.
 * A name the decider adds themselves is stored already 'approved' — routing it
 * back through 'proposed' would mean asking them to approve their own choice.
 *
 * `add` also REINSTATES someone already on the list. Previously the dedup set
 * was built from every nomination regardless of status, so adding a peer who
 * had been rejected earlier was silently skipped: the endpoint answered
 * `200 {"peersAdded": 0}` and, because the UI hides rejected nominees, the
 * manager could not see why nothing happened. That was a real dead end — a
 * peer rejected by mistake could never be put back. Reinstating restamps
 * decidedBy/decidedAt so the audit trail records the second decision as this
 * decider's, at this moment.
 *
 * Where `add` and `reject` name the same person in one request, `add` wins:
 * it is the more specific "put this person on the list" instruction, and the
 * alternative — rejecting someone the caller explicitly asked for — is the
 * surprising outcome. Someone already 'approved' who is merely re-named in
 * `add` keeps their original decidedBy/decidedAt: nothing was decided, so
 * restamping would falsify when the approval actually happened.
 */
function applyNominationDecisions(nominations, decisions, deciderId) {
  const { approve: approveIn, reject: rejectIn, add: addIn } = decisions || {};
  const approve = new Set((approveIn || []).map(idOf));
  const reject = new Set((rejectIn || []).map(idOf));
  const add = (addIn || []).map(idOf).filter(Boolean);
  const reinstate = new Set(add);
  const decidedAt = new Date();

  const out = (nominations || []).map((n) => {
    const uid = idOf(n.user);
    if (!approve.has(uid) && !reject.has(uid) && !reinstate.has(uid)) return n;
    const status = approve.has(uid) || reinstate.has(uid) ? 'approved' : 'rejected';
    if (status === 'approved' && n.status === 'approved') return n;
    return {
      ...(typeof n.toObject === 'function' ? n.toObject() : n),
      status,
      decidedBy: deciderId,
      decidedAt,
    };
  });

  const known = new Set(out.map((n) => idOf(n.user)));
  for (const uid of add) {
    if (known.has(uid)) continue;
    known.add(uid);
    out.push({
      user: uid,
      proposedBy: deciderId,
      status: 'approved',
      decidedBy: deciderId,
      decidedAt,
    });
  }
  return out;
}

/**
 * Which approved peers still need an AppraisalFeedback row. Skipping anyone
 * already in reviewerIds makes approve-peers and backfill idempotent — a
 * double-submitted approval must not collide on unique(appraisal, reviewer).
 */
function planPeerRowCreation(nominations, existingReviewerIds) {
  // `|| []` rather than a destructuring/parameter default: the latter fires on
  // `undefined` only, so an explicit `null` threw on `.map`. Matches the guard
  // `nominations` below already had.
  const seen = new Set((existingReviewerIds || []).map(idOf));
  const out = [];
  for (const n of nominations || []) {
    if (n.status !== 'approved') continue;
    const uid = idOf(n.user);
    if (!uid || seen.has(uid)) continue;
    seen.add(uid);
    out.push(uid);
  }
  return out;
}

/**
 * How many of an appraisal's nominated peers are actually approved.
 *
 * The single definition of "an approved peer". This count drives three
 * separate things — what getAppraisal tells every viewer their 360 rests on,
 * whether peerReleaseGate warns before release, and the bare number the
 * subject sees past 'nominating' — and it was written out longhand in all
 * three places. Changing what 'approved' means (a fourth status, a
 * withdrawn flag) has to change all of them together or the employee is told
 * one number while the gate uses another.
 */
function countApprovedPeers(appraisal) {
  return (appraisal?.peerNominations || []).filter((n) => n.status === 'approved').length;
}

/**
 * The ONLY appraisal-derived payload the subject may read before release.
 *
 * This is an allow-list, deliberately: it can return nothing but the keys
 * written here, so a field added to Appraisal later cannot leak through it the
 * way it could through a strip-list projection. Past 'nominating' it collapses
 * to a bare count, which is what keeps the manager's rejections invisible.
 */
function nominationViewForSubject(appraisal, cycle, eligibleCount) {
  const state = appraisal?.state;
  const nominations = appraisal?.peerNominations || [];

  if (state !== 'nominating') {
    return { state, approvedCount: countApprovedPeers(appraisal) };
  }

  return {
    state,
    min: effectiveNominationMin(cycle?.peerCountMin, eligibleCount),
    max: Number(cycle?.peerCountMax) || 0,
    deadline: cycle?.nominationDeadline || null,
    // Names the employee typed themselves — returning them leaks nothing.
    myProposals: nominations
      .filter((n) => n.status === 'proposed')
      .map((n) => ({ user: n.user })),
  };
}

/**
 * Soft gate on releasing an appraisal built on thin peer input.
 *
 * Silent when no peer was ever approved: an appraisal HR deliberately ran
 * without peers is not a degraded 360, and warning every time would train
 * managers to click through the warning that does matter.
 */
function peerReleaseGate({ approvedPeerCount = 0, submittedPeerCount = 0, confirmed = false } = {}) {
  if (approvedPeerCount === 0) return { blocked: false };
  if (submittedPeerCount >= PEER_RELEASE_MIN) return { blocked: false };
  if (confirmed) return { blocked: false };
  return {
    blocked: true,
    code: 'LOW_PEER_RESPONSE_COUNT',
    approvedPeerCount,
    submittedPeerCount,
    threshold: PEER_RELEASE_MIN,
  };
}

// Every reason a nudge can carry. Kept beside outstandingActionsFor because
// the two must agree: a reason the planner can emit but the AppraisalNudge
// enum rejects fails at write time, on the one path HR uses when a cycle is
// already stuck.
const NUDGE_REASONS = ['nominate', 'approve_peers', 'feedback', 'summarise', 'acknowledge'];

/**
 * Who is holding this appraisal up, and for what.
 *
 * One definition, used by the roster (to show it) and the nudge endpoint (to
 * refuse a target who is not actually outstanding — which is also what stops
 * that endpoint being used to probe who is on an appraisal).
 *
 * Keyed on the appraisal's OWN state, exhaustively over APPRAISAL_STATES:
 *   nominating            → the employee must nominate peers (no reviewer is
 *                           waited on yet; feedback rows do not exist).
 *   pending_peer_approval → the manager must decide the nominations.
 *   collecting            → every reviewer whose row is still 'pending'; when
 *                           none are, the work has moved to the manager's
 *                           summary. A cycle with peerReviewEnabled:false
 *                           launches straight into this state with only the
 *                           self and manager rows, and is handled by the same
 *                           branch — there is nothing to nominate.
 *   summarising           → the manager still owes the summary/release.
 *   released              → the employee still owes the acknowledgement.
 *   draft/acknowledged/cancelled → nobody owes anything. A cancelled appraisal
 *                           can still carry pending rows that closeCycle has
 *                           not expired; they must not resurrect it.
 *
 * A 'declined' or 'expired' feedback row is NOT outstanding: nudging someone
 * who explicitly declined is harassment, and nudging an expired row asks for
 * something the cycle no longer accepts. 'submitted' is done by definition.
 *
 * Rows are matched to this appraisal when they say which one they belong to.
 * The roster loads a whole cycle's feedback in one query and groups it in
 * memory; a grouping slip would otherwise send HR to chase someone who has
 * already done their part on this record.
 */
function outstandingActionsFor(appraisal, feedbackRows) {
  if (!appraisal) return [];
  const employee = idOf(appraisal.employee);
  const manager = idOf(appraisal.manager);
  const appraisalId = idOf(appraisal._id);

  switch (appraisal.state) {
    case 'nominating':
      return employee ? [{ target: employee, reason: 'nominate' }] : [];
    case 'pending_peer_approval':
      return manager ? [{ target: manager, reason: 'approve_peers' }] : [];
    case 'collecting': {
      const pending = (feedbackRows || [])
        .filter((f) => {
          if (!f || f.status !== 'pending') return false;
          if (f.appraisal == null || !appraisalId) return true;
          return idOf(f.appraisal) === appraisalId;
        })
        .map((f) => idOf(f.reviewer))
        // A row with no reviewer is unchaseable; emitting target '' would put
        // a nudge button in the roster that can only ever 400.
        .filter(Boolean)
        .map((target) => ({ target, reason: 'feedback' }));
      if (pending.length) return pending;
      return manager ? [{ target: manager, reason: 'summarise' }] : [];
    }
    case 'summarising':
      return manager ? [{ target: manager, reason: 'summarise' }] : [];
    case 'released':
      return employee ? [{ target: employee, reason: 'acknowledge' }] : [];
    default:
      // draft, acknowledged, cancelled, and any unrecognised state.
      return [];
  }
}

/**
 * Self vs manager vs peer, one row per RATING question.
 *
 * The payoff of `askOf`: every reviewer kind answers the SAME questionId, so
 * "the employee rated themselves 5, peers averaged 2.8" is a direct lookup
 * rather than a mapping exercise. Question _ids survive a template fork
 * unchanged precisely so this join keeps working across versions.
 *
 * Text answers are excluded deliberately — prose reads better in the feedback
 * cards than as a bar, and a text answer has no mean.
 *
 * IMPORTANT: call this with the ALREADY-PROJECTED feedback array, after
 * projectFeedbackForViewer has run. For a subject viewer that means
 * `peerBreakdown` is not merely gated off by canSeeReviewerNames — the
 * `reviewer` field is not in the input at all, and non-submitted rows have
 * already had `answers` stripped. Two independent reasons it cannot populate,
 * one of them structural. This helper therefore takes exactly one feedback
 * array and never reaches past it: no DB read, no second "raw" argument a
 * caller could use to route around the projection.
 *
 * Reads feedback rows by property, never by spreading them: a hydrated
 * Mongoose document spreads to `{$__, _doc}`, which would silently empty every
 * bucket instead of failing loudly.
 */
function buildComparison(sections, feedback, access) {
  const submitted = (feedback || []).filter((f) => f && f.status === 'submitted');
  const named = access?.canSeeReviewerNames === true;
  const out = [];

  // A missing answer and a present-but-unrated answer are the same thing: a
  // question this reviewer skipped. Neither may enter a denominator, and
  // neither may be scored 0 — a zero is a bad review nobody gave. A genuine
  // rating of 0 is a real answer and is kept.
  const ratingIn = (r, qid) => {
    const a = (r?.answers || []).find((x) => x && String(x.questionId) === qid);
    return typeof a?.rating === 'number' && Number.isFinite(a.rating) ? a.rating : null;
  };

  for (const section of sections || []) {
    for (const q of section?.questions || []) {
      if (!q || !COMPARABLE_QUESTION_TYPES.has(q.type)) continue;
      const qid = String(q._id);

      const peerRatings = [];
      const breakdown = [];
      for (const r of submitted) {
        if (r.kind !== 'peer') continue;
        const rating = ratingIn(r, qid);
        if (rating === null) continue;
        peerRatings.push(rating);
        if (named && r.reviewer) breakdown.push({ reviewer: r.reviewer, rating });
      }

      const n = peerRatings.length;
      // Shared with peerReleaseGate rather than a second threshold: the number
      // means the same thing in both places — below this, the peer signal is
      // too thin to stand on — and two constants that must agree eventually
      // disagree. Here it is also the anonymity gate: with one respondent the
      // "mean" IS that person's score, and the subject can usually name them.
      // Withheld outright, never rounded or fuzzed, because a perturbed number
      // is still a number to reason backwards from.
      const suppressed = n < PEER_RELEASE_MIN;
      const mean = suppressed
        ? null
        : Math.round((peerRatings.reduce((s, x) => s + x, 0) / n) * 10) / 10;

      out.push({
        sectionTitle: section.title ?? null,
        questionId: q._id,
        label: q.label ?? null,
        // Per question, never pooled: averaging a /5 answer with a /10 answer
        // produces a number that means nothing. Reported as null when unset
        // rather than guessed at, so the UI can decline to draw a bar.
        scaleMax: typeof q.scaleMax === 'number' ? q.scaleMax : null,
        // A question asked of only one kind keeps its row — it is part of the
        // appraisal — and carries askOf so the UI renders the other buckets as
        // "not asked" rather than as an empty bar meaning "nobody responded".
        askOf: Array.isArray(q.askOf) ? [...q.askOf] : [],
        self: ratingIn(submitted.find((f) => f.kind === 'self'), qid),
        manager: ratingIn(submitted.find((f) => f.kind === 'manager'), qid),
        peer: { mean, n, suppressed },
        // null, not [], for a viewer who may not see names: an empty array
        // reads as "no peers responded", which is a different fact.
        peerBreakdown: named ? breakdown : null,
      });
    }
  }
  return out;
}

module.exports = {
  APPRAISAL_STATES,
  TRANSITIONS,
  HR_ROLES,
  TENANT_ROLES,
  canTransition,
  assertTransition,
  resolveAppraisalAccess,
  projectFeedbackForViewer,
  planCycleLaunch,
  buildDefaultTemplate,
  filterSectionsForKind,
  getAskedQuestionIds,
  partitionAnswersByAskedQuestions,
  PEER_RELEASE_MIN,
  COMPARABLE_QUESTION_TYPES,
  effectiveNominationMin,
  validateNominations,
  applyNominationDecisions,
  planPeerRowCreation,
  countApprovedPeers,
  nominationViewForSubject,
  peerReleaseGate,
  NUDGE_REASONS,
  outstandingActionsFor,
  buildComparison,
};
