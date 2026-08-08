// server/__tests__/appraisalDepartmentScoping.test.js
//
// Phase 5 §9.1/§9.2/§9.3/§9.4 — the pure rules behind department-scoped
// appraisals. Every one of these is a security or correctness boundary that
// the controllers lean on, so they are tested here directly rather than only
// through a handler:
//
//   filterSections            which questions a reviewer is even shown
//   resolveAppraisalReviewer  who reviews whom, and who gets no appraisal
//   planCycleLaunch           the snapshot taken at launch
//   scopeDepartmentsFor       which departments an admin may look into
//   resolveAppraisalAccess    whether that admin gets HR powers on a record
//   normaliseAnswers          who may write a reviewer comment
//   projectFeedbackForViewer  who may read one
//   buildComparison           where it lands in the payload
const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');

const {
  filterSections,
  getAskedQuestionIds,
  resolveAppraisalReviewer,
  planCycleLaunch,
  scopeDepartmentsFor,
  resolveAppraisalAccess,
  normaliseAnswers,
  projectFeedbackForViewer,
  buildComparison,
} = require('../services/appraisal.helpers');

const oid = () => new mongoose.Types.ObjectId();

// ───────────────────────────────────────────────────────────────────────────
// §9.1 filterSections
// ───────────────────────────────────────────────────────────────────────────
const SALES = oid();
const OPS = oid();

const DEPT_SECTIONS = [
  {
    title: 'Everyone',
    // No `departments` key at all — the shape a pre-Phase-5 template has.
    questions: [{ _id: oid(), label: 'Q1', askOf: ['self', 'manager'] }],
  },
  {
    title: 'Company-wide (explicit empty)',
    departments: [],
    questions: [{ _id: oid(), label: 'Q2', askOf: ['self', 'manager'] }],
  },
  {
    title: 'Sales only',
    departments: [SALES],
    questions: [{ _id: oid(), label: 'Q3', askOf: ['self', 'manager'] }],
  },
  {
    title: 'Ops only, peer questions',
    departments: [OPS],
    questions: [{ _id: oid(), label: 'Q4', askOf: ['peer'] }],
  },
];

const titles = (sections) => sections.map((s) => s.title);

test('filterSections keeps company-wide sections for an employee with no department', () => {
  const out = filterSections(DEPT_SECTIONS, { kind: 'self', departmentId: null });
  assert.deepStrictEqual(titles(out), ['Everyone', 'Company-wide (explicit empty)']);
});

test('filterSections adds the matching department section and no other', () => {
  const out = filterSections(DEPT_SECTIONS, { kind: 'self', departmentId: SALES });
  assert.deepStrictEqual(titles(out), [
    'Everyone',
    'Company-wide (explicit empty)',
    'Sales only',
  ]);
});

test('filterSections accepts a department id as a string, a document or an ObjectId', () => {
  const expected = ['Everyone', 'Company-wide (explicit empty)', 'Sales only'];
  assert.deepStrictEqual(titles(filterSections(DEPT_SECTIONS, { kind: 'self', departmentId: String(SALES) })), expected);
  assert.deepStrictEqual(titles(filterSections(DEPT_SECTIONS, { kind: 'self', departmentId: { _id: SALES } })), expected);
});

test('filterSections still drops a matching section with nothing for this kind', () => {
  // Ops matches on department, but its only question is peer-only, so a self
  // reviewer must not be handed an empty section.
  const out = filterSections(DEPT_SECTIONS, { kind: 'self', departmentId: OPS });
  assert.deepStrictEqual(titles(out), ['Everyone', 'Company-wide (explicit empty)']);
  const peer = filterSections(DEPT_SECTIONS, { kind: 'peer', departmentId: OPS });
  assert.deepStrictEqual(titles(peer), ['Ops only, peer questions']);
});

test('filterSections tolerates a missing options object', () => {
  assert.deepStrictEqual(filterSections(null, { kind: 'self' }), []);
  assert.deepStrictEqual(filterSections(DEPT_SECTIONS, {}), []);
});

test('getAskedQuestionIds follows filterSections, so a foreign department question is never answerable', () => {
  const salesQuestionId = String(DEPT_SECTIONS[2].questions[0]._id);
  const asked = getAskedQuestionIds(filterSections(DEPT_SECTIONS, { kind: 'self', departmentId: OPS }));
  assert.strictEqual(asked.has(salesQuestionId), false);
  const askedSales = getAskedQuestionIds(filterSections(DEPT_SECTIONS, { kind: 'self', departmentId: SALES }));
  assert.strictEqual(askedSales.has(salesQuestionId), true);
});

