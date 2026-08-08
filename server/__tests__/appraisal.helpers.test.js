// server/__tests__/appraisal.helpers.test.js
const test = require('node:test');
const assert = require('node:assert');
const {
  canTransition,
  assertTransition,
  resolveAppraisalAccess,
  projectFeedbackForViewer,
  planCycleLaunch,
  buildDefaultTemplate,
  filterSections,
  getAskedQuestionIds,
  partitionAnswersByAskedQuestions,
} = require('../services/appraisal.helpers');

const TENANT = 'tenant-1';
// tenant_owner rather than tenant_admin: since Phase 5 an admin's HR powers
// are bounded by the departments they manage (resolveAppraisalAccess takes a
// departmentScope), and these tests are about what the `hr` RELATION can do,
// not about who qualifies for it. The department boundary itself is covered in
// appraisalDepartmentScoping.test.js.
const HR = { _id: 'u-hr', role: 'tenant_owner', tenant: TENANT };
const MANAGER = { _id: 'u-mgr', role: 'tenant_staff', tenant: TENANT };
const EMPLOYEE = { _id: 'u-emp', role: 'tenant_staff', tenant: TENANT };
const PEER = { _id: 'u-peer', role: 'tenant_staff', tenant: TENANT };
const OUTSIDER = { _id: 'u-out', role: 'tenant_staff', tenant: TENANT };

// Helper to generate unique object ID strings for tests.
let oidCounter = 0;
const oid = () => `oid-${++oidCounter}`;

const APPRAISAL = {
  _id: 'a-1',
  tenant: TENANT,
  employee: 'u-emp',
  manager: 'u-mgr',
  state: 'collecting',
  reviewerIds: ['u-emp', 'u-mgr', 'u-peer'],
};

// ── state machine ───────────────────────────────────────────────────────────

test('canTransition allows the Phase 1 happy path', () => {
  assert.ok(canTransition('draft', 'collecting'));
  assert.ok(canTransition('collecting', 'summarising'));
  assert.ok(canTransition('summarising', 'released'));
  assert.ok(canTransition('released', 'acknowledged'));
});

test('canTransition rejects skipping states and going backwards', () => {
  assert.ok(!canTransition('draft', 'released'));
  assert.ok(!canTransition('collecting', 'acknowledged'));
  assert.ok(!canTransition('released', 'collecting'));
  assert.ok(!canTransition('acknowledged', 'released'));
});

test('canTransition allows cancelling from any live state but not from terminal ones', () => {
  assert.ok(canTransition('draft', 'cancelled'));
  assert.ok(canTransition('collecting', 'cancelled'));
  assert.ok(canTransition('released', 'cancelled'));
  assert.ok(!canTransition('acknowledged', 'cancelled'));
  assert.ok(!canTransition('cancelled', 'draft'));
});

test('assertTransition throws a 400-tagged error on an illegal move', () => {
  assert.throws(
    () => assertTransition('draft', 'released'),
    (err) => err.status === 400 && /draft/.test(err.message)
  );
});

// ── access resolver ─────────────────────────────────────────────────────────

test('subject wins over hr so HR cannot unmask feedback about themselves', () => {
  const hrAboutSelf = { ...APPRAISAL, employee: 'u-hr' };
  const access = resolveAppraisalAccess(HR, hrAboutSelf);
  assert.strictEqual(access.relation, 'subject');
  assert.strictEqual(access.canSeeReviewerNames, false);
});

test('hr outranks manager on someone else\'s appraisal', () => {
  const hrIsManager = { ...APPRAISAL, manager: 'u-hr' };
  const access = resolveAppraisalAccess(HR, hrIsManager);
  assert.strictEqual(access.relation, 'hr');
  assert.strictEqual(access.canManageCycle, true);
});

test('hr can summarise only while collecting or summarising, never after sign-off', () => {
  for (const state of ['collecting', 'summarising']) {
    const access = resolveAppraisalAccess(HR, { ...APPRAISAL, state });
    assert.strictEqual(access.relation, 'hr');
    assert.strictEqual(access.canSummarise, true, `hr must be able to summarise in state ${state}`);
  }
  // Once released, acknowledged (the employee has signed off), or cancelled,
  // HR must not be able to silently rewrite the summary/finalRating —
  // otherwise saveSummary's transition guard is the only thing standing
  // between HR and editing a record the employee already relied on.
  for (const state of ['draft', 'nominating', 'pending_peer_approval', 'released', 'acknowledged', 'cancelled']) {
    const access = resolveAppraisalAccess(HR, { ...APPRAISAL, state });
    assert.strictEqual(access.canSummarise, false, `hr must not be able to summarise in state ${state}`);
  }
});

