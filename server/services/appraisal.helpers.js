// server/services/appraisal.helpers.js
//
// Pure decision logic for the appraisal module. Nothing here touches the
// database, which is what lets the security-critical access rules be unit
// tested exhaustively.

const crypto = require('crypto');
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
  canSeePeerFeedback: false,
  canSeeAnswerComments: false,
  canSummarise: false,
  canRelease: false,
  canAcknowledge: false,
  canManageCycle: false,
  canNominate: false,
  canApprovePeers: false,
  canBackfillPeers: false,
};

const idOf = (v) => (v && v._id ? String(v._id) : v == null ? '' : String(v));

// The HR roles whose reach is bounded by the departments they manage. Every
// other HR role (super_admin, the legacy platform 'admin', tenant_owner) sees
// the whole tenant, which is Phase 5 §9.4's rule stated as data rather than as
// a condition repeated in four places.
const DEPARTMENT_SCOPED_HR_ROLES = ['tenant_admin'];

/**
 * Which departments this user's HR powers cover.
 *
 * `null` means unrestricted — an owner or super_admin, who sees everything in
 * the tenant. Anything else is the (deduped, stringified) list of department
 * ids they manage, which for an admin who manages nothing is `[]`.
 *
 * The ONE definition, applied by cycleRoster, the cycle report, the cycle
 * state counts and appraisal detail. `managedDepartmentIds` is passed in
 * rather than queried because this file is DB-free by design; the controllers
 * load it through services/appraisalScope.service.js so no endpoint has to
 * remember to.
 */