// ───────────────────────────────────────────────────────────────────────────
// §9.2 resolveAppraisalReviewer
// ───────────────────────────────────────────────────────────────────────────
const OWNER = oid();
const SALES_MANAGER = oid();

const emp = (over = {}) => ({
  _id: over._id || oid(),
  role: over.role || 'tenant_staff',
  employeeProfile: { work: { department: over.department, manager: over.manager } },
});

const deptManagers = new Map([[String(SALES), String(SALES_MANAGER)]]);

test('resolveAppraisalReviewer gives the tenant owner no appraisal, with a reason', () => {
  const owner = emp({ _id: OWNER, role: 'tenant_owner', department: SALES });
  const out = resolveAppraisalReviewer(owner, { departmentManagerOf: deptManagers, ownerId: OWNER });
  assert.strictEqual(out.reviewer, null);
  assert.strictEqual(out.reason, 'is_owner');
});

test('resolveAppraisalReviewer routes a tenant_admin to the owner, not their department manager', () => {
  const admin = emp({ role: 'tenant_admin', department: SALES, manager: oid() });
  const out = resolveAppraisalReviewer(admin, { departmentManagerOf: deptManagers, ownerId: OWNER });
  assert.strictEqual(out.reviewer, String(OWNER));
});

test('resolveAppraisalReviewer routes staff to their department manager', () => {
  const staff = emp({ department: SALES, manager: oid() });
  const out = resolveAppraisalReviewer(staff, { departmentManagerOf: deptManagers, ownerId: OWNER });
  assert.strictEqual(out.reviewer, String(SALES_MANAGER));
  assert.strictEqual(out.department, String(SALES));
});

test('resolveAppraisalReviewer sends a department manager inside their own department to the owner', () => {
  const self = emp({ _id: SALES_MANAGER, role: 'tenant_staff', department: SALES });
  const out = resolveAppraisalReviewer(self, { departmentManagerOf: deptManagers, ownerId: OWNER });
  assert.strictEqual(out.reviewer, String(OWNER));
});

test('resolveAppraisalReviewer falls back to work.manager when the department has no manager', () => {
  const workManager = oid();
  const staff = emp({ department: OPS, manager: workManager });
  const out = resolveAppraisalReviewer(staff, { departmentManagerOf: deptManagers, ownerId: OWNER });
  assert.strictEqual(out.reviewer, String(workManager));
  assert.strictEqual(out.department, String(OPS));
});

test('resolveAppraisalReviewer falls back past a self-referential work.manager to the owner', () => {
  const id = oid();
  const staff = emp({ _id: id, manager: id });
  const out = resolveAppraisalReviewer(staff, { departmentManagerOf: deptManagers, ownerId: OWNER });
  assert.strictEqual(out.reviewer, String(OWNER));
});

test('resolveAppraisalReviewer skips with no_manager when nothing resolves', () => {
  const out = resolveAppraisalReviewer(emp({}), {});
  assert.strictEqual(out.reviewer, null);
  assert.strictEqual(out.reason, 'no_manager');
});

test('resolveAppraisalReviewer accepts a lookup function as well as a Map', () => {
  const staff = emp({ department: SALES });
  const viaFn = resolveAppraisalReviewer(staff, {
    departmentManagerOf: (deptId) => (String(deptId) === String(SALES) ? SALES_MANAGER : null),
    ownerId: OWNER,
  });
  assert.strictEqual(viaFn.reviewer, String(SALES_MANAGER));
});

// ───────────────────────────────────────────────────────────────────────────
// §9.1 planCycleLaunch snapshots the department
// ───────────────────────────────────────────────────────────────────────────
test('planCycleLaunch snapshots the department alongside the resolved reviewer', () => {
  const staff = emp({ department: SALES });
  const plan = planCycleLaunch([staff], [], { departmentManagerOf: deptManagers, ownerId: OWNER });
  assert.deepStrictEqual(plan.toCreate, [
    { employee: String(staff._id), manager: String(SALES_MANAGER), department: String(SALES) },
  ]);
});

test('planCycleLaunch reports the owner as skipped rather than omitting them', () => {
  const owner = emp({ _id: OWNER, role: 'tenant_owner' });
  const staff = emp({ department: SALES });
  const plan = planCycleLaunch([owner, staff], [], { departmentManagerOf: deptManagers, ownerId: OWNER });
  assert.deepStrictEqual(plan.skipped, [{ employee: String(OWNER), reason: 'is_owner' }]);
  assert.strictEqual(plan.toCreate.length, 1);
});