test('manager sees reviewer names and can summarise and release', () => {
  const appraisalInSummarising = { ...APPRAISAL, state: 'summarising' };
  const access = resolveAppraisalAccess(MANAGER, appraisalInSummarising);
  assert.strictEqual(access.relation, 'manager');
  assert.strictEqual(access.canSeeReviewerNames, true);
  assert.strictEqual(access.canSummarise, true);
  assert.strictEqual(access.canRelease, true);
  assert.strictEqual(access.canAcknowledge, false);
});

test('subject cannot see reviewer names and can only acknowledge', () => {
  const appraisalReleased = { ...APPRAISAL, state: 'released' };
  const access = resolveAppraisalAccess(EMPLOYEE, appraisalReleased);
  assert.strictEqual(access.relation, 'subject');
  assert.strictEqual(access.canSeeReviewerNames, false);
  assert.strictEqual(access.canSummarise, false);
  assert.strictEqual(access.canAcknowledge, true);
});

test('subject cannot read the appraisal until it is released', () => {
  for (const state of ['draft', 'collecting', 'summarising']) {
    const access = resolveAppraisalAccess(EMPLOYEE, { ...APPRAISAL, state });
    assert.strictEqual(access.canRead, false, `state ${state} must stay hidden`);
  }
  for (const state of ['released', 'acknowledged']) {
    const access = resolveAppraisalAccess(EMPLOYEE, { ...APPRAISAL, state });
    assert.strictEqual(access.canRead, true, `state ${state} must be visible`);
  }
});

test('an invited reviewer gets reviewer, not none', () => {
  const access = resolveAppraisalAccess(PEER, APPRAISAL);
  assert.strictEqual(access.relation, 'reviewer');
  assert.strictEqual(access.canSeeReviewerNames, false);
});

test('an unrelated user gets none and cannot read', () => {
  const access = resolveAppraisalAccess(OUTSIDER, APPRAISAL);
  assert.strictEqual(access.relation, 'none');
  assert.strictEqual(access.canRead, false);
});

test('a missing tenant on either side denies rather than matching', () => {
  const { tenant, ...noTenantAppraisal } = APPRAISAL;
  assert.strictEqual(
    resolveAppraisalAccess({ ...MANAGER, tenant: undefined }, noTenantAppraisal).relation,
    'none'
  );
  assert.strictEqual(
    resolveAppraisalAccess({ ...MANAGER, tenant: undefined }, APPRAISAL).relation,
    'none'
  );
  assert.strictEqual(
    resolveAppraisalAccess(MANAGER, noTenantAppraisal).relation,
    'none'
  );
});

test('a user from another tenant is none even if ids somehow match', () => {
  const access = resolveAppraisalAccess({ ...MANAGER, tenant: 'tenant-2' }, APPRAISAL);
  assert.strictEqual(access.relation, 'none');
  assert.strictEqual(access.canRead, false);
});

test('the subject nominates only while nominating', () => {
  const employee = oid(), manager = oid(), tenant = oid();
  const mk = (state) => ({ tenant, employee, manager, state, reviewerIds: [] });
  const user = { _id: employee, tenant, role: 'tenant_staff' };
  assert.strictEqual(resolveAppraisalAccess(user, mk('nominating')).canNominate, true);
  for (const s of ['draft', 'pending_peer_approval', 'collecting', 'released']) {
    assert.strictEqual(resolveAppraisalAccess(user, mk(s)).canNominate, false, s);
  }
});

test('nomination never widens what the subject can READ', () => {
  const employee = oid(), tenant = oid();
  const a = { tenant, employee, manager: oid(), state: 'nominating', reviewerIds: [] };
  const access = resolveAppraisalAccess({ _id: employee, tenant, role: 'tenant_staff' }, a);
  assert.strictEqual(access.canRead, false, 'pre-release privacy is not relaxed by one state');
  assert.strictEqual(access.canSeeReviewerNames, false);
});

test('the manager approves peers only at pending_peer_approval, backfills only at collecting', () => {
  const manager = oid(), tenant = oid();
  const mk = (state) => ({ tenant, employee: oid(), manager, state, reviewerIds: [] });
  const user = { _id: manager, tenant, role: 'tenant_staff' };
  assert.strictEqual(resolveAppraisalAccess(user, mk('pending_peer_approval')).canApprovePeers, true);
  assert.strictEqual(resolveAppraisalAccess(user, mk('collecting')).canApprovePeers, false);
  assert.strictEqual(resolveAppraisalAccess(user, mk('collecting')).canBackfillPeers, true);
  assert.strictEqual(resolveAppraisalAccess(user, mk('pending_peer_approval')).canBackfillPeers, false);
  assert.strictEqual(resolveAppraisalAccess(user, mk('nominating')).canNominate, false);
});