function scopeDepartmentsFor(user, managedDepartmentIds = []) {
  if (!user) return [];
  if (!DEPARTMENT_SCOPED_HR_ROLES.includes(user.role)) return null;
  const out = [];
  const seen = new Set();
  for (const d of managedDepartmentIds || []) {
    const id = idOf(d);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * Does this HR user's department scope cover this appraisal?
 *
 * True for every unscoped HR role. For a `tenant_admin`, the appraisal's
 * SNAPSHOTTED department must be one they manage — an appraisal carrying no
 * department (every record launched before Phase 5) is covered by nobody but
 * the owner, which is the conservative reading and the only one that does not
 * hand a pre-Phase-5 backlog to whichever admin asks first.
 */
function hrScopeCovers(user, appraisal, opts) {
  if (!DEPARTMENT_SCOPED_HR_ROLES.includes(user.role)) return true;
  const scope = opts ? opts.departmentScope : undefined;
  if (scope === null) return true;
  if (!Array.isArray(scope)) return false; // fail closed — see the doc block below
  const department = idOf(appraisal.department);
  if (!department) return false;
  return scope.map(idOf).includes(department);
}

/**
 * Resolve what `user` may do with `appraisal`.
 *
 * Precedence is subject → hr → manager → reviewer. `subject` is deliberately
 * first: an HR user who is themselves being appraised must resolve as the
 * subject on their own record, or they could unmask feedback written about
 * them. `hr` precedes `manager` so HR keeps full powers over everyone else,
 * including their own direct reports.
 *
 * Phase 5 §9.4 narrows — never reorders — the `hr` branch: a `tenant_admin`
 * holds HR powers only over appraisals in a department they manage, and
 * otherwise FALLS THROUGH to the ordinary manager/reviewer resolution below
 * like anybody else. `opts.departmentScope` is `null` for an unrestricted
 * viewer and an array of department ids otherwise. Omitting it entirely fails
 * CLOSED for a scoped role: a handler that forgets to load the scope must
 * hand out no HR access at all rather than the tenant-wide access every
 * tenant_admin had before this phase.
 */
function resolveAppraisalAccess(user, appraisal, opts) {
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
      // The subject never reads raw peer feedback, at any state.
      //
      // Stripping the reviewer's name off a peer card was never enough to make
      // it anonymous: prose identifies its author. "As we discussed after the
      // Maitama run" names someone to a team of six no matter whose name is on
      // it, and a colleague who knows that is a colleague who writes nothing
      // worth reading. Anonymity that depends on peers self-censoring the
      // specifics is not anonymity, it is a request for vagueness.
      //
      // So peer input reaches the employee through the manager's summary,
      // which a named person writes and is accountable for. The employee is
      // still told how many peers contributed (approvedPeerCount /
      // peerResponseCount in getAppraisal) so they can judge what the summary
      // rests on — the count is what they need, the transcript is not.
      canSeePeerFeedback: false,
      // The reviewer's per-question notes are part of the manager assessment
      // and follow exactly the same rule as the rest of it: nothing before
      // release. `visible` is reused rather than re-derived so the two can
      // never drift into disagreeing about which states count.
      canSeeAnswerComments: visible,
      canSummarise: false,
      canRelease: false,
      canAcknowledge: state === 'released',
      canManageCycle: false,
      canNominate: state === 'nominating',
      canApprovePeers: false,
      canBackfillPeers: false,
    };
  }

  if (HR_ROLES.includes(user.role) && hrScopeCovers(user, appraisal, opts)) {
    return {
      relation: 'hr',
      canRead: true,
      canSeeReviewerNames: true,
      canSeePeerFeedback: true,
      canSeeAnswerComments: true,
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
      // The manager is the one who reads peer input in full and turns it into
      // a summary they put their name to. That is the whole mechanism: a
      // person is accountable for the judgement, not a form.
      canSeePeerFeedback: true,
      canSeeAnswerComments: true,
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
      canSeePeerFeedback: false,
      canSeeAnswerComments: false,
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
  // Phase 5 §9.3: a reviewer's per-question note follows the same rule as the
  // rest of their assessment — the subject reads it only once released. Done
  // here, at the same choke point that already anonymises peer rows, so there
  // is one place to audit rather than one per renderer. The answers array is
  // rebuilt (not mutated) because `plain` shares its element objects with the
  // caller's row when `feedback` was already a plain/lean object.
  if (!access?.canSeeAnswerComments && Array.isArray(plain.answers)) {
    plain.answers = plain.answers.map((a) => {
      if (!a || typeof a !== 'object' || !('comment' in a)) return a;
      const { comment, ...rest } = a;
      return rest;
    });
  }
  return plain;
}

/**
 * Order feedback rows so their POSITION carries no information.
 *
 * Stripping `reviewer` (above) makes a peer row anonymous on its own, but the
 * order of the array was still the order the rows were created — which is the
 * order the subject's own nominations were approved in. The UI then labelled
 * the cards "Peer feedback 1", "Peer feedback 2", handing the subject a
 * stable index into a list they themselves wrote. Two peers, and the first
 * one they nominated is card 1.
 *
 * So for any viewer who may not see reviewer names, peer rows are reordered by
 * a hash of the row id salted with the appraisal id. Properties that matter:
 *
 *  - Unrelated to creation order, so position leaks nothing.
 *  - Deterministic, so refreshing the page does not shuffle the cards under
 *    someone reading them — the "which one said that" confusion would be a
 *    real usability cost, and re-randomising per request also lets a viewer
 *    average over many loads to recover the true order.
 *  - Salted per appraisal, so the same reviewer does not land in the same
 *    slot across every appraisal they contribute to.
 *
 * Self and manager rows keep their kind-based identity — the subject already
 * knows who wrote those — and are not reordered relative to each other.
 *
 * A viewer WITH `canSeeReviewerNames` gets the rows untouched: they can read
 * the names anyway, and manager/HR screens are easier to scan in a stable
 * order.
 */
function orderFeedbackForViewer(feedback, appraisalId, access) {
  const rows = Array.isArray(feedback) ? feedback : [];
  if (access?.canSeeReviewerNames) return rows;
  const salt = idOf(appraisalId);
  const rank = new Map(
    rows.map((row) => [
      row,
      crypto
        .createHash('sha256')
        .update(`${salt}:${idOf(row?._id)}`)
        .digest('hex'),
    ])
  );
  const peers = rows.filter((r) => r?.kind === 'peer');
  const others = rows.filter((r) => r?.kind !== 'peer');
  peers.sort((a, b) => rank.get(a).localeCompare(rank.get(b)));
  return [...others, ...peers];
}

/**
 * Look a department's manager up in whatever the caller passed: a Map, a
 * plain object keyed by department id, or a function. The controller builds a
 * Map from one Department query; the tests find a function clearer. Neither
 * shape should dictate the other.
 */
function lookupDepartmentManager(lookup, departmentId) {
  if (!lookup || !departmentId) return '';
  if (typeof lookup === 'function') return idOf(lookup(departmentId));
  if (typeof lookup.get === 'function') return idOf(lookup.get(departmentId));
  return idOf(lookup[departmentId]);
}

/**
 * Who reviews this employee (Phase 5 §9.2), and the department that decision
 * was made against.
 *
 * Resolved in a fixed order, each step existing because the one before it can
 * legitimately come up empty:
 *
 *  1. The tenant owner gets NO appraisal — there is nobody above them.
 *     Reported as skipped with a reason, never silently omitted, because an
 *     employee quietly missing from a launch is indistinguishable from a bug.
 *  2. A tenant_admin is reviewed by the owner. An admin reviewed by the
 *     manager of the department they themselves run would be marking their
 *     own homework.
 *  3. Everyone else is reviewed by their department's manager.
 *  4. …unless that resolves to themselves — a department admin sitting inside
 *     their own department — in which case the owner.
 *  5. With no department, or a department nobody manages, fall back to the
 *     employee's own `work.manager`, then to the owner.
 *
 * The result is written into the EXISTING `Appraisal.manager` field. No new
 * reviewer kind is introduced, so `kind: 'manager'` feedback rows, the
 * {tenant, manager, state} index and every downstream query keep working
 * unchanged.
 */
function resolveAppraisalReviewer(employee, { departmentManagerOf, ownerId } = {}) {
  const employeeId = idOf(employee?._id);
  const work = employee?.employeeProfile?.work || {};
  const department = idOf(work.department) || null;
  const owner = idOf(ownerId);
  const workManager = idOf(work.manager);
  const ownerIsOther = Boolean(owner) && owner !== employeeId;

  if (employee?.role === 'tenant_owner') {
    return { reviewer: null, department, reason: 'is_owner' };
  }

  // Steps 5 and the tail of 2/4: work.manager, then the owner, then nobody.
  // `self_manager` is kept distinct from `no_manager` because the two send HR
  // to fix different things — a missing field versus a wrong one.
  const fallback = () => {
    if (workManager && workManager !== employeeId) return { reviewer: workManager, department };
    if (ownerIsOther) return { reviewer: owner, department };
    return { reviewer: null, department, reason: workManager ? 'self_manager' : 'no_manager' };
  };

  if (employee?.role === 'tenant_admin') {
    return ownerIsOther ? { reviewer: owner, department } : fallback();
  }

  const departmentManager = lookupDepartmentManager(departmentManagerOf, department);
  if (departmentManager && departmentManager !== employeeId) {
    return { reviewer: departmentManager, department };
  }
  if (departmentManager && ownerIsOther) {
    // Step 4: they manage the department they are in.
    return { reviewer: owner, department };
  }
  return fallback();
}

/**
 * Decide which appraisals a cycle launch should create.
 *
 * Reviewer routing is resolveAppraisalReviewer's (Phase 5 §9.2); this decides
 * only who is in scope. Employees nobody can review are reported rather than
 * given an orphan appraisal nobody can complete, and so is the owner, who has
 * no reviewer by definition. Employees who already have an appraisal for this
 * cycle are skipped, which makes re-launching safe.
 *
 * `department` rides along on every row and is snapshotted onto the Appraisal
 * for the same reason `manager` always was: an employee transferred mid-cycle
 * must not have the shape of a form they are already filling change under
 * them, and an admin's visibility of a record must not move with the person.
 */
function planCycleLaunch(employees, existingEmployeeIds = [], routing = {}) {
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
    const { reviewer, department, reason } = resolveAppraisalReviewer(emp, routing);
    if (!reviewer) {
      skipped.push({ employee, reason: reason || 'no_manager' });
      continue;
    }
    toCreate.push({ employee, manager: reviewer, department: department || null });
  }

  return { toCreate, skipped, alreadyExists };
}

/**
 * The house peer prompts, shared by the seeded default template and by the AI
 * generator's peer-coverage fallback (appraisalAi.service.js).
 *
 * One definition because they encode a position, not just wording: peers are
 * asked for an INCIDENT, not an impression. "Think of a specific time" is the
 * load-bearing phrase — it is the difference between a colleague recalling
 * something that happened and a colleague summarising how they feel about
 * someone. Two generators drifting apart on that would mean the form a tenant
 * gets depends on whether HR clicked "generate".
 *
 * Carries no `askOf`; callers add `askOf: ['peer']`.
 */
const PEER_EVIDENCE_SECTION_TITLE = 'Working with this person';

const PEER_EVIDENCE_QUESTIONS = [
  {
    type: 'text',
    label: 'Think of a specific time this person made your work easier. What happened?',
    helpText:
      'One concrete example is more useful than a general impression. Only write about what you saw yourself.',
    required: true,
  },
  {
    type: 'text',
    label: 'What is one thing they could do differently that would help you work with them?',
    helpText:
      'Be specific and practical. This is read by their manager, who writes the summary the employee sees.',
    required: true,
  },
];

/**
 * The single template Phase 1 seeds per tenant.
 *
 * Every SCORED question is asked of both self and manager and of neither peer,
 * which is two rules rather than one:
 *
 *  - self+manager, always: buildComparison joins the two on a shared
 *    questionId, so a rating asked of only one of them is a half-empty row.
 *  - never peer: a peer in another function has no basis to score "quality of
 *    work". They answer anyway — a required question leaves no honest way out
 *    — and the guess is then averaged into a mean that reads as measurement.
 *    Ratings are for the manager, who has the context to calibrate them.
 *
 * Peers instead get evidence-shaped prompts about what they personally
 * experienced. "They unblocked my PO backlog twice this quarter" is worth more
 * to a manager writing a summary than a 3.4/5, and it sidesteps the low-n mean
 * problem outright: there is no average to suppress or over-read.
 *
 * `askOf` is per-question and HR-editable, so a tenant that wants peer ratings
 * can still add them — this is the default, not a constraint.
 */
function buildDefaultTemplate(tenantId, createdBy) {
  const bothSides = ['self', 'manager'];
  const peerOnly = ['peer'];
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
          { type: 'rating', label: 'Quality of work', scaleMax: 5, required: true, askOf: bothSides },
          { type: 'rating', label: 'Reliability and follow-through', scaleMax: 5, required: true, askOf: bothSides },
          { type: 'rating', label: 'Communication', scaleMax: 5, required: true, askOf: bothSides },
          { type: 'rating', label: 'Collaboration with others', scaleMax: 5, required: true, askOf: bothSides },
        ],
      },
      {
        title: 'Comments',
        questions: [
          { type: 'text', label: 'What went well this period?', required: true, askOf: bothSides },
          { type: 'text', label: 'What should improve next period?', required: true, askOf: bothSides },
        ],
      },
      {
        // Peer-only, from the shared definition above — the AI generator's
        // peer-coverage fallback appends the same two questions, so a tenant's
        // peer form does not depend on whether HR clicked "generate".
        title: PEER_EVIDENCE_SECTION_TITLE,
        // Copied, not referenced: the constant is module-level and a caller
        // mutating a returned template must not edit every future one.
        questions: PEER_EVIDENCE_QUESTIONS.map((q) => ({ ...q, askOf: peerOnly })),
      },
    ],
  };
}