// ───────────────────────────────────────────────────────────────────────────
// §9.4 scopeDepartmentsFor + resolveAppraisalAccess
// ───────────────────────────────────────────────────────────────────────────
test('scopeDepartmentsFor returns null (unrestricted) for an owner or super_admin', () => {
  assert.strictEqual(scopeDepartmentsFor({ role: 'tenant_owner' }, [SALES]), null);
  assert.strictEqual(scopeDepartmentsFor({ role: 'super_admin' }, []), null);
});

test('scopeDepartmentsFor returns the departments a tenant_admin manages, deduped as strings', () => {
  const out = scopeDepartmentsFor({ role: 'tenant_admin' }, [SALES, { _id: SALES }, OPS]);
  assert.deepStrictEqual(out, [String(SALES), String(OPS)]);
});

test('scopeDepartmentsFor returns an empty scope for an admin who manages nothing', () => {
  assert.deepStrictEqual(scopeDepartmentsFor({ role: 'tenant_admin' }, []), []);
});

const TENANT = oid();
const SUBJECT = oid();

const appraisalIn = (department, over = {}) => ({
  _id: oid(),
  tenant: TENANT,
  employee: SUBJECT,
  manager: SALES_MANAGER,
  department,
  state: 'collecting',
  ...over,
});

test('resolveAppraisalAccess gives a tenant_owner HR access to every department', () => {
  const access = resolveAppraisalAccess(
    { _id: OWNER, tenant: TENANT, role: 'tenant_owner' },
    appraisalIn(OPS),
    { departmentScope: null }
  );
  assert.strictEqual(access.relation, 'hr');
});

test('resolveAppraisalAccess gives a tenant_admin HR access inside a department they manage', () => {
  const access = resolveAppraisalAccess(
    { _id: oid(), tenant: TENANT, role: 'tenant_admin' },
    appraisalIn(SALES),
    { departmentScope: [String(SALES)] }
  );
  assert.strictEqual(access.relation, 'hr');
});

test('resolveAppraisalAccess denies a tenant_admin outside the departments they manage', () => {
  const access = resolveAppraisalAccess(
    { _id: oid(), tenant: TENANT, role: 'tenant_admin' },
    appraisalIn(OPS),
    { departmentScope: [String(SALES)] }
  );
  assert.strictEqual(access.relation, 'none');
  assert.strictEqual(access.canRead, false);
});

test('resolveAppraisalAccess falls a scoped-out tenant_admin THROUGH to their ordinary relations', () => {
  const adminId = oid();
  // They manage nothing, but they are the assigned reviewer on this record.
  const asManager = resolveAppraisalAccess(
    { _id: adminId, tenant: TENANT, role: 'tenant_admin' },
    appraisalIn(OPS, { manager: adminId }),
    { departmentScope: [] }
  );
  assert.strictEqual(asManager.relation, 'manager');

  // And on their OWN appraisal they are still the subject, never HR.
  const asSubject = resolveAppraisalAccess(
    { _id: adminId, tenant: TENANT, role: 'tenant_admin' },
    appraisalIn(SALES, { employee: adminId, state: 'released' }),
    { departmentScope: [String(SALES)] }
  );
  assert.strictEqual(asSubject.relation, 'subject');
});

test('resolveAppraisalAccess fails CLOSED for a tenant_admin when no scope is supplied', () => {
  // A caller that forgets to load the scope must not hand out HR powers.
  const access = resolveAppraisalAccess(
    { _id: oid(), tenant: TENANT, role: 'tenant_admin' },
    appraisalIn(SALES)
  );
  assert.strictEqual(access.relation, 'none');
});

test('resolveAppraisalAccess denies a tenant_admin an appraisal with no department at all', () => {
  // A pre-Phase-5 appraisal carries no department. It belongs to the owner to
  // look at, not to whichever admin happens to be logged in.
  const access = resolveAppraisalAccess(
    { _id: oid(), tenant: TENANT, role: 'tenant_admin' },
    appraisalIn(undefined),
    { departmentScope: [String(SALES)] }
  );
  assert.strictEqual(access.relation, 'none');
});

test('resolveAppraisalAccess still puts subject first for an in-scope admin being appraised', () => {
  const adminId = oid();
  const access = resolveAppraisalAccess(
    { _id: adminId, tenant: TENANT, role: 'tenant_admin' },
    appraisalIn(SALES, { employee: adminId }),
    { departmentScope: [String(SALES)] }
  );
  assert.strictEqual(access.relation, 'subject');
  assert.strictEqual(access.canSeePeerFeedback, false);
});