test('HR holds all three so acting on behalf is a capability, not a bypass', () => {
  const tenant = oid();
  const mk = (state) => ({ tenant, employee: oid(), manager: oid(), state, reviewerIds: [] });
  const hr = { _id: oid(), tenant, role: 'tenant_owner' };
  assert.strictEqual(resolveAppraisalAccess(hr, mk('nominating')).canNominate, true);
  assert.strictEqual(resolveAppraisalAccess(hr, mk('pending_peer_approval')).canApprovePeers, true);
  assert.strictEqual(resolveAppraisalAccess(hr, mk('collecting')).canBackfillPeers, true);
});

test('an approved peer gets none of the three', () => {
  const peer = oid(), tenant = oid();
  const a = { tenant, employee: oid(), manager: oid(), state: 'collecting', reviewerIds: [peer] };
  const access = resolveAppraisalAccess({ _id: peer, tenant, role: 'tenant_staff' }, a);
  assert.strictEqual(access.relation, 'reviewer');
  assert.strictEqual(access.canNominate, false);
  assert.strictEqual(access.canApprovePeers, false);
  assert.strictEqual(access.canBackfillPeers, false);
});

test('NO_ACCESS denies the new capabilities too', () => {
  const access = resolveAppraisalAccess(null, null);
  assert.strictEqual(access.canNominate, false);
  assert.strictEqual(access.canApprovePeers, false);
  assert.strictEqual(access.canBackfillPeers, false);
});

// ── anonymity projection ────────────────────────────────────────────────────

test('peer feedback drops the reviewer for viewers who cannot see names', () => {
  const fb = { _id: 'f1', kind: 'peer', reviewer: 'u-peer', answers: [] };
  const out = projectFeedbackForViewer(fb, { canSeeReviewerNames: false });
  assert.strictEqual(out.reviewer, undefined);
  assert.ok(!('reviewer' in out));
  assert.strictEqual(out.kind, 'peer');
});

test('peer feedback keeps the reviewer for HR and managers', () => {
  const fb = { _id: 'f1', kind: 'peer', reviewer: 'u-peer', answers: [] };
  const out = projectFeedbackForViewer(fb, { canSeeReviewerNames: true });
  assert.strictEqual(out.reviewer, 'u-peer');
});

test('self and manager feedback always keep the reviewer — they are not anonymous', () => {
  for (const kind of ['self', 'manager']) {
    const fb = { _id: 'f1', kind, reviewer: 'u-x', answers: [] };
    const out = projectFeedbackForViewer(fb, { canSeeReviewerNames: false });
    assert.strictEqual(out.reviewer, 'u-x', `${kind} must stay attributed`);
  }
});

// ── cycle launch planning ───────────────────────────────────────────────────

test('planCycleLaunch pairs each employee with their manager', () => {
  const plan = planCycleLaunch(
    [{ _id: 'e1', employeeProfile: { work: { manager: 'm1' } } }],
    []
  );
  // `department` rides along since Phase 5 and is null when the employee has
  // none — it is snapshotted onto the Appraisal, so it is part of the plan.
  assert.deepStrictEqual(plan.toCreate, [{ employee: 'e1', manager: 'm1', department: null }]);
  assert.strictEqual(plan.skipped.length, 0);
});

test('planCycleLaunch skips employees with no manager instead of orphaning them', () => {
  const plan = planCycleLaunch(
    [
      { _id: 'e1', employeeProfile: { work: { manager: 'm1' } } },
      { _id: 'e2', employeeProfile: { work: {} } },
      { _id: 'e3' },
    ],
    []
  );
  assert.strictEqual(plan.toCreate.length, 1);
  assert.deepStrictEqual(
    plan.skipped.map((s) => s.employee).sort(),
    ['e2', 'e3']
  );
  assert.ok(plan.skipped.every((s) => s.reason === 'no_manager'));
});

test('planCycleLaunch is idempotent — an existing appraisal is not recreated', () => {
  const employees = [{ _id: 'e1', employeeProfile: { work: { manager: 'm1' } } }];
  const plan = planCycleLaunch(employees, ['e1']);
  assert.strictEqual(plan.toCreate.length, 0);
  assert.deepStrictEqual(plan.alreadyExists, ['e1']);
});

test('planCycleLaunch refuses to make an employee their own manager', () => {
  const plan = planCycleLaunch(
    [{ _id: 'e1', employeeProfile: { work: { manager: 'e1' } } }],
    []
  );
  assert.strictEqual(plan.toCreate.length, 0);
  assert.strictEqual(plan.skipped[0].reason, 'self_manager');
});

// ── default template ────────────────────────────────────────────────────────