/**
 * Filter a template's sections down to what a given reviewer is actually
 * asked: the questions their `kind` is asked (per question.askOf), within the
 * sections that apply to the employee's department (per section.departments).
 *
 * A section with no `departments` — or an empty array, which is what the
 * editor stores for "everyone" — is company-wide. A section that names
 * departments is kept only for an employee in one of them, and is then STILL
 * dropped if nothing in it is asked of this reviewer kind: a section whose
 * only questions are peer-only must not open as an empty block on a self form.
 *
 * Shared by every appraisal-feedback read/write path so "which questions can
 * this reviewer answer" has exactly one definition instead of being
 * reimplemented per handler — and because getAskedQuestionIds derives from
 * this, required-field validation, partitionAnswersByAskedQuestions and
 * buildComparison all inherit the department rule with no further change.
 *
 * `departmentId` is the appraisal's SNAPSHOT, not the employee's current
 * department: someone transferred mid-cycle keeps the form they started.
 */
function filterSections(sections, { kind, departmentId } = {}) {
  const dept = idOf(departmentId);
  return (sections || [])
    .filter((s) => {
      const departments = (s?.departments || []).map(idOf).filter(Boolean);
      if (departments.length === 0) return true;
      return Boolean(dept) && departments.includes(dept);
    })
    .map((s) => ({
      ...s,
      questions: (s.questions || []).filter((q) => (q.askOf || []).includes(kind)),
    }))
    .filter((s) => s.questions.length > 0);
}

