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
  appraisalRolesFor,
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
// §9.1b filterSections — the ROLE dimension
//
// Cashiers and attendants must answer different questions, and they are
// EmployeeRoles rather than departments: an earlier migration moved those
// values out of the department field precisely because they are job roles,
// and roles cross departments in the live data. So sections carry a second
// scoping list, `roles`, matched the same inverted way `departments` is —
// empty means EVERYONE — and ANDed with it, so a section can read
// "Retail cashiers" rather than "Retail or any cashier anywhere".
// ───────────────────────────────────────────────────────────────────────────
const RETAIL = oid();
const WAREHOUSE = oid();
const CASHIER = oid();
const ATTENDANT = oid();

const ROLE_SECTIONS = [
  {
    title: 'Everyone',
    questions: [{ _id: oid(), label: 'R1', askOf: ['self', 'manager'] }],
  },
  {
    title: 'Retail core',
    departments: [RETAIL],
    roles: [],
    questions: [{ _id: oid(), label: 'R2', askOf: ['self', 'manager'] }],
  },
  {
    title: 'Retail cashiers',
    departments: [RETAIL],
    roles: [CASHIER],
    questions: [{ _id: oid(), label: 'R3', askOf: ['self', 'manager'] }],
  },
  {
    title: 'Retail attendants',
    departments: [RETAIL],
    roles: [ATTENDANT],
    questions: [{ _id: oid(), label: 'R4', askOf: ['self', 'manager'] }],
  },
  {
    title: 'Cashiers anywhere',
    roles: [CASHIER],
    questions: [{ _id: oid(), label: 'R5', askOf: ['self', 'manager'] }],
  },
];

const forRole = (departmentId, roleIds) =>
  titles(filterSections(ROLE_SECTIONS, { kind: 'self', departmentId, roleIds }));

test('filterSections keeps a role-scoped section only for a holder of that role', () => {
  assert.deepStrictEqual(forRole(RETAIL, [CASHIER]), [
    'Everyone',
    'Retail core',
    'Retail cashiers',
    'Cashiers anywhere',
  ]);
  assert.deepStrictEqual(forRole(RETAIL, [ATTENDANT]), [
    'Everyone',
    'Retail core',
    'Retail attendants',
  ]);
});

test('filterSections ANDs the two dimensions, so a cashier elsewhere misses the Retail block', () => {
  // The whole point of AND: "Retail cashiers" must not read as
  // "in Retail OR a cashier anywhere".
  assert.deepStrictEqual(forRole(WAREHOUSE, [CASHIER]), ['Everyone', 'Cashiers anywhere']);
});

test('filterSections treats an empty roles list as everyone, exactly like departments', () => {
  // Someone in Retail holding no role at all still gets the unscoped and the
  // department-wide sections. The inversion is the same trap `departments`
  // already carries: a multi-select with nothing ticked normally means an
  // empty set; here it means unrestricted.
  assert.deepStrictEqual(forRole(RETAIL, []), ['Everyone', 'Retail core']);
  assert.deepStrictEqual(forRole(RETAIL, null), ['Everyone', 'Retail core']);
  assert.deepStrictEqual(forRole(RETAIL, undefined), ['Everyone', 'Retail core']);
});

test('filterSections matches a role section when ANY held role is named', () => {
  // The schema allows two roles even though nobody holds two today. Whichever
  // roles reach here, an intersection is what decides.
  assert.deepStrictEqual(forRole(RETAIL, [ATTENDANT, CASHIER]), [
    'Everyone',
    'Retail core',
    'Retail cashiers',
    'Retail attendants',
    'Cashiers anywhere',
  ]);
});

test('filterSections accepts role ids as strings, documents or ObjectIds', () => {
  const expected = ['Everyone', 'Retail core', 'Retail cashiers', 'Cashiers anywhere'];
  assert.deepStrictEqual(forRole(RETAIL, [String(CASHIER)]), expected);
  assert.deepStrictEqual(forRole(RETAIL, [{ _id: CASHIER }]), expected);
  assert.deepStrictEqual(forRole(String(RETAIL), [CASHIER]), expected);
});

test('filterSections drops every role-scoped section for a role-less employee', () => {
  // A missing `roleIds` must not be read as "matches anything": an employee
  // nobody gave a role is as unscoped as one in the wrong department.
  assert.deepStrictEqual(forRole(null, [CASHIER]), ['Everyone', 'Cashiers anywhere']);
  assert.deepStrictEqual(forRole(null, []), ['Everyone']);
});

test('getAskedQuestionIds follows the role rule, so an attendant cannot answer a cashier question', () => {
  const cashierQuestionId = String(ROLE_SECTIONS[2].questions[0]._id);
  const attendant = getAskedQuestionIds(
    filterSections(ROLE_SECTIONS, { kind: 'self', departmentId: RETAIL, roleIds: [ATTENDANT] })
  );
  assert.strictEqual(attendant.has(cashierQuestionId), false);
  const cashier = getAskedQuestionIds(
    filterSections(ROLE_SECTIONS, { kind: 'self', departmentId: RETAIL, roleIds: [CASHIER] })
  );
  assert.strictEqual(cashier.has(cashierQuestionId), true);
});