test('buildDefaultTemplate asks every SCORED question of both self and manager', () => {
  const tpl = buildDefaultTemplate(TENANT, 'u-hr');
  assert.strictEqual(tpl.tenant, TENANT);
  const questions = tpl.sections.flatMap((s) => s.questions);
  assert.ok(questions.length > 0);

  // Narrowed from "every question" deliberately. Peers are no longer asked the
  // self/manager questions at all — they get their own evidence-shaped prompts
  // — so the blanket rule is gone. What must still hold is the one the
  // comparison depends on: a scored question is answered by BOTH self and
  // manager, or buildComparison joins them into a half-empty row.
  // The peer side of the contract is pinned in appraisalTemplateDefault.test.js.
  for (const q of questions.filter((x) => x.type === 'rating')) {
    assert.ok(q.askOf.includes('self'), `${q.label} must be asked of self`);
    assert.ok(q.askOf.includes('manager'), `${q.label} must be asked of manager`);
  }
  assert.ok(questions.some((q) => q.type === 'rating'));
  assert.ok(questions.some((q) => q.type === 'text'));
  assert.ok(
    questions.some((q) => q.askOf.includes('peer')),
    'peers must still be asked something'
  );
});

// ── asked-question filtering + answer validation ────────────────────────────

const SECTIONS = [
  {
    title: 'Performance',
    questions: [
      { _id: 'q-self-mgr', label: 'Quality', askOf: ['self', 'manager'] },
      { _id: 'q-mgr-only', label: 'Leadership potential', askOf: ['manager'] },
      { _id: 'q-peer-only', label: 'Teamwork', askOf: ['peer'] },
    ],
  },
  {
    title: 'Comments',
    questions: [
      { _id: 'q-all', label: 'Anything else?', askOf: ['self', 'manager', 'peer'] },
    ],
  },
];

test('filterSections keeps only questions asked of that kind, dropping empty sections', () => {
  const forSelf = filterSections(SECTIONS, { kind: 'self' });
  const selfIds = forSelf.flatMap((s) => s.questions.map((q) => q._id));
  assert.deepStrictEqual(selfIds.sort(), ['q-all', 'q-self-mgr']);

  const forPeer = filterSections(SECTIONS, { kind: 'peer' });
  const peerIds = forPeer.flatMap((s) => s.questions.map((q) => q._id));
  assert.deepStrictEqual(peerIds.sort(), ['q-all', 'q-peer-only']);
});

test('filterSections returns an empty array for a kind asked nothing', () => {
  const noQuestions = [{ title: 'Solo', questions: [{ _id: 'q1', askOf: ['manager'] }] }];
  assert.deepStrictEqual(filterSections(noQuestions, { kind: 'peer' }), []);
});

test('getAskedQuestionIds collects ids from a filtered sections array as strings', () => {
  const forManager = filterSections(SECTIONS, { kind: 'manager' });
  const ids = getAskedQuestionIds(forManager);
  assert.ok(ids instanceof Set);
  assert.deepStrictEqual([...ids].sort(), ['q-all', 'q-mgr-only', 'q-self-mgr']);
});

test('partitionAnswersByAskedQuestions allows answers keyed to asked questions', () => {
  const askedIds = getAskedQuestionIds(filterSections(SECTIONS, { kind: 'self' }));
  const answers = [
    { questionId: 'q-self-mgr', rating: 5 },
    { questionId: 'q-all', text: 'great' },
  ];
  const { allowed, rejectedIds } = partitionAnswersByAskedQuestions(answers, askedIds);
  assert.strictEqual(allowed.length, 2);
  assert.deepStrictEqual(rejectedIds, []);
});

test('partitionAnswersByAskedQuestions rejects a manager-only question answered by a self reviewer', () => {
  const askedIds = getAskedQuestionIds(filterSections(SECTIONS, { kind: 'self' }));
  const answers = [{ questionId: 'q-mgr-only', rating: 5 }];
  const { allowed, rejectedIds } = partitionAnswersByAskedQuestions(answers, askedIds);
  assert.strictEqual(allowed.length, 0);
  assert.deepStrictEqual(rejectedIds, ['q-mgr-only']);
});

test('partitionAnswersByAskedQuestions rejects a fabricated question id matching nothing', () => {
  const askedIds = getAskedQuestionIds(filterSections(SECTIONS, { kind: 'self' }));
  const answers = [{ questionId: 'not-a-real-question', rating: 1 }];
  const { allowed, rejectedIds } = partitionAnswersByAskedQuestions(answers, askedIds);
  assert.strictEqual(allowed.length, 0);
  assert.deepStrictEqual(rejectedIds, ['not-a-real-question']);
});

test('partitionAnswersByAskedQuestions rejects an answer missing questionId instead of throwing', () => {
  const askedIds = getAskedQuestionIds(filterSections(SECTIONS, { kind: 'self' }));
  const { allowed, rejectedIds } = partitionAnswersByAskedQuestions([{ rating: 3 }], askedIds);
  assert.strictEqual(allowed.length, 0);
  assert.deepStrictEqual(rejectedIds, ['(missing questionId)']);
});