// ───────────────────────────────────────────────────────────────────────────
// §9.3 per-question comments
// ───────────────────────────────────────────────────────────────────────────
test('normaliseAnswers keeps a comment on a manager answer', () => {
  const qid = oid();
  const { answers, errors } = normaliseAnswers([{ questionId: qid, rating: 4, comment: '  Solid quarter.  ' }], 'manager');
  assert.deepStrictEqual(errors, []);
  assert.strictEqual(answers[0].comment, 'Solid quarter.');
});

test('normaliseAnswers strips a comment from a self answer', () => {
  const qid = oid();
  const { answers } = normaliseAnswers([{ questionId: qid, rating: 5, comment: 'I am great' }], 'self');
  assert.strictEqual('comment' in answers[0], false);
  assert.strictEqual(answers[0].rating, 5);
});

test('normaliseAnswers strips a comment from a peer answer, including a not-observed one', () => {
  const qid = oid();
  const { answers } = normaliseAnswers(
    [
      { questionId: qid, text: 'ok', comment: 'sneaky' },
      { questionId: oid(), notObserved: true, comment: 'sneaky too' },
    ],
    'peer'
  );
  assert.strictEqual('comment' in answers[0], false);
  assert.strictEqual('comment' in answers[1], false);
});

test('normaliseAnswers drops a blank manager comment rather than storing an empty string', () => {
  const { answers } = normaliseAnswers([{ questionId: oid(), rating: 3, comment: '   ' }], 'manager');
  assert.strictEqual('comment' in answers[0], false);
});

test('projectFeedbackForViewer strips answer comments from a viewer who may not read them', () => {
  const row = {
    kind: 'manager',
    status: 'submitted',
    answers: [{ questionId: oid(), rating: 4, comment: 'private note' }],
  };
  const hidden = projectFeedbackForViewer(row, { canSeeAnswerComments: false });
  assert.strictEqual('comment' in hidden.answers[0], false);
  const shown = projectFeedbackForViewer(row, { canSeeAnswerComments: true });
  assert.strictEqual(shown.answers[0].comment, 'private note');
});

test('projectFeedbackForViewer does not mutate the row it was given', () => {
  const answers = [{ questionId: oid(), rating: 4, comment: 'private note' }];
  const row = { kind: 'manager', status: 'submitted', answers };
  projectFeedbackForViewer(row, { canSeeAnswerComments: false });
  assert.strictEqual(answers[0].comment, 'private note');
});

test('the subject sees no answer comments before release and does see them after', () => {
  const before = resolveAppraisalAccess(
    { _id: SUBJECT, tenant: TENANT, role: 'tenant_staff' },
    appraisalIn(SALES, { state: 'collecting' })
  );
  assert.strictEqual(before.canSeeAnswerComments, false);
  const after = resolveAppraisalAccess(
    { _id: SUBJECT, tenant: TENANT, role: 'tenant_staff' },
    appraisalIn(SALES, { state: 'released' })
  );
  assert.strictEqual(after.canSeeAnswerComments, true);
});

test('buildComparison carries the manager comment on the manager side', () => {
  const qid = oid();
  const sections = [{ title: 'S', questions: [{ _id: qid, type: 'rating', label: 'Q', scaleMax: 5, askOf: ['self', 'manager'] }] }];
  const feedback = [
    { kind: 'self', status: 'submitted', answers: [{ questionId: qid, rating: 5 }] },
    { kind: 'manager', status: 'submitted', answers: [{ questionId: qid, rating: 3, comment: 'Over-rated yourself here.' }] },
  ];
  const [row] = buildComparison(sections, feedback, { canSeeReviewerNames: true, canSeeAnswerComments: true });
  assert.strictEqual(row.self, 5);
  assert.strictEqual(row.manager, 3);
  assert.strictEqual(row.managerComment, 'Over-rated yourself here.');
});

test('buildComparison reports no manager comment as null, never undefined', () => {
  const qid = oid();
  const sections = [{ title: 'S', questions: [{ _id: qid, type: 'rating', label: 'Q', scaleMax: 5, askOf: ['self', 'manager'] }] }];
  const [row] = buildComparison(sections, [
    { kind: 'manager', status: 'submitted', answers: [{ questionId: qid, rating: 3 }] },
  ], {});
  assert.strictEqual(row.managerComment, null);
});