/**
 * The set of question ids (as strings) present in an already
 * filtered sections array — see filterSections.
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

/**
 * Is this answer a response at all?
 *
 * `notObserved` counts: a peer saying "I can't judge this" HAS answered, and
 * that is the entire point of offering it — a required question with no
 * honest way out is what produces the defensive middle-of-the-scale 3.
 *
 * A rating of 0 counts; `0` is a real score on a 0-based scale and the falsy
 * check that would drop it is the classic bug here. Whitespace-only text does
 * not count — a space bar is not an answer.
 */
function isAnswered(a) {
  if (!a) return false;
  if (a.notObserved === true) return true;
  if (typeof a.rating === 'number' && Number.isFinite(a.rating)) return true;
  if (typeof a.text === 'string' && a.text.trim() !== '') return true;
  if (Array.isArray(a.selected) && a.selected.length > 0) return true;
  return false;
}

/**
 * Enforce who may abstain, and make an abstention exclusive.
 *
 * Peers only: self and manager hold the context to answer, and letting a
 * manager skip a question they are accountable for is a different feature.
 *
 * A not-observed answer is rebuilt from scratch rather than having its value
 * fields deleted, so nothing a client sent alongside the flag survives. The
 * UI can and does leave a previously-picked rating on the answer when the
 * reviewer switches to "can't judge"; trusting the payload would store an
 * abstention that is also a 5.
 */