test('partitionAnswersByAskedQuestions dedupes repeated rejected ids', () => {
  const askedIds = getAskedQuestionIds(filterSections(SECTIONS, { kind: 'self' }));
  const answers = [
    { questionId: 'q-mgr-only', rating: 1 },
    { questionId: 'q-mgr-only', rating: 2 },
  ];
  const { rejectedIds } = partitionAnswersByAskedQuestions(answers, askedIds);
  assert.deepStrictEqual(rejectedIds, ['q-mgr-only']);
});

// ── appraisal.controller pure projection logic ──────────────────────────────
// These two functions are exported read-only from the controller (via
// `_internal`) purely so this security-critical, DB-free logic can be
// exercised without a database. No route dispatch is involved.

const { _internal } = require('../controllers/appraisal.controller');
const { sanitizeOwnAppraisalRow, projectAppraisalForViewer } = _internal;

const OWN_ROW_BASE = {
  _id: 'a-1',
  tenant: TENANT,
  employee: 'u-emp',
  manager: 'u-mgr',
  summary: 'Did great work',
  finalRating: 8,
  employeeResponse: 'Thanks!',
  reviewerIds: ['u-emp', 'u-mgr'],
  peerNominations: [{ user: 'u-peer', proposedBy: 'u-mgr', status: 'approved' }],
};

test('sanitizeOwnAppraisalRow strips verdict + reviewer-identity fields before release', () => {
  for (const state of ['draft', 'collecting', 'summarising', 'cancelled']) {
    const out = sanitizeOwnAppraisalRow({ ...OWN_ROW_BASE, state });
    assert.ok(!('summary' in out), `summary must be hidden in state ${state}`);
    assert.ok(!('finalRating' in out), `finalRating must be hidden in state ${state}`);
    assert.ok(!('employeeResponse' in out), `employeeResponse must be hidden in state ${state}`);
    assert.ok(!('reviewerIds' in out), `reviewerIds must be hidden in state ${state}`);
    assert.ok(!('peerNominations' in out), `peerNominations must be hidden in state ${state}`);
    // Non-sensitive fields survive untouched.
    assert.strictEqual(out.employee, 'u-emp');
  }
});

test('sanitizeOwnAppraisalRow reveals the verdict once released, but never reviewer identity', () => {
  for (const state of ['released', 'acknowledged']) {
    const out = sanitizeOwnAppraisalRow({ ...OWN_ROW_BASE, state });
    assert.strictEqual(out.summary, 'Did great work');
    assert.strictEqual(out.finalRating, 8);
    assert.strictEqual(out.employeeResponse, 'Thanks!');
    // The subject relation never gets canSeeReviewerNames, in any state.
    assert.ok(!('reviewerIds' in out), `reviewerIds must stay hidden in state ${state}`);
    assert.ok(!('peerNominations' in out), `peerNominations must stay hidden in state ${state}`);
  }
});

test('projectAppraisalForViewer strips reviewer-identity fields when the viewer cannot see names', () => {
  const out = projectAppraisalForViewer(OWN_ROW_BASE, { canSeeReviewerNames: false });
  assert.ok(!('reviewerIds' in out));
  assert.ok(!('peerNominations' in out));
  // Everything else, including the released verdict, is untouched here —
  // this function's only job is reviewer identity, not release-gating.
  assert.strictEqual(out.summary, OWN_ROW_BASE.summary);
});

test('projectAppraisalForViewer passes the appraisal through unchanged for HR/managers', () => {
  const out = projectAppraisalForViewer(OWN_ROW_BASE, { canSeeReviewerNames: true });
  assert.deepStrictEqual(out, OWN_ROW_BASE);
});

// A real hydrated Mongoose document stores its actual data on the instance's
// `_doc`/`$__` own properties; the schema paths themselves (summary,
// reviewerIds, ...) are exposed via getters on the *prototype*, not as own
// enumerable properties. `{ ...doc }` only ever copies own enumerable
// properties, so a naive spread captures `$__`/`_doc` and none of the real
// fields — proving `omit()`/`projectAppraisalForViewer` must call
// `.toObject()` (as projectFeedbackForViewer already does) rather than
// spread the document directly.
function makeFakeHydratedAppraisal(fields) {
  const proto = {
    toObject() {
      return { ...this._doc };
    },
  };
  for (const key of Object.keys(fields)) {
    Object.defineProperty(proto, key, { enumerable: true, get() { return this._doc[key]; } });
  }
  const doc = Object.create(proto);
  doc.$__ = { activePaths: {} };
  doc._doc = { ...fields };
  return doc;
}