// ───────────────────────────────────────────────────────────────────────────
// §9.2 resolveAppraisalReviewer
// ───────────────────────────────────────────────────────────────────────────
const OWNER = oid();
const SALES_MANAGER = oid();

const emp = (over = {}) => ({
  _id: over._id || oid(),
  role: over.role || 'tenant_staff',
  employeeProfile: {
    work: { department: over.department, manager: over.manager },
    planning: { roles: over.roles, defaultRole: over.defaultRole },
  },
});

const deptManagers = new Map([[String(SALES), String(SALES_MANAGER)]]);

test('resolveAppraisalReviewer gives the tenant owner no appraisal, with a reason', () => {
  const owner = emp({ _id: OWNER, role: 'tenant_owner', department: SALES });
  const out = resolveAppraisalReviewer(owner, { departmentManagerOf: deptManagers, ownerId: OWNER });
  assert.strictEqual(out.reviewer, null);
  assert.strictEqual(out.reason, 'is_owner');
});

test('resolveAppraisalReviewer routes a tenant_admin with no reporting line to the owner, never to their department manager', () => {
  const admin = emp({ role: 'tenant_admin', department: SALES });
  const out = resolveAppraisalReviewer(admin, { departmentManagerOf: deptManagers, ownerId: OWNER });
  assert.strictEqual(out.reviewer, String(OWNER));
});

// An admin's reporting line beats the owner for the same reason it beats the
// department: it is the relationship somebody actually recorded. It also makes
// routing independent of WHICH owner row a lookup happens to return — a tenant
// with two tenant_owner users (a leftover setup account beside the real
// proprietor) otherwise routes its admins to whichever one findOne picks.
test('resolveAppraisalReviewer prefers a tenant_admin\'s own work.manager over the owner', () => {
  const boss = oid();
  const admin = emp({ role: 'tenant_admin', department: SALES, manager: boss });
  const out = resolveAppraisalReviewer(admin, { departmentManagerOf: deptManagers, ownerId: OWNER });
  assert.strictEqual(out.reviewer, String(boss));
});

test('resolveAppraisalReviewer still keeps a tenant_admin away from their department manager when they report to someone', () => {
  // SALES_MANAGER runs SALES; the admin sits in SALES but reports elsewhere.
  const boss = oid();
  const admin = emp({ role: 'tenant_admin', department: SALES, manager: boss });
  const out = resolveAppraisalReviewer(admin, { departmentManagerOf: deptManagers, ownerId: OWNER });
  assert.notStrictEqual(out.reviewer, String(SALES_MANAGER));
});

// The reporting line beats the department. `employeeProfile.work.manager` is
// what the org chart at /employees actually renders, and it routinely crosses
// departments — one admin there has direct reports in Guest Services, Cashier
// and Marketing at once. Preferring the department manager handed that admin's
// people to whoever ran their department instead, and handed the department
// manager a queue of people who do not report to them.
test('resolveAppraisalReviewer prefers the reporting line over the department manager', () => {
  const workManager = oid();
  const staff = emp({ department: SALES, manager: workManager });
  const out = resolveAppraisalReviewer(staff, { departmentManagerOf: deptManagers, ownerId: OWNER });
  assert.strictEqual(out.reviewer, String(workManager));
  assert.strictEqual(out.department, String(SALES));
});

test('resolveAppraisalReviewer routes staff with no work.manager to their department manager', () => {
  const staff = emp({ department: SALES });
  const out = resolveAppraisalReviewer(staff, { departmentManagerOf: deptManagers, ownerId: OWNER });
  assert.strictEqual(out.reviewer, String(SALES_MANAGER));
  assert.strictEqual(out.department, String(SALES));
});