function normaliseAnswers(answers, kind) {
  const errors = [];
  const out = [];
  for (const a of answers || []) {
    if (a && a.notObserved === true) {
      if (kind !== 'peer') {
        errors.push(
          'Only peer reviewers may mark a question as not observed; a self or manager assessment must answer it.'
        );
        continue;
      }
      out.push({ questionId: a.questionId, notObserved: true });
      continue;
    }
    if (a && 'notObserved' in a) {
      // An explicit `false` carries no meaning and would otherwise persist as
      // noise on every answer the UI touches.
      const { notObserved, ...rest } = a;
      out.push(normaliseAnswerComment(rest, kind));
      continue;
    }
    out.push(normaliseAnswerComment(a, kind));
  }
  return { answers: out, errors };
}

/**
 * Per-question `comment` is the REVIEWER's note on an answer, so only a
 * `manager` row may carry one.
 *
 * Stripped from self and peer rather than rejected: the field is on the shared
 * answer schema, a stale tab or a copy-pasted payload can carry it innocently,
 * and refusing the whole submission over it would block work. What must never
 * happen is an employee annotating their own form and having it render
 * downstream as their reviewer's commentary — the same class of bug as the
 * `notObserved` strip above, and handled the same way: at the one choke point
 * every write passes through, not at the render.
 *
 * A whitespace-only comment is dropped rather than stored: an empty string
 * would render as a note the manager never wrote.
 */