test('projectAppraisalForViewer strips reviewer identity from a hydrated Mongoose document, not just plain/lean objects', () => {
  const hydrated = makeFakeHydratedAppraisal(OWN_ROW_BASE);
  // Confirms the fake actually mimics the real bug surface: no schema path
  // is an *own* enumerable property, only the Mongoose internals are.
  assert.deepStrictEqual(Object.keys(hydrated), ['$__', '_doc']);

  const out = projectAppraisalForViewer(hydrated, { canSeeReviewerNames: false });

  // Proves .toObject() was actually used: schema fields must land at the
  // top level of the result. A plain `{ ...hydrated }` spread would leave
  // `out.summary` undefined, since `summary` is a prototype getter.
  assert.strictEqual(out.summary, OWN_ROW_BASE.summary);
  assert.strictEqual(out.employee, OWN_ROW_BASE.employee);

  // The actual security property: reviewer identity is gone.
  assert.ok(!('reviewerIds' in out));
  assert.ok(!('peerNominations' in out));

  // No Mongoose internals leak into the JSON response either.
  assert.ok(!('$__' in out));
  assert.ok(!('_doc' in out));
});

// ── Phase 2: peer nomination helpers ────────────────────────────────────────

const {
  PEER_RELEASE_MIN, effectiveNominationMin, validateNominations,
  applyNominationDecisions, planPeerRowCreation, nominationViewForSubject,
  peerReleaseGate,
} = require('../services/appraisal.helpers');

test('a small tenant cannot be made unable to nominate', () => {
  assert.strictEqual(effectiveNominationMin(3, 10), 3);
  assert.strictEqual(effectiveNominationMin(3, 1), 1, 'min never exceeds who exists');
  assert.strictEqual(effectiveNominationMin(3, 0), 0);
});

test('validateNominations rejects self, the manager, duplicates and outsiders', () => {
  const subjectId = oid(), managerId = oid(), a = oid(), b = oid(), outsider = oid();
  const base = { subjectId, managerId, eligibleIds: [a, b], min: 1, max: 3 };

  assert.strictEqual(validateNominations([a, b], base).valid, true);
  assert.strictEqual(validateNominations([subjectId], base).valid, false);
  assert.strictEqual(validateNominations([managerId], base).valid, false);
  assert.strictEqual(validateNominations([a, a], base).valid, false);
  assert.strictEqual(validateNominations([outsider], base).valid, false);
  assert.strictEqual(validateNominations([], base).valid, false, 'below min');
  assert.strictEqual(
    validateNominations([a, b, oid(), oid()], { ...base, eligibleIds: [a, b] }).valid,
    false, 'above max'
  );
  // Errors are human-readable, not codes — they surface straight to the user.
  const res = validateNominations([subjectId], base);
  assert.ok(res.errors.length > 0 && typeof res.errors[0] === 'string');
});

test('applyNominationDecisions stamps who decided, and adds arrive pre-approved', () => {
  const decider = oid(), keep = oid(), drop = oid(), extra = oid();
  const before = [
    { user: keep, proposedBy: oid(), status: 'proposed' },
    { user: drop, proposedBy: oid(), status: 'proposed' },
  ];
  const after = applyNominationDecisions(
    before, { approve: [keep], reject: [drop], add: [extra] }, decider
  );
  const byUser = (u) => after.find((n) => String(n.user) === String(u));
  assert.strictEqual(byUser(keep).status, 'approved');
  assert.strictEqual(byUser(drop).status, 'rejected');
  assert.strictEqual(String(byUser(keep).decidedBy), String(decider));
  assert.ok(byUser(keep).decidedAt instanceof Date);
  assert.strictEqual(byUser(extra).status, 'approved', 'a manager-added name needs no second approval');
  assert.strictEqual(String(byUser(extra).proposedBy), String(decider));
  assert.strictEqual(after.length, 3);
});

test('only approved nominations become feedback rows, and never twice', () => {
  const approved = oid(), rejected = oid(), already = oid();
  const noms = [
    { user: approved, status: 'approved' },
    { user: rejected, status: 'rejected' },
    { user: already, status: 'approved' },
  ];
  const plan = planPeerRowCreation(noms, [oid(), already]);
  assert.deepStrictEqual(plan.map(String), [String(approved)]);
});

test('the subject sees their own proposals while nominating, a bare count after', () => {
  const mine = oid();
  const cycle = { peerCountMin: 3, peerCountMax: 5, nominationDeadline: new Date('2026-09-01') };
  const nominating = nominationViewForSubject(
    { state: 'nominating', peerNominations: [{ user: mine, status: 'proposed' }] },
    cycle, 10
  );
  assert.strictEqual(nominating.min, 3);
  assert.strictEqual(nominating.max, 5);
  assert.strictEqual(nominating.myProposals.length, 1);
  assert.strictEqual(nominating.approvedCount, undefined);

  // Past nominating: a count and nothing else, so rejections stay invisible.
  const after = nominationViewForSubject(
    {
      state: 'collecting',
      peerNominations: [
        { user: oid(), status: 'approved' },
        { user: oid(), status: 'rejected' },
      ],
    },
    cycle, 10
  );
  assert.deepStrictEqual(Object.keys(after).sort(), ['approvedCount', 'state']);
  assert.strictEqual(after.approvedCount, 1);
});