// A self-referential reporting line is a data error, not an instruction to
// give up: the department manager is still a real, correct reviewer for this
// person, so it is tried before the owner.
test('resolveAppraisalReviewer falls past a self-referential work.manager to the department manager', () => {
  const id = oid();
  const staff = emp({ _id: id, department: SALES, manager: id });
  const out = resolveAppraisalReviewer(staff, { departmentManagerOf: deptManagers, ownerId: OWNER });
  assert.strictEqual(out.reviewer, String(SALES_MANAGER));
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

// The owner is the PREFERRED reviewer for an admin, not the only one. A tenant
// with no tenant_owner row still has a reporting line worth using, and this is
// easy to drop when reordering the branches above — the admin path returns
// early, so a fallback that stopped consulting work.manager would leave every
// admin in an ownerless tenant with no appraisal at all.
test('resolveAppraisalReviewer falls back to work.manager for a tenant_admin when there is no owner', () => {
  const workManager = oid();
  const admin = emp({ role: 'tenant_admin', department: SALES, manager: workManager });
  const out = resolveAppraisalReviewer(admin, { departmentManagerOf: deptManagers });
  assert.strictEqual(out.reviewer, String(workManager));
});

test('resolveAppraisalReviewer reports self_manager for a tenant_admin who is their own manager and has no owner', () => {
  const id = oid();
  const admin = emp({ _id: id, role: 'tenant_admin', manager: id });
  const out = resolveAppraisalReviewer(admin, {});
  assert.strictEqual(out.reviewer, null);
  assert.strictEqual(out.reason, 'self_manager');
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
// §9.1 planCycleLaunch snapshots the department and the roles
// ───────────────────────────────────────────────────────────────────────────
test('planCycleLaunch snapshots the department alongside the resolved reviewer', () => {
  const staff = emp({ department: SALES });
  const plan = planCycleLaunch([staff], [], { departmentManagerOf: deptManagers, ownerId: OWNER });
  assert.deepStrictEqual(plan.toCreate, [
    {
      employee: String(staff._id),
      manager: String(SALES_MANAGER),
      department: String(SALES),
      roles: [],
    },
  ]);
});

test('appraisalRolesFor prefers defaultRole, so a two-role employee still gets ONE role block', () => {
  // Decided 2026-08-09 rather than discovered in production. Every role block
  // is written to total the same score out of 100 on its own; an employee
  // matching two of them would be marked out of 140, and HR's A–E grade bands
  // are read straight off that /100. defaultRole is the one the employee
  // mostly does, and it is what the rostering UI already treats as primary.
  assert.deepStrictEqual(
    appraisalRolesFor(emp({ roles: [ATTENDANT, CASHIER], defaultRole: CASHIER })),
    [String(CASHIER)]
  );
});

test('appraisalRolesFor falls back to every listed role when no default is set', () => {
  // A record with roles and no default is incomplete data, not a two-role
  // employee. Taking all of them keeps the form generous rather than blank —
  // the failure mode we can recover from.
  assert.deepStrictEqual(appraisalRolesFor(emp({ roles: [ATTENDANT] })), [String(ATTENDANT)]);
  assert.deepStrictEqual(
    appraisalRolesFor(emp({ roles: [ATTENDANT, CASHIER] })),
    [String(ATTENDANT), String(CASHIER)]
  );
});

test('appraisalRolesFor returns an empty list for an employee with no roles at all', () => {
  assert.deepStrictEqual(appraisalRolesFor(emp({})), []);
  assert.deepStrictEqual(appraisalRolesFor(null), []);
});

test('appraisalRolesFor keeps a defaultRole that is missing from roles[]', () => {
  // The two fields are set by different screens and drift. The default is the
  // stronger statement of what the person does, so it stands on its own.
  assert.deepStrictEqual(appraisalRolesFor(emp({ defaultRole: CASHIER })), [String(CASHIER)]);
});

test('planCycleLaunch snapshots the roles, so a reassignment mid-cycle cannot reshape an open form', () => {
  const staff = emp({ department: SALES, roles: [ATTENDANT, CASHIER], defaultRole: CASHIER });
  const plan = planCycleLaunch([staff], [], { departmentManagerOf: deptManagers, ownerId: OWNER });
  assert.deepStrictEqual(plan.toCreate[0].roles, [String(CASHIER)]);
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

// ── Routing and read scope are separate mechanisms, and must stay separate ──
// Reviewer routing now prefers employeeProfile.work.manager, which crosses
// departments as a matter of course. Read access is scoped by
// Department.manager instead. So the new routing rule can hand somebody an
// appraisal in a department they do not manage, and if HR scope were the only
// gate they would be assigned a review they cannot open — a 403 on their own
// team list, with nothing to tell them why.
//
// It does not, because the `manager` branch of resolveAppraisalAccess is keyed
// on appraisal.manager and never consults departmentScope. This pins that:
// the two directions below must BOTH hold, or the mechanisms have merged.
test('resolveAppraisalAccess lets a cross-department reviewer open the appraisal they were routed', () => {
  const access = resolveAppraisalAccess(
    { _id: SALES_MANAGER, tenant: TENANT, role: 'tenant_admin' },
    appraisalIn(OPS), // manager: SALES_MANAGER, department they do NOT manage
    { departmentScope: [String(SALES)] }
  );
  assert.strictEqual(access.relation, 'manager');
  assert.strictEqual(access.canRead, true);
});

test('being routed one appraisal outside their scope does not widen a tenant_admin into HR there', () => {
  // The narrowing that must survive: they get the one record they review, not
  // the department it sits in.
  const access = resolveAppraisalAccess(
    { _id: SALES_MANAGER, tenant: TENANT, role: 'tenant_admin' },
    appraisalIn(OPS, { manager: oid() }), // same department, someone else's review
    { departmentScope: [String(SALES)] }
  );
  assert.strictEqual(access.relation, 'none');
  assert.strictEqual(access.canRead, false);
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