function normaliseAnswerComment(answer, kind) {
  if (!answer || typeof answer !== 'object' || !('comment' in answer)) return answer;
  const { comment, ...rest } = answer;
  if (kind !== 'manager') return rest;
  const text = typeof comment === 'string' ? comment.trim() : '';
  return text ? { ...rest, comment: text } : rest;
}

/**
 * Which required questions this submission left unanswered, by label.
 *
 * Takes an ALREADY filtered sections array (see filterSections),
 * so a question this reviewer was never asked can never be reported missing.
 * Returns labels rather than ids because the message goes to the reviewer.
 */
function findUnansweredRequired(answers, filteredSections) {
  const byId = new Map(
    (answers || [])
      .filter((a) => a && a.questionId != null)
      .map((a) => [String(a.questionId), a])
  );
  const missing = [];
  for (const section of filteredSections || []) {
    for (const q of section?.questions || []) {
      if (!q || q.required !== true) continue;
      // A question with no _id is skipped, matching getAskedQuestionIds, which
      // drops the same questions from the set of ids a reviewer is allowed to
      // answer. The two MUST agree: a required question that is not
      // addressable could never be answered, so demanding it would reject
      // every submission and brick the form outright.
      if (q._id == null) continue;
      if (!isAnswered(byId.get(String(q._id)))) missing.push(q.label ?? String(q._id));
    }
  }
  return missing;
}

// A review that ends in a filing cabinet changes nothing. Releasing therefore
// requires at least one concrete action for the next period, which the next
// cycle's self-assessment opens with — that loop is what turns an appraisal
// from a record into a process.
//
// Capped because a list of fifteen "priorities" is a list of none; the cap is
// a deliberate forcing function, not a storage limit.
const MAX_COMMITMENTS = 8;
const COMMITMENT_MAXLENGTH = 500;

/**
 * Clean a submitted commitment list.
 *
 * Returns `commitments: null` when the caller did not supply the key at all,
 * which is NOT the same as supplying `[]`. saveSummary autosaves partial work,
 * and a payload that simply omits the field must leave whatever is already
 * stored alone rather than silently clearing it — the distinction is the
 * difference between "I didn't touch this" and "I deleted these".
 *
 * Blank entries are dropped rather than rejected: the editor renders empty
 * rows for the manager to type into, and submitting with one still empty is
 * ordinary, not an error worth blocking on.
 */