test('the release gate warns on thin peer input but not on a deliberate no-peer run', () => {
  assert.strictEqual(PEER_RELEASE_MIN, 2);
  assert.strictEqual(peerReleaseGate({ approvedPeerCount: 0, submittedPeerCount: 0 }).blocked, false,
    'HR ran this cycle without peers on purpose — do not train managers to click through');
  assert.strictEqual(peerReleaseGate({ approvedPeerCount: 3, submittedPeerCount: 2 }).blocked, false);
  const thin = peerReleaseGate({ approvedPeerCount: 3, submittedPeerCount: 1 });
  assert.strictEqual(thin.blocked, true);
  assert.strictEqual(thin.code, 'LOW_PEER_RESPONSE_COUNT');
  assert.strictEqual(thin.threshold, 2);
  assert.strictEqual(
    peerReleaseGate({ approvedPeerCount: 3, submittedPeerCount: 1, confirmed: true }).blocked,
    false
  );
});

// ── Phase 3: who is holding this appraisal up ───────────────────────────────

const {
  outstandingActionsFor, NUDGE_REASONS, APPRAISAL_STATES,
} = require('../services/appraisal.helpers');

const appraisalAt = (state) => ({
  _id: 'a-1', employee: 'u-emp', manager: 'u-mgr', state,
});

test('outstandingActionsFor: nominating waits on the employee, not on any reviewer', () => {
  assert.deepStrictEqual(outstandingActionsFor(appraisalAt('nominating'), []), [
    { target: 'u-emp', reason: 'nominate' },
  ]);
});

test('outstandingActionsFor: pending_peer_approval waits on the manager', () => {
  assert.deepStrictEqual(outstandingActionsFor(appraisalAt('pending_peer_approval'), []), [
    { target: 'u-mgr', reason: 'approve_peers' },
  ]);
});

test('outstandingActionsFor: collecting lists every PENDING reviewer, whatever their kind', () => {
  const rows = [
    { reviewer: 'u-emp', kind: 'self', status: 'pending' },
    { reviewer: 'u-mgr', kind: 'manager', status: 'submitted' },
    { reviewer: 'u-p1', kind: 'peer', status: 'pending' },
    { reviewer: 'u-p2', kind: 'peer', status: 'declined' },
    { reviewer: 'u-p3', kind: 'peer', status: 'expired' },
  ];
  assert.deepStrictEqual(outstandingActionsFor(appraisalAt('collecting'), rows), [
    { target: 'u-emp', reason: 'feedback' },
    { target: 'u-p1', reason: 'feedback' },
  ]);
});

test('outstandingActionsFor: a pending manager row is chased for feedback, not to summarise', () => {
  const rows = [
    { reviewer: 'u-emp', kind: 'self', status: 'submitted' },
    { reviewer: 'u-mgr', kind: 'manager', status: 'pending' },
  ];
  assert.deepStrictEqual(outstandingActionsFor(appraisalAt('collecting'), rows), [
    { target: 'u-mgr', reason: 'feedback' },
  ]);
});

test('outstandingActionsFor: a declined or expired row is NOT outstanding', () => {
  // Nudging someone who explicitly declined is harassment, and nudging an
  // expired row asks for something the cycle no longer accepts.
  const rows = [
    { reviewer: 'u-p1', kind: 'peer', status: 'declined' },
    { reviewer: 'u-p2', kind: 'peer', status: 'expired' },
  ];
  const out = outstandingActionsFor(appraisalAt('collecting'), rows);
  assert.deepStrictEqual(out, [{ target: 'u-mgr', reason: 'summarise' }]);
  assert.ok(!out.some((a) => a.target === 'u-p1' || a.target === 'u-p2'),
    'a peer who declined or timed out must never be chased');
});

test('outstandingActionsFor: collecting with nothing pending waits on the manager', () => {
  const rows = [
    { reviewer: 'u-emp', kind: 'self', status: 'submitted' },
    { reviewer: 'u-mgr', kind: 'manager', status: 'submitted' },
  ];
  assert.deepStrictEqual(outstandingActionsFor(appraisalAt('collecting'), rows), [
    { target: 'u-mgr', reason: 'summarise' },
  ]);
});

test('outstandingActionsFor: a peer-disabled cycle launches into collecting and never asks anyone to nominate', () => {
  // cycle.peerReviewEnabled === false makes launchCycle skip 'nominating'
  // entirely, so the only outstanding work is the self/manager feedback.
  const rows = [
    { reviewer: 'u-emp', kind: 'self', status: 'pending' },
    { reviewer: 'u-mgr', kind: 'manager', status: 'pending' },
  ];
  const out = outstandingActionsFor(appraisalAt('collecting'), rows);
  assert.deepStrictEqual(out, [
    { target: 'u-emp', reason: 'feedback' },
    { target: 'u-mgr', reason: 'feedback' },
  ]);
  assert.ok(!out.some((a) => a.reason === 'nominate'));
});

test('outstandingActionsFor: summarising waits on the manager', () => {
  assert.deepStrictEqual(outstandingActionsFor(appraisalAt('summarising'), []), [
    { target: 'u-mgr', reason: 'summarise' },
  ]);
});

test('outstandingActionsFor: released waits on the employee to acknowledge', () => {
  assert.deepStrictEqual(outstandingActionsFor(appraisalAt('released'), []), [
    { target: 'u-emp', reason: 'acknowledge' },
  ]);
});

test('outstandingActionsFor: draft and the terminal states wait on nobody', () => {
  assert.deepStrictEqual(outstandingActionsFor(appraisalAt('draft'), []), []);
  assert.deepStrictEqual(outstandingActionsFor(appraisalAt('acknowledged'), []), []);
  assert.deepStrictEqual(outstandingActionsFor(appraisalAt('cancelled'), []), []);
  // Feedback rows left behind by closeCycle must not resurrect a dead appraisal.
  assert.deepStrictEqual(
    outstandingActionsFor(appraisalAt('cancelled'), [{ reviewer: 'u-p1', kind: 'peer', status: 'pending' }]),
    []
  );
});

test('outstandingActionsFor: tolerates null/absent input', () => {
  assert.deepStrictEqual(outstandingActionsFor(null, null), []);
  assert.deepStrictEqual(outstandingActionsFor(undefined, undefined), []);
  assert.deepStrictEqual(outstandingActionsFor(appraisalAt('collecting'), null), [
    { target: 'u-mgr', reason: 'summarise' },
  ]);
  assert.deepStrictEqual(outstandingActionsFor({ _id: 'a-1', employee: 'u-emp', manager: 'u-mgr' }, []), []);
});

test('outstandingActionsFor resolves populated ref objects to ids', () => {
  const a = { _id: 'a-1', employee: { _id: 'u-emp' }, manager: { _id: 'u-mgr' }, state: 'nominating' };
  assert.deepStrictEqual(outstandingActionsFor(a, []), [{ target: 'u-emp', reason: 'nominate' }]);
  const c = { _id: 'a-1', employee: { _id: 'u-emp' }, manager: { _id: 'u-mgr' }, state: 'collecting' };
  assert.deepStrictEqual(
    outstandingActionsFor(c, [{ reviewer: { _id: 'u-p1' }, kind: 'peer', status: 'pending' }]),
    [{ target: 'u-p1', reason: 'feedback' }]
  );
});

test('outstandingActionsFor ignores a feedback row belonging to a different appraisal', () => {
  // The roster loads a whole cycle's rows at once; a grouping slip must not
  // send HR to chase someone who has already done their part on THIS record.
  const rows = [
    { appraisal: 'a-1', reviewer: 'u-p1', kind: 'peer', status: 'pending' },
    { appraisal: 'a-2', reviewer: 'u-other', kind: 'peer', status: 'pending' },
  ];
  assert.deepStrictEqual(outstandingActionsFor(appraisalAt('collecting'), rows), [
    { target: 'u-p1', reason: 'feedback' },
  ]);
});

test('outstandingActionsFor: a pending row with no reviewer id is dropped, not emitted as an empty target', () => {
  const rows = [
    { reviewer: null, kind: 'peer', status: 'pending' },
    { kind: 'peer', status: 'pending' },
  ];
  assert.deepStrictEqual(outstandingActionsFor(appraisalAt('collecting'), rows), [
    { target: 'u-mgr', reason: 'summarise' },
  ]);
});

test('NUDGE_REASONS covers exactly the reasons outstandingActionsFor can emit', () => {
  assert.deepStrictEqual([...NUDGE_REASONS].sort(), [
    'acknowledge', 'approve_peers', 'feedback', 'nominate', 'summarise',
  ]);
});

test('outstandingActionsFor handles EVERY state in the model enum and emits only known reasons', () => {
  const rows = [{ reviewer: 'u-p1', kind: 'peer', status: 'pending' }];
  for (const state of APPRAISAL_STATES) {
    for (const feedback of [[], rows]) {
      const out = outstandingActionsFor(appraisalAt(state), feedback);
      assert.ok(Array.isArray(out), `${state} must return an array`);
      for (const action of out) {
        assert.deepStrictEqual(Object.keys(action).sort(), ['reason', 'target'],
          `${state} emitted an unexpected shape`);
        assert.ok(NUDGE_REASONS.includes(action.reason),
          `${state} emitted reason "${action.reason}" which AppraisalNudge's enum would reject`);
        assert.ok(action.target, `${state} emitted an empty target`);
      }
    }
  }
});