function normaliseCommitments(input) {
  const errors = [];
  if (input == null) return { commitments: null, errors };
  if (!Array.isArray(input)) {
    errors.push('Commitments must be a list.');
    return { commitments: [], errors };
  }

  const commitments = [];
  for (const c of input) {
    const raw = typeof c === 'string' ? c : typeof c?.text === 'string' ? c.text : '';
    const text = raw.trim();
    if (!text) continue;
    commitments.push({ text: text.slice(0, COMMITMENT_MAXLENGTH) });
  }
  if (commitments.length > MAX_COMMITMENTS) {
    errors.push(
      `Agree at most ${MAX_COMMITMENTS} actions — a longer list is not a plan.`
    );
  }
  return { commitments, errors };
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

// Phase 5 §9.5. The two standings an employee may report on a colleague.
const STANDING_VALUES = ['doing_well', 'needs_support'];
const STANDING_NOTE_MAXLENGTH = 1000;

/**
 * Clean a submitted standing report (Phase 5 §9.5).
 *
 * Every rule here exists because this is the one place in the module where an
 * employee writes about OTHER named people, and it is read by the tenant owner:
 *
 *  - Subjects must come from the candidate list — active colleagues in the
 *    author's own department. Naming someone outside it is not a typo to
 *    tolerate, it is an attempt to file a report on someone the author was
 *    never offered, so the whole submission is rejected rather than partially
 *    applied.
 *  - The author cannot name themselves. `candidateIds` already excludes them;
 *    this is checked separately so the error says the useful thing.
 *  - One entry per subject. Two contradictory standings on one colleague is
 *    not data the owner can act on.
 *  - `entries.length` is capped at the candidate count, which makes the
 *    payload's size a function of the department rather than of the client.
 *
 * Blank/whitespace notes are dropped rather than rejected: the form renders a
 * note box beside every name and leaving one empty is ordinary. An entry with
 * no standing at all is dropped entirely — that is a colleague the author
 * chose not to comment on, which is the expected case for most of the list.
 */
function normaliseStandingEntries(entries, { candidateIds = [], authorId } = {}) {
  const errors = [];
  const candidates = new Set((candidateIds || []).map(idOf).filter(Boolean));
  const author = idOf(authorId);
  const seen = new Set();
  const out = [];

  if (entries != null && !Array.isArray(entries)) {
    return { entries: [], errors: ['Standing feedback must be a list.'] };
  }

  for (const raw of entries || []) {
    const subject = idOf(raw?.subject);
    const standing = typeof raw?.standing === 'string' ? raw.standing : '';
    if (!subject || !standing) continue; // nothing said about this colleague
    if (!STANDING_VALUES.includes(standing)) {
      errors.push(`"${standing}" is not a standing that can be recorded.`);
      continue;
    }
    if (author && subject === author) {
      errors.push('You cannot record a standing for yourself.');
      continue;
    }
    if (!candidates.has(subject)) {
      errors.push('One or more of the people named are not in your department.');
      continue;
    }
    if (seen.has(subject)) {
      errors.push('The same person was given a standing more than once.');
      continue;
    }
    seen.add(subject);
    const note = typeof raw.note === 'string' ? raw.note.trim() : '';
    const entry = { subject, standing };
    if (note) entry.note = note.slice(0, STANDING_NOTE_MAXLENGTH);
    out.push(entry);
  }

  if (out.length > candidates.size) {
    errors.push('More people were named than there are colleagues in your department.');
  }

  return { entries: out, errors: [...new Set(errors)] };
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
/**
 * The appraisal's final score for one reviewer kind: points earned out of
 * points available.
 *
 * This POOLS across questions, which buildComparison deliberately refuses to
 * do — and the difference is not a contradiction. Averaging a /5 answer with a
 * /10 answer produces a number that means nothing, which is why the comparison
 * table reports every question separately. Summing earned over summed possible
 * is well defined at any mix of scales: five out of five plus five out of ten
 * is ten out of fifteen, and that is a true statement about the whole form.
 *
 * Only the ordinal types are counted, the same set buildComparison averages.
 * `yes_no` is excluded even though it stores a number: it means 1/0 but
 * carries the schema's default `scaleMax` of 5, so counting it would add five
 * points of headroom to a question whose best possible answer is one. `choice`
 * and `text` hold no number at all.
 *
 * A question nobody answered, and an answer marked `notObserved`, leave BOTH
 * sides of the fraction. Scoring either as zero would mean an honest "I
 * haven't seen enough to judge this" silently costs the subject marks, which
 * would make abstention a punishment and drive reviewers back to the
 * defensive mid-scale answer the flag exists to avoid. `skipped` is reported
 * so a caller can say "18 of 20 criteria scored" rather than quietly present a
 * partial total as if it were complete.
 *
 * A rating of 0 is a real answer worth no points, and is counted on both
 * sides. The falsy check that would drop it inflates the percentage by
 * shrinking the denominator — the same trap `isAnswered` documents.
 */
function scoreAppraisal(sections, feedback, { kind = 'manager' } = {}) {
  const row = (feedback || []).find((f) => f && f.kind === kind && f.status === 'submitted');
  const answers = new Map(
    (row?.answers || [])
      .filter((a) => a && a.questionId != null)
      .map((a) => [String(a.questionId), a])
  );

  let earned = 0;
  let possible = 0;
  let counted = 0;
  let skipped = 0;

  for (const section of sections || []) {
    for (const q of section?.questions || []) {
      if (!q || !COMPARABLE_QUESTION_TYPES.has(q.type)) continue;
      const max = typeof q.scaleMax === 'number' && Number.isFinite(q.scaleMax) ? q.scaleMax : 5;
      const a = answers.get(String(q._id));
      const rating = a && a.notObserved !== true && typeof a.rating === 'number' && Number.isFinite(a.rating)
        ? a.rating
        : null;
      if (rating === null) {
        skipped += 1;
        continue;
      }
      earned += rating;
      possible += max;
      counted += 1;
    }
  }

  return {
    earned,
    possible,
    // null, not 0: "nothing scored yet" and "scored zero" are different facts,
    // and a caller rendering 0% for an unstarted appraisal would be reporting
    // a verdict nobody reached.
    pct: possible > 0 ? Math.round((earned / possible) * 1000) / 10 : null,
    counted,
    skipped,
  };
}

function buildComparison(sections, feedback, access) {
  const submitted = (feedback || []).filter((f) => f && f.status === 'submitted');
  const named = access?.canSeeReviewerNames === true;
  const out = [];

  // A missing answer and a present-but-unrated answer are the same thing: a
  // question this reviewer skipped. Neither may enter a denominator, and
  // neither may be scored 0 — a zero is a bad review nobody gave. A genuine
  // rating of 0 is a real answer and is kept.
  //
  // `notObserved` is checked BEFORE the rating and wins outright. The
  // controller already strips the rating off such an answer, so this is the
  // second of two independent guards: rows written before that rule existed,
  // or by any future path that bypasses submitFeedback, still cannot have an
  // abstention counted as a score.
  const ratingIn = (r, qid) => {
    const a = (r?.answers || []).find((x) => x && String(x.questionId) === qid);
    if (a?.notObserved === true) return null;
    return typeof a?.rating === 'number' && Number.isFinite(a.rating) ? a.rating : null;
  };

  // The manager's per-question note (Phase 5 §9.3). Read off the SAME
  // already-projected rows as the ratings, so a viewer projectFeedbackForViewer
  // stripped comments from cannot get one back through the comparison table.
  // null rather than undefined when absent: the UI branches on it, and an
  // absent key and an explicit "no note" must not render differently.
  const commentIn = (r, qid) => {
    const a = (r?.answers || []).find((x) => x && String(x.questionId) === qid);
    const text = typeof a?.comment === 'string' ? a.comment.trim() : '';
    return text || null;
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

      const managerRow = submitted.find((f) => f.kind === 'manager');
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
        manager: ratingIn(managerRow, qid),
        // Carried on the manager side only — self and peer answers cannot hold
        // a comment at all (normaliseAnswers strips it), so there is no other
        // side for one to sit on.
        managerComment: commentIn(managerRow, qid),
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
  DEPARTMENT_SCOPED_HR_ROLES,
  canTransition,
  assertTransition,
  scopeDepartmentsFor,
  resolveAppraisalAccess,
  projectFeedbackForViewer,
  orderFeedbackForViewer,
  resolveAppraisalReviewer,
  planCycleLaunch,
  PEER_EVIDENCE_SECTION_TITLE,
  PEER_EVIDENCE_QUESTIONS,
  buildDefaultTemplate,
  filterSections,
  getAskedQuestionIds,
  partitionAnswersByAskedQuestions,
  isAnswered,
  normaliseAnswers,
  findUnansweredRequired,
  MAX_COMMITMENTS,
  COMMITMENT_MAXLENGTH,
  normaliseCommitments,
  PEER_RELEASE_MIN,
  COMPARABLE_QUESTION_TYPES,
  scoreAppraisal,
  effectiveNominationMin,
  validateNominations,
  applyNominationDecisions,
  planPeerRowCreation,
  countApprovedPeers,
  nominationViewForSubject,
  peerReleaseGate,
  NUDGE_REASONS,
  outstandingActionsFor,
  STANDING_VALUES,
  STANDING_NOTE_MAXLENGTH,
  normaliseStandingEntries,
  buildComparison,
};
