# Appraisal Module — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the core appraisal loop — HR launches a review cycle, employee and manager each complete an assessment, the manager summarises and rates, HR or the manager releases it, and the employee acknowledges.

**Architecture:** Four tenant-scoped Mongoose collections (`AppraisalTemplate`, `AppraisalCycle`, `Appraisal`, `AppraisalFeedback`). All decision logic — the state machine, the relationship-based access resolver, the anonymity projection, and cycle launch planning — lives in **pure functions** in `server/services/appraisal.helpers.js` with no database access, so it is unit-testable with `node:test`. Controllers stay thin and are split by audience. The admin UI adds an `/appraisals` route tree reachable by every tenant role.

**Tech Stack:** Node/Express, Mongoose, `node:test` + `node:assert` (server); Next.js App Router, TypeScript, Vitest (admin).

**Spec:** `docs/superpowers/specs/2026-08-03-appraisal-module-design.md`

## Global Constraints

- **Index rule:** every unique index is compound on `tenant` and declared with `schema.index(...)`. Never use field-level `unique: true` — that is what made `poNumber_1` enforce global uniqueness across tenants, and Mongoose never drops or re-options an index it already created.
- **Server test command:** `node --test '__tests__/*.test.js'` run from `server/`. `npm test` is broken — do not use it.
- **Server baseline:** 939/942 passing. 3 pre-existing failures (1 pricelist populate, 2 SO-number). Do not attempt to fix these; the plan must not increase the failure count.
- **Admin typecheck:** `node_modules/.bin/tsc --noEmit` from `client/apps/admin`. Baseline ~461 errors. `npx tsc` incorrectly reports 0 — do not use it.
- **Admin tests:** Vitest, 99 passing baseline.
- **Tenant isolation:** every route uses `protect` + `attachTenant` + `requireOwnTenant`. JWT claim only — never accept a client-supplied `tenantId` or a `?tenant=` pivot.
- **Phase 1 states only:** `draft → collecting → summarising → released → acknowledged`, plus `cancelled`. The `nominating` and `pending_peer_approval` states and the `peer` feedback kind ship in the schema but are unreachable in Phase 1.
- **Relation precedence:** `subject` → `hr` → `manager` → `reviewer` → `none`. First match wins.
- `employeeProfile.appraisal.nextAppraisalDate` is deliberately **not** written in Phase 1.

## File Structure

**Create — server:**
| File | Responsibility |
| --- | --- |
| `server/services/appraisal.helpers.js` | All pure logic: state machine, access resolver, anonymity projection, launch planning, default template |
| `server/models/AppraisalTemplate.js` | Form definition schema |
| `server/models/AppraisalCycle.js` | Review round schema |
| `server/models/Appraisal.js` | Per-employee-per-cycle record |
| `server/models/AppraisalFeedback.js` | Per-reviewer feedback row |
| `server/controllers/appraisalCycle.controller.js` | HR: create, list, launch, close, progress |
| `server/controllers/appraisal.controller.js` | Subject + manager: my, team, detail, summary, release, acknowledge |
| `server/controllers/appraisalFeedback.controller.js` | Reviewers: load, save draft, submit |
| `server/routes/appraisal.routes.js` | All three routers |
| `server/__tests__/appraisal.helpers.test.js` | Unit tests for the pure helpers |
| `server/__tests__/appraisal.model.test.js` | Index-shape guard tests |

**Create — admin:**
| File | Responsibility |
| --- | --- |
| `client/apps/admin/src/services/appraisal.service.ts` | Types + fetch layer |
| `.../app/(hydrogen)/appraisals/page.tsx` | "My appraisals" landing |
| `.../app/(hydrogen)/appraisals/[id]/page.tsx` | Detail, dispatches by relation |
| `.../app/(hydrogen)/appraisals/reviews/[feedbackId]/page.tsx` | Reviewer form |
| `.../app/(hydrogen)/appraisals/team/page.tsx` | Manager's reports |
| `.../app/(hydrogen)/appraisals/cycles/page.tsx` | HR cycle list |
| `.../app/(hydrogen)/appraisals/cycles/[id]/page.tsx` | HR cycle detail |
| `.../app/shared/appraisals/*.tsx` | View components |

**Modify:**
| File | Change |
| --- | --- |
| `server/server.js:243` area | Mount `/api/appraisals`, `/api/appraisal-cycles`, `/api/appraisal-feedback` |
| `client/apps/admin/src/types/authorization.ts` | Add `appraisals:*` permissions |
| `client/apps/admin/src/middleware.ts:169` area | Gate `/appraisals/cycles` HR-only; leave `/appraisals` open to all tenant roles |
| `client/apps/admin/src/layouts/hydrogen/tenant-menu-items.tsx` | Add Appraisals nav |

---

### Task 1: Pure helpers — state machine, access resolver, anonymity

This is the security-critical task. Everything here is a pure function over plain objects, so it is testable without a database.

**Files:**
- Create: `server/services/appraisal.helpers.js`
- Test: `server/__tests__/appraisal.helpers.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `APPRAISAL_STATES: string[]`
  - `canTransition(from: string, to: string): boolean`
  - `assertTransition(from: string, to: string): void` — throws `Error` with `.status = 400`
  - `resolveAppraisalAccess(user, appraisal): Access` where `Access = { relation, canRead, canSeeReviewerNames, canSummarise, canRelease, canAcknowledge, canManageCycle }`
  - `projectFeedbackForViewer(feedback, access): object`
  - `planCycleLaunch(employees, existingEmployeeIds): { toCreate, skipped, alreadyExists }`
  - `buildDefaultTemplate(tenantId, createdBy): object`

- [ ] **Step 1: Write the failing test**

Create `server/__tests__/appraisal.helpers.test.js`:

```js
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
} = require('../services/appraisal.helpers');

const TENANT = 'tenant-1';
const HR = { _id: 'u-hr', role: 'tenant_admin', tenant: TENANT };
const MANAGER = { _id: 'u-mgr', role: 'tenant_staff', tenant: TENANT };
const EMPLOYEE = { _id: 'u-emp', role: 'tenant_staff', tenant: TENANT };
const PEER = { _id: 'u-peer', role: 'tenant_staff', tenant: TENANT };
const OUTSIDER = { _id: 'u-out', role: 'tenant_staff', tenant: TENANT };

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

test('manager sees reviewer names and can summarise and release', () => {
  const access = resolveAppraisalAccess(MANAGER, APPRAISAL);
  assert.strictEqual(access.relation, 'manager');
  assert.strictEqual(access.canSeeReviewerNames, true);
  assert.strictEqual(access.canSummarise, true);
  assert.strictEqual(access.canRelease, true);
  assert.strictEqual(access.canAcknowledge, false);
});

test('subject cannot see reviewer names and can only acknowledge', () => {
  const access = resolveAppraisalAccess(EMPLOYEE, APPRAISAL);
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

test('a user from another tenant is none even if ids somehow match', () => {
  const access = resolveAppraisalAccess({ ...MANAGER, tenant: 'tenant-2' }, APPRAISAL);
  assert.strictEqual(access.relation, 'none');
  assert.strictEqual(access.canRead, false);
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
  assert.deepStrictEqual(plan.toCreate, [{ employee: 'e1', manager: 'm1' }]);
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

test('buildDefaultTemplate asks every question of both self and manager', () => {
  const tpl = buildDefaultTemplate(TENANT, 'u-hr');
  assert.strictEqual(tpl.tenant, TENANT);
  const questions = tpl.sections.flatMap((s) => s.questions);
  assert.ok(questions.length > 0);
  for (const q of questions) {
    assert.ok(q.askOf.includes('self'), `${q.label} must be asked of self`);
    assert.ok(q.askOf.includes('manager'), `${q.label} must be asked of manager`);
  }
  assert.ok(questions.some((q) => q.type === 'rating'));
  assert.ok(questions.some((q) => q.type === 'text'));
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd server && node --test '__tests__/appraisal.helpers.test.js'
```
Expected: FAIL — `Cannot find module '../services/appraisal.helpers'`

- [ ] **Step 3: Write the implementation**

Create `server/services/appraisal.helpers.js`:

```js
// server/services/appraisal.helpers.js
//
// Pure decision logic for the appraisal module. Nothing here touches the
// database, which is what lets the security-critical access rules be unit
// tested exhaustively.

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
  nominating: ['pending_peer_approval', 'cancelled'],
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

const NO_ACCESS = {
  relation: 'none',
  canRead: false,
  canSeeReviewerNames: false,
  canSummarise: false,
  canRelease: false,
  canAcknowledge: false,
  canManageCycle: false,
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

  // Cross-tenant access is never possible, whatever the ids say.
  if (idOf(user.tenant) !== idOf(appraisal.tenant)) return { ...NO_ACCESS };

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
    };
  }

  if (HR_ROLES.includes(user.role)) {
    return {
      relation: 'hr',
      canRead: true,
      canSeeReviewerNames: true,
      canSummarise: true,
      canRelease: state === 'summarising',
      canAcknowledge: false,
      canManageCycle: true,
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
    };
  }

  return { ...NO_ACCESS };
}

/**
 * Strip the reviewer identity from peer feedback for viewers who may not see
 * it. Self and manager feedback are attributed by definition — there is only
 * one possible author and hiding it would be theatre.
 */
function projectFeedbackForViewer(feedback, access) {
  const plain =
    typeof feedback?.toObject === 'function' ? feedback.toObject() : { ...feedback };
  if (plain.kind === 'peer' && !access?.canSeeReviewerNames) {
    delete plain.reviewer;
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

module.exports = {
  APPRAISAL_STATES,
  TRANSITIONS,
  HR_ROLES,
  canTransition,
  assertTransition,
  resolveAppraisalAccess,
  projectFeedbackForViewer,
  planCycleLaunch,
  buildDefaultTemplate,
};
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd server && node --test '__tests__/appraisal.helpers.test.js'
```
Expected: PASS, all tests green.

- [ ] **Step 5: Confirm the full suite has not regressed**

```bash
cd server && node --test '__tests__/*.test.js' 2>&1 | tail -15
```
Expected: 3 failures only (the known pricelist/SO-number ones). Total pass count should be baseline 939 + the new tests.

- [ ] **Step 6: Commit**

```bash
git add server/services/appraisal.helpers.js server/__tests__/appraisal.helpers.test.js
git commit -m "feat(appraisals): pure state machine, access resolver and launch planner"
```

---

### Task 2: The four Mongoose models

**Files:**
- Create: `server/models/AppraisalTemplate.js`, `server/models/AppraisalCycle.js`, `server/models/Appraisal.js`, `server/models/AppraisalFeedback.js`
- Test: `server/__tests__/appraisal.model.test.js`

**Interfaces:**
- Consumes: `APPRAISAL_STATES` from Task 1.
- Produces: models `AppraisalTemplate`, `AppraisalCycle`, `Appraisal`, `AppraisalFeedback`.

- [ ] **Step 1: Write the failing test**

Create `server/__tests__/appraisal.model.test.js`:

```js
// server/__tests__/appraisal.model.test.js
const test = require('node:test');
const assert = require('node:assert');

const Appraisal = require('../models/Appraisal');
const AppraisalFeedback = require('../models/AppraisalFeedback');
const AppraisalCycle = require('../models/AppraisalCycle');
const AppraisalTemplate = require('../models/AppraisalTemplate');

// Guard against the failure mode that bit purchase documents: a field-level
// `unique: true` enforces GLOBAL uniqueness, so tenant B collides with tenant A.
function assertNoFieldLevelUnique(model) {
  model.schema.eachPath((pathName, type) => {
    assert.notStrictEqual(
      type.options?.unique,
      true,
      `${model.modelName}.${pathName} declares field-level unique:true — use a compound index on tenant instead`
    );
  });
}

test('no appraisal model declares a field-level unique index', () => {
  [Appraisal, AppraisalFeedback, AppraisalCycle, AppraisalTemplate].forEach(
    assertNoFieldLevelUnique
  );
});

test('Appraisal is unique per (tenant, cycle, employee)', () => {
  const unique = Appraisal.schema.indexes().filter(([, opts]) => opts.unique);
  assert.strictEqual(unique.length, 1);
  assert.deepStrictEqual(unique[0][0], { tenant: 1, cycle: 1, employee: 1 });
});

test('AppraisalFeedback is unique per (appraisal, reviewer)', () => {
  const unique = AppraisalFeedback.schema.indexes().filter(([, opts]) => opts.unique);
  assert.strictEqual(unique.length, 1);
  assert.deepStrictEqual(unique[0][0], { appraisal: 1, reviewer: 1 });
});

test('every appraisal model is tenant-scoped and indexed', () => {
  [Appraisal, AppraisalFeedback, AppraisalCycle, AppraisalTemplate].forEach((m) => {
    const tenantPath = m.schema.path('tenant');
    assert.ok(tenantPath, `${m.modelName} must have a tenant path`);
    assert.strictEqual(tenantPath.options.required, true);
    assert.strictEqual(tenantPath.options.index, true);
  });
});

test('Appraisal state enum matches the documented state machine', () => {
  const states = Appraisal.schema.path('state').options.enum;
  assert.deepStrictEqual(states, [
    'draft',
    'nominating',
    'pending_peer_approval',
    'collecting',
    'summarising',
    'released',
    'acknowledged',
    'cancelled',
  ]);
  assert.strictEqual(Appraisal.schema.path('state').options.default, 'draft');
});

test('AppraisalFeedback supports all three reviewer kinds', () => {
  assert.deepStrictEqual(AppraisalFeedback.schema.path('kind').options.enum, [
    'self',
    'manager',
    'peer',
  ]);
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd server && node --test '__tests__/appraisal.model.test.js'
```
Expected: FAIL — `Cannot find module '../models/Appraisal'`

- [ ] **Step 3: Write the four models**

Create `server/models/AppraisalTemplate.js`:

```js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const questionSchema = new Schema({
  type: { type: String, enum: ['rating', 'text'], required: true },
  label: { type: String, required: true, trim: true, maxlength: 300 },
  helpText: { type: String, trim: true, maxlength: 500 },
  required: { type: Boolean, default: true },
  scaleMax: { type: Number, min: 2, max: 10, default: 5 },
  // Which reviewer kinds are asked this question. Shared ids across kinds are
  // what make self-vs-manager comparison a direct lookup.
  askOf: {
    type: [String],
    enum: ['self', 'manager', 'peer'],
    default: ['self', 'manager', 'peer'],
  },
});

const sectionSchema = new Schema({
  title: { type: String, required: true, trim: true, maxlength: 200 },
  questions: [questionSchema],
});

const appraisalTemplateSchema = new Schema(
  {
    tenant: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 2000 },
    isArchived: { type: Boolean, default: false },
    sections: [sectionSchema],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AppraisalTemplate', appraisalTemplateSchema);
```

Create `server/models/AppraisalCycle.js`:

```js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const appraisalCycleSchema = new Schema(
  {
    tenant: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    template: { type: Schema.Types.ObjectId, ref: 'AppraisalTemplate', required: true },
    status: {
      type: String,
      enum: ['draft', 'collecting', 'closed', 'cancelled'],
      default: 'draft',
      index: true,
    },
    nominationDeadline: { type: Date },
    feedbackDeadline: { type: Date },
    peerCountMin: { type: Number, min: 0, default: 3 },
    peerCountMax: { type: Number, min: 0, default: 5 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    launchedAt: { type: Date },
    closedAt: { type: Date },
  },
  { timestamps: true }
);

appraisalCycleSchema.index({ tenant: 1, status: 1 });

module.exports = mongoose.model('AppraisalCycle', appraisalCycleSchema);
```

Create `server/models/Appraisal.js`:

```js
const mongoose = require('mongoose');
const { Schema } = mongoose;
const { APPRAISAL_STATES } = require('../services/appraisal.helpers');

const appraisalSchema = new Schema(
  {
    tenant: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    cycle: { type: Schema.Types.ObjectId, ref: 'AppraisalCycle', required: true, index: true },
    employee: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // Snapshot taken at launch. Never re-read from employeeProfile.work.manager:
    // a reorg mid-cycle must not rewrite who was responsible for this appraisal.
    manager: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    state: { type: String, enum: APPRAISAL_STATES, default: 'draft', index: true },
    // Denormalised list of everyone with a feedback row, so the access resolver
    // can identify a reviewer without a second query.
    reviewerIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    nominatedPeers: [{ type: Schema.Types.ObjectId, ref: 'User' }],  // Phase 2
    approvedPeers: [{ type: Schema.Types.ObjectId, ref: 'User' }],   // Phase 2
    summary: { type: String, trim: true, maxlength: 10000 },
    finalRating: { type: Number, min: 0, max: 10 },
    releasedAt: { type: Date },
    releasedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    acknowledgedAt: { type: Date },
    employeeResponse: { type: String, trim: true, maxlength: 10000 },
    cancelledAt: { type: Date },
    cancelReason: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

// Compound-only. A field-level unique here would collide across tenants.
appraisalSchema.index({ tenant: 1, cycle: 1, employee: 1 }, { unique: true });
appraisalSchema.index({ tenant: 1, manager: 1, state: 1 });

module.exports = mongoose.model('Appraisal', appraisalSchema);
```

Create `server/models/AppraisalFeedback.js`:

```js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const answerSchema = new Schema(
  {
    questionId: { type: Schema.Types.ObjectId, required: true },
    rating: { type: Number, min: 0, max: 10 },
    text: { type: String, trim: true, maxlength: 5000 },
  },
  { _id: false }
);

const appraisalFeedbackSchema = new Schema(
  {
    tenant: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    appraisal: { type: Schema.Types.ObjectId, ref: 'Appraisal', required: true, index: true },
    // Denormalised so cycle-wide completion stats are a count, not a join.
    cycle: { type: Schema.Types.ObjectId, ref: 'AppraisalCycle', required: true, index: true },
    reviewer: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    kind: { type: String, enum: ['self', 'manager', 'peer'], required: true },
    answers: [answerSchema],
    status: {
      type: String,
      enum: ['pending', 'submitted', 'expired'],
      default: 'pending',
      index: true,
    },
    submittedAt: { type: Date },
  },
  { timestamps: true }
);

appraisalFeedbackSchema.index({ appraisal: 1, reviewer: 1 }, { unique: true });
appraisalFeedbackSchema.index({ tenant: 1, reviewer: 1, status: 1 });

module.exports = mongoose.model('AppraisalFeedback', appraisalFeedbackSchema);
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd server && node --test '__tests__/appraisal.model.test.js'
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/models/Appraisal*.js server/__tests__/appraisal.model.test.js
git commit -m "feat(appraisals): add tenant-scoped models with compound unique indexes"
```

---

### Task 3: Cycle controller and routes (HR)

**Files:**
- Create: `server/controllers/appraisalCycle.controller.js`
- Create: `server/routes/appraisal.routes.js`
- Modify: `server/server.js` (mount points, near line 243)

**Interfaces:**
- Consumes: `planCycleLaunch`, `buildDefaultTemplate` (Task 1); all four models (Task 2).
- Produces: mounted routers at `/api/appraisal-cycles`, `/api/appraisals`, `/api/appraisal-feedback`. Exports `listCycles, createCycle, getCycle, launchCycle, closeCycle, cycleProgress`.

- [ ] **Step 1: Write the controller**

Create `server/controllers/appraisalCycle.controller.js`:

```js
// server/controllers/appraisalCycle.controller.js — HR-facing cycle management
const AppraisalCycle = require('../models/AppraisalCycle');
const AppraisalTemplate = require('../models/AppraisalTemplate');
const Appraisal = require('../models/Appraisal');
const AppraisalFeedback = require('../models/AppraisalFeedback');
const User = require('../models/User');
const { planCycleLaunch, buildDefaultTemplate } = require('../services/appraisal.helpers');

const TENANT_ROLES = ['tenant_owner', 'tenant_admin', 'tenant_staff'];

/** Seed the tenant's default template on first use so Phase 1 needs no editor. */
async function ensureDefaultTemplate(tenant, userId) {
  const existing = await AppraisalTemplate.findOne({ tenant, isArchived: false });
  if (existing) return existing;
  return AppraisalTemplate.create(buildDefaultTemplate(tenant, userId));
}

exports.listCycles = async (req, res, next) => {
  try {
    const cycles = await AppraisalCycle.find({ tenant: req.tenant._id })
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, data: cycles });
  } catch (err) { next(err); }
};

exports.createCycle = async (req, res, next) => {
  try {
    const { name, nominationDeadline, feedbackDeadline } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, message: 'Cycle name is required' });
    }
    const template = await ensureDefaultTemplate(req.tenant._id, req.user._id);
    const cycle = await AppraisalCycle.create({
      tenant: req.tenant._id,
      name: String(name).trim(),
      template: template._id,
      status: 'draft',
      nominationDeadline,
      feedbackDeadline,
      createdBy: req.user._id,
    });
    res.status(201).json({ success: true, data: cycle });
  } catch (err) { next(err); }
};

exports.getCycle = async (req, res, next) => {
  try {
    const cycle = await AppraisalCycle.findOne({
      _id: req.params.id,
      tenant: req.tenant._id,
    }).lean();
    if (!cycle) return res.status(404).json({ success: false, message: 'Cycle not found' });
    res.json({ success: true, data: cycle });
  } catch (err) { next(err); }
};

/**
 * Fan the cycle out into one Appraisal per in-scope employee, plus the self and
 * manager feedback rows. Idempotent: re-launching skips employees who already
 * have an appraisal, so a partial failure can simply be retried.
 */
exports.launchCycle = async (req, res, next) => {
  try {
    const cycle = await AppraisalCycle.findOne({
      _id: req.params.id,
      tenant: req.tenant._id,
    });
    if (!cycle) return res.status(404).json({ success: false, message: 'Cycle not found' });
    if (cycle.status === 'closed' || cycle.status === 'cancelled') {
      return res.status(400).json({ success: false, message: `Cannot launch a ${cycle.status} cycle` });
    }

    const scope = Array.isArray(req.body.employeeIds) && req.body.employeeIds.length
      ? { _id: { $in: req.body.employeeIds } }
      : {};
    const employees = await User.find({
      tenant: req.tenant._id,
      role: { $in: TENANT_ROLES },
      status: { $ne: 'inactive' },
      ...scope,
    }).select('_id employeeProfile.work.manager').lean();

    const existing = await Appraisal.find({ tenant: req.tenant._id, cycle: cycle._id })
      .select('employee').lean();

    const plan = planCycleLaunch(employees, existing.map((a) => a.employee));

    const created = [];
    for (const { employee, manager } of plan.toCreate) {
      const appraisal = await Appraisal.create({
        tenant: req.tenant._id,
        cycle: cycle._id,
        employee,
        manager,
        state: 'collecting',
        reviewerIds: [employee, manager],
      });
      await AppraisalFeedback.insertMany([
        { tenant: req.tenant._id, appraisal: appraisal._id, cycle: cycle._id, reviewer: employee, kind: 'self' },
        { tenant: req.tenant._id, appraisal: appraisal._id, cycle: cycle._id, reviewer: manager, kind: 'manager' },
      ]);
      created.push(appraisal._id);
    }

    cycle.status = 'collecting';
    cycle.launchedAt = cycle.launchedAt || new Date();
    await cycle.save();

    res.json({
      success: true,
      data: {
        created: created.length,
        alreadyExisted: plan.alreadyExists.length,
        skipped: plan.skipped,
      },
    });
  } catch (err) { next(err); }
};

exports.closeCycle = async (req, res, next) => {
  try {
    const cycle = await AppraisalCycle.findOneAndUpdate(
      { _id: req.params.id, tenant: req.tenant._id },
      { $set: { status: 'closed', closedAt: new Date() } },
      { new: true }
    );
    if (!cycle) return res.status(404).json({ success: false, message: 'Cycle not found' });
    // Feedback still outstanding at close is expired, not silently left pending.
    await AppraisalFeedback.updateMany(
      { tenant: req.tenant._id, cycle: cycle._id, status: 'pending' },
      { $set: { status: 'expired' } }
    );
    res.json({ success: true, data: cycle });
  } catch (err) { next(err); }
};

exports.cycleProgress = async (req, res, next) => {
  try {
    const filter = { tenant: req.tenant._id, cycle: req.params.id };
    const [appraisals, feedbackTotal, feedbackSubmitted] = await Promise.all([
      Appraisal.aggregate([
        { $match: { tenant: req.tenantMongoId, cycle: req.cycleMongoId } },
        { $group: { _id: '$state', count: { $sum: 1 } } },
      ]).catch(() => []),
      AppraisalFeedback.countDocuments(filter),
      AppraisalFeedback.countDocuments({ ...filter, status: 'submitted' }),
    ]);
    const byState = {};
    for (const row of appraisals) byState[row._id] = row.count;
    res.json({
      success: true,
      data: { byState, feedbackTotal, feedbackSubmitted },
    });
  } catch (err) { next(err); }
};
```

> **Note on `cycleProgress`:** the `$match` above needs real `ObjectId`s — an aggregate does **not** cast strings the way `find` does. Replace the aggregate with the cast form below when implementing:
> ```js
> const mongoose = require('mongoose');
> const cycleId = new mongoose.Types.ObjectId(req.params.id);
> const tenantId = new mongoose.Types.ObjectId(req.tenant._id);
> // { $match: { tenant: tenantId, cycle: cycleId } }
> ```

- [ ] **Step 2: Write the routes file**

Create `server/routes/appraisal.routes.js`:

```js
// server/routes/appraisal.routes.js
const express = require('express');
const {
  protect,
  attachTenant,
  requireOwnTenant,
  tenantAdminOrSuperAdmin,
} = require('../middleware/auth.middleware');

const cycles = require('../controllers/appraisalCycle.controller');
const appraisals = require('../controllers/appraisal.controller');
const feedback = require('../controllers/appraisalFeedback.controller');

const cycleRouter = express.Router();
const appraisalRouter = express.Router();
const feedbackRouter = express.Router();

for (const r of [cycleRouter, appraisalRouter, feedbackRouter]) {
  r.use(protect);
  r.use(attachTenant);
  r.use(requireOwnTenant);
}

// ── HR: cycles ──────────────────────────────────────────────────────────────
cycleRouter.use(tenantAdminOrSuperAdmin);
cycleRouter.route('/').get(cycles.listCycles).post(cycles.createCycle);
cycleRouter.route('/:id').get(cycles.getCycle);
cycleRouter.post('/:id/launch', cycles.launchCycle);
cycleRouter.post('/:id/close', cycles.closeCycle);
cycleRouter.get('/:id/progress', cycles.cycleProgress);

// ── Everyone: their own appraisals and their reports' ───────────────────────
// Deliberately NOT gated to admins: tenant_staff must reach their own record.
appraisalRouter.get('/my', appraisals.myAppraisals);
appraisalRouter.get('/my/reviews', appraisals.myReviewRequests);
appraisalRouter.get('/team', appraisals.teamAppraisals);
appraisalRouter.get('/:id', appraisals.getAppraisal);
appraisalRouter.post('/:id/summary', appraisals.saveSummary);
appraisalRouter.post('/:id/release', appraisals.releaseAppraisal);
appraisalRouter.post('/:id/acknowledge', appraisals.acknowledgeAppraisal);

// ── Reviewers: their own feedback row only ──────────────────────────────────
feedbackRouter.get('/:id', feedback.getFeedback);
feedbackRouter.patch('/:id', feedback.saveDraft);
feedbackRouter.post('/:id/submit', feedback.submitFeedback);

module.exports = { cycleRouter, appraisalRouter, feedbackRouter };
```

- [ ] **Step 3: Mount the routers**

In `server/server.js`, immediately after the existing line 243 `app.use('/api/employees', …)`, add:

```js
const appraisalRouters = require('./routes/appraisal.routes');
app.use('/api/appraisal-cycles',   appraisalRouters.cycleRouter);
app.use('/api/appraisals',         appraisalRouters.appraisalRouter);
app.use('/api/appraisal-feedback', appraisalRouters.feedbackRouter);
```

- [ ] **Step 4: Verify the server boots**

```bash
cd server && lsof -ti:5001 | xargs -r kill; npm run dev
```
Expected: the "running" banner appears **and** `lsof -ti:5001` returns a PID. A stale process makes the banner print while `listen()` silently hit `EADDRINUSE` — always check `lsof`, never trust the banner alone. Stop the server once confirmed.

- [ ] **Step 5: Commit**

```bash
git add server/controllers/appraisalCycle.controller.js server/routes/appraisal.routes.js server/server.js
git commit -m "feat(appraisals): cycle controller, routers and mount points"
```

---

### Task 4: Feedback controller (reviewers)

**Files:**
- Create: `server/controllers/appraisalFeedback.controller.js`

**Interfaces:**
- Consumes: `resolveAppraisalAccess` (Task 1); `Appraisal`, `AppraisalFeedback`, `AppraisalTemplate`, `AppraisalCycle` (Task 2).
- Produces: `getFeedback, saveDraft, submitFeedback`.

- [ ] **Step 1: Write the controller**

Create `server/controllers/appraisalFeedback.controller.js`:

```js
// server/controllers/appraisalFeedback.controller.js — reviewer-facing
const AppraisalFeedback = require('../models/AppraisalFeedback');
const Appraisal = require('../models/Appraisal');
const AppraisalCycle = require('../models/AppraisalCycle');
const AppraisalTemplate = require('../models/AppraisalTemplate');

/**
 * Load a feedback row the caller owns. A reviewer may only ever touch their own
 * row — this is an ownership check, not a role check, so it holds for HR too.
 */
async function loadOwnFeedback(req) {
  return AppraisalFeedback.findOne({
    _id: req.params.id,
    tenant: req.tenant._id,
    reviewer: req.user._id,
  });
}

exports.getFeedback = async (req, res, next) => {
  try {
    const fb = await loadOwnFeedback(req);
    if (!fb) return res.status(404).json({ success: false, message: 'Feedback not found' });

    const appraisal = await Appraisal.findById(fb.appraisal)
      .populate('employee', 'firstName lastName email')
      .lean();
    const cycle = await AppraisalCycle.findById(fb.cycle).lean();
    const template = await AppraisalTemplate.findById(cycle?.template).lean();

    // Only the questions this reviewer kind is actually asked.
    const sections = (template?.sections || [])
      .map((s) => ({
        ...s,
        questions: (s.questions || []).filter((q) => (q.askOf || []).includes(fb.kind)),
      }))
      .filter((s) => s.questions.length > 0);

    res.json({
      success: true,
      data: {
        feedback: fb,
        kind: fb.kind,
        subject: appraisal?.employee || null,
        cycleName: cycle?.name || '',
        deadline: cycle?.feedbackDeadline || null,
        sections,
        // Drives the disclosure banner. Phase 1 has no peer feedback, but the
        // contract is in place so Phase 2 does not change the response shape.
        visibility:
          fb.kind === 'peer'
            ? { namedTo: ['manager', 'hr'], anonymousTo: ['employee'] }
            : { namedTo: ['manager', 'hr', 'employee'], anonymousTo: [] },
      },
    });
  } catch (err) { next(err); }
};

exports.saveDraft = async (req, res, next) => {
  try {
    const fb = await loadOwnFeedback(req);
    if (!fb) return res.status(404).json({ success: false, message: 'Feedback not found' });
    if (fb.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'This feedback is already submitted' });
    }
    fb.answers = Array.isArray(req.body.answers) ? req.body.answers : fb.answers;
    await fb.save();
    res.json({ success: true, data: fb });
  } catch (err) { next(err); }
};

exports.submitFeedback = async (req, res, next) => {
  try {
    const fb = await loadOwnFeedback(req);
    if (!fb) return res.status(404).json({ success: false, message: 'Feedback not found' });
    if (fb.status === 'submitted') {
      return res.status(400).json({ success: false, message: 'This feedback is already submitted' });
    }
    if (Array.isArray(req.body.answers)) fb.answers = req.body.answers;
    fb.status = 'submitted';
    fb.submittedAt = new Date();
    await fb.save();
    res.json({ success: true, data: fb });
  } catch (err) { next(err); }
};
```

- [ ] **Step 2: Commit**

```bash
git add server/controllers/appraisalFeedback.controller.js
git commit -m "feat(appraisals): reviewer feedback controller with ownership-scoped access"
```

---

### Task 5: Appraisal controller (subject and manager)

**Files:**
- Create: `server/controllers/appraisal.controller.js`

**Interfaces:**
- Consumes: `resolveAppraisalAccess`, `projectFeedbackForViewer`, `assertTransition` (Task 1); models (Task 2).
- Produces: `myAppraisals, myReviewRequests, teamAppraisals, getAppraisal, saveSummary, releaseAppraisal, acknowledgeAppraisal`.

- [ ] **Step 1: Write the controller**

Create `server/controllers/appraisal.controller.js`:

```js
// server/controllers/appraisal.controller.js — subject + manager facing
const Appraisal = require('../models/Appraisal');
const AppraisalFeedback = require('../models/AppraisalFeedback');
const {
  resolveAppraisalAccess,
  projectFeedbackForViewer,
  assertTransition,
} = require('../services/appraisal.helpers');

exports.myAppraisals = async (req, res, next) => {
  try {
    const rows = await Appraisal.find({ tenant: req.tenant._id, employee: req.user._id })
      .populate('cycle', 'name feedbackDeadline status')
      .sort({ createdAt: -1 })
      .lean();
    // The list is safe to return in full: it carries no feedback, and state is
    // exactly what the employee is entitled to know about their own record.
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

exports.myReviewRequests = async (req, res, next) => {
  try {
    const rows = await AppraisalFeedback.find({
      tenant: req.tenant._id,
      reviewer: req.user._id,
      status: { $in: ['pending', 'submitted'] },
    })
      .populate({
        path: 'appraisal',
        select: 'employee state',
        populate: { path: 'employee', select: 'firstName lastName email' },
      })
      .populate('cycle', 'name feedbackDeadline')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

exports.teamAppraisals = async (req, res, next) => {
  try {
    const rows = await Appraisal.find({ tenant: req.tenant._id, manager: req.user._id })
      .populate('employee', 'firstName lastName email employeeProfile.work.jobTitle')
      .populate('cycle', 'name feedbackDeadline status')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

exports.getAppraisal = async (req, res, next) => {
  try {
    const appraisal = await Appraisal.findOne({ _id: req.params.id, tenant: req.tenant._id })
      .populate('employee', 'firstName lastName email employeeProfile.work.jobTitle')
      .populate('manager', 'firstName lastName email')
      .populate('cycle', 'name feedbackDeadline status template')
      .lean();
    if (!appraisal) return res.status(404).json({ success: false, message: 'Appraisal not found' });

    const access = resolveAppraisalAccess(req.user, appraisal);
    if (!access.canRead) {
      return res.status(403).json({ success: false, message: 'Not permitted' });
    }

    const rawFeedback = await AppraisalFeedback.find({
      appraisal: appraisal._id,
      status: 'submitted',
    })
      .populate('reviewer', 'firstName lastName email')
      .lean();

    // Anonymity is applied here, once, for every caller.
    const feedback = rawFeedback.map((fb) => projectFeedbackForViewer(fb, access));

    res.json({ success: true, data: { appraisal, feedback, access } });
  } catch (err) { next(err); }
};

exports.saveSummary = async (req, res, next) => {
  try {
    const appraisal = await Appraisal.findOne({ _id: req.params.id, tenant: req.tenant._id });
    if (!appraisal) return res.status(404).json({ success: false, message: 'Appraisal not found' });

    const access = resolveAppraisalAccess(req.user, appraisal);
    if (!access.canSummarise) {
      return res.status(403).json({ success: false, message: 'Not permitted' });
    }

    if (appraisal.state === 'collecting') {
      assertTransition('collecting', 'summarising');
      appraisal.state = 'summarising';
    }
    if (typeof req.body.summary === 'string') appraisal.summary = req.body.summary;
    if (req.body.finalRating != null) appraisal.finalRating = Number(req.body.finalRating);
    await appraisal.save();

    res.json({ success: true, data: appraisal });
  } catch (err) { next(err); }
};

exports.releaseAppraisal = async (req, res, next) => {
  try {
    const appraisal = await Appraisal.findOne({ _id: req.params.id, tenant: req.tenant._id });
    if (!appraisal) return res.status(404).json({ success: false, message: 'Appraisal not found' });

    const access = resolveAppraisalAccess(req.user, appraisal);
    if (!access.canRelease) {
      return res.status(403).json({ success: false, message: 'Not permitted' });
    }
    if (!appraisal.summary || !String(appraisal.summary).trim()) {
      return res.status(400).json({ success: false, message: 'Write a summary before releasing' });
    }

    assertTransition(appraisal.state, 'released');
    appraisal.state = 'released';
    appraisal.releasedAt = new Date();
    appraisal.releasedBy = req.user._id;
    await appraisal.save();

    res.json({ success: true, data: appraisal });
  } catch (err) { next(err); }
};

exports.acknowledgeAppraisal = async (req, res, next) => {
  try {
    const appraisal = await Appraisal.findOne({ _id: req.params.id, tenant: req.tenant._id });
    if (!appraisal) return res.status(404).json({ success: false, message: 'Appraisal not found' });

    const access = resolveAppraisalAccess(req.user, appraisal);
    if (!access.canAcknowledge) {
      return res.status(403).json({ success: false, message: 'Not permitted' });
    }

    assertTransition(appraisal.state, 'acknowledged');
    appraisal.state = 'acknowledged';
    appraisal.acknowledgedAt = new Date();
    if (typeof req.body.employeeResponse === 'string') {
      appraisal.employeeResponse = req.body.employeeResponse;
    }
    await appraisal.save();

    res.json({ success: true, data: appraisal });
  } catch (err) { next(err); }
};
```

- [ ] **Step 2: Run the full server suite**

```bash
cd server && node --test '__tests__/*.test.js' 2>&1 | tail -15
```
Expected: still only the 3 known failures.

- [ ] **Step 3: Commit**

```bash
git add server/controllers/appraisal.controller.js
git commit -m "feat(appraisals): subject and manager controller with centralised access checks"
```

---

### Task 6: Admin permissions, middleware and navigation

**Files:**
- Modify: `client/apps/admin/src/types/authorization.ts`
- Modify: `client/apps/admin/src/middleware.ts` (after the `/employees` block ending line 178)
- Modify: `client/apps/admin/src/layouts/hydrogen/tenant-menu-items.tsx`

**Interfaces:**
- Produces: permissions `appraisals:read`, `appraisals:review`, `appraisals:manage`.

- [ ] **Step 1: Add the permissions**

In `client/apps/admin/src/types/authorization.ts`, add `'appraisals:read'` and `'appraisals:review'` to **all** of `tenant_staff`, `tenant_admin`, `tenant_owner`, and the platform admin arrays. Add `'appraisals:manage'` to `tenant_admin`, `tenant_owner` and the platform admin arrays **only**.

Also add the three strings to the `Permission` union type at the top of the file.

- [ ] **Step 2: Add the middleware gate**

In `client/apps/admin/src/middleware.ts`, directly after the `/employees` block that ends at line 178, add:

```ts
    // Appraisal cycle + template administration — HR audience only.
    //
    // Note the deliberate asymmetry with /employees above: bare /appraisals is
    // NOT gated, because tenant_staff must reach their own appraisal and their
    // assigned feedback forms. Only the HR sub-routes are restricted.
    if (
      path.startsWith('/appraisals/cycles') ||
      path.startsWith('/appraisals/templates')
    ) {
      if (
        !role ||
        (!PLATFORM_ROLES.includes(role) &&
          role !== 'tenant_admin' &&
          role !== 'tenant_owner')
      ) {
        return NextResponse.redirect(new URL('/access-denied', req.url));
      }
    }
```

- [ ] **Step 3: Add the navigation entry**

In `client/apps/admin/src/layouts/hydrogen/tenant-menu-items.tsx`, follow the file's existing entry shape to add an "Appraisals" item pointing at `/appraisals`, visible to every tenant role, with child entries "My Appraisals" (`/appraisals`), "My Team" (`/appraisals/team`), and "Cycles" (`/appraisals/cycles`) — the last shown only when the user holds `appraisals:manage`, matching how the file already conditions other admin-only children.

- [ ] **Step 4: Typecheck**

```bash
cd client/apps/admin && node_modules/.bin/tsc --noEmit 2>&1 | grep -c "error TS"
```
Expected: no more than the ~461 baseline. Use `node_modules/.bin/tsc`, never `npx tsc`.

- [ ] **Step 5: Commit**

```bash
git add client/apps/admin/src/types/authorization.ts client/apps/admin/src/middleware.ts client/apps/admin/src/layouts/hydrogen/tenant-menu-items.tsx
git commit -m "feat(appraisals): permissions, route gating and navigation"
```

---

### Task 7: Admin service layer

**Files:**
- Create: `client/apps/admin/src/services/appraisal.service.ts`

**Interfaces:**
- Produces: types `AppraisalState`, `FeedbackKind`, `AppraisalAccess`, `Appraisal`, `AppraisalFeedback`, `AppraisalCycle`, `ReviewerForm`; functions `fetchMyAppraisals`, `fetchMyReviews`, `fetchTeamAppraisals`, `fetchAppraisal`, `fetchReviewerForm`, `saveFeedbackDraft`, `submitFeedback`, `saveSummary`, `releaseAppraisal`, `acknowledgeAppraisal`, `fetchCycles`, `createCycle`, `launchCycle`, `closeCycle`, `fetchCycleProgress`.

- [ ] **Step 1: Write the service**

Create `client/apps/admin/src/services/appraisal.service.ts`, mirroring the conventions in the existing `employee.service.ts` (same `API_URL` constant, same credentials/header handling, same error-shape handling).

```ts
// services/appraisal.service.ts — performance appraisals
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export type AppraisalState =
  | 'draft'
  | 'nominating'
  | 'pending_peer_approval'
  | 'collecting'
  | 'summarising'
  | 'released'
  | 'acknowledged'
  | 'cancelled';

export type FeedbackKind = 'self' | 'manager' | 'peer';
export type FeedbackStatus = 'pending' | 'submitted' | 'expired';
export type AppraisalRelation = 'hr' | 'subject' | 'manager' | 'reviewer' | 'none';

export interface AppraisalAccess {
  relation: AppraisalRelation;
  canRead: boolean;
  canSeeReviewerNames: boolean;
  canSummarise: boolean;
  canRelease: boolean;
  canAcknowledge: boolean;
  canManageCycle: boolean;
}

export interface PersonRef {
  _id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

export interface AppraisalAnswer {
  questionId: string;
  rating?: number;
  text?: string;
}

export interface AppraisalFeedback {
  _id: string;
  kind: FeedbackKind;
  status: FeedbackStatus;
  /** Absent for peer feedback when the viewer may not see identities. */
  reviewer?: PersonRef;
  answers: AppraisalAnswer[];
  submittedAt?: string;
}

export interface Appraisal {
  _id: string;
  state: AppraisalState;
  employee: PersonRef;
  manager: PersonRef;
  cycle: { _id: string; name: string; feedbackDeadline?: string; status: string };
  summary?: string;
  finalRating?: number;
  releasedAt?: string;
  acknowledgedAt?: string;
  employeeResponse?: string;
}

export interface AppraisalQuestion {
  _id: string;
  type: 'rating' | 'text';
  label: string;
  helpText?: string;
  required: boolean;
  scaleMax?: number;
  askOf: FeedbackKind[];
}

export interface AppraisalSection {
  title: string;
  questions: AppraisalQuestion[];
}

export interface ReviewerForm {
  feedback: AppraisalFeedback;
  kind: FeedbackKind;
  subject: PersonRef | null;
  cycleName: string;
  deadline: string | null;
  sections: AppraisalSection[];
  visibility: { namedTo: string[]; anonymousTo: string[] };
}

export interface AppraisalCycle {
  _id: string;
  name: string;
  status: 'draft' | 'collecting' | 'closed' | 'cancelled';
  feedbackDeadline?: string;
  launchedAt?: string;
  closedAt?: string;
}

export interface CycleProgress {
  byState: Record<string, number>;
  feedbackTotal: number;
  feedbackSubmitted: number;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    ...init,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body?.success === false) {
    throw new Error(body?.message || `Request failed (${res.status})`);
  }
  return body.data as T;
}

export const fetchMyAppraisals = () => request<Appraisal[]>('/api/appraisals/my');
export const fetchMyReviews = () => request<AppraisalFeedback[]>('/api/appraisals/my/reviews');
export const fetchTeamAppraisals = () => request<Appraisal[]>('/api/appraisals/team');

export const fetchAppraisal = (id: string) =>
  request<{ appraisal: Appraisal; feedback: AppraisalFeedback[]; access: AppraisalAccess }>(
    `/api/appraisals/${id}`
  );

export const fetchReviewerForm = (id: string) =>
  request<ReviewerForm>(`/api/appraisal-feedback/${id}`);

export const saveFeedbackDraft = (id: string, answers: AppraisalAnswer[]) =>
  request<AppraisalFeedback>(`/api/appraisal-feedback/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ answers }),
  });

export const submitFeedback = (id: string, answers: AppraisalAnswer[]) =>
  request<AppraisalFeedback>(`/api/appraisal-feedback/${id}/submit`, {
    method: 'POST',
    body: JSON.stringify({ answers }),
  });

export const saveSummary = (id: string, summary: string, finalRating?: number) =>
  request<Appraisal>(`/api/appraisals/${id}/summary`, {
    method: 'POST',
    body: JSON.stringify({ summary, finalRating }),
  });

export const releaseAppraisal = (id: string) =>
  request<Appraisal>(`/api/appraisals/${id}/release`, { method: 'POST' });

export const acknowledgeAppraisal = (id: string, employeeResponse?: string) =>
  request<Appraisal>(`/api/appraisals/${id}/acknowledge`, {
    method: 'POST',
    body: JSON.stringify({ employeeResponse }),
  });

export const fetchCycles = () => request<AppraisalCycle[]>('/api/appraisal-cycles');

export const createCycle = (payload: {
  name: string;
  feedbackDeadline?: string;
}) =>
  request<AppraisalCycle>('/api/appraisal-cycles', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const launchCycle = (id: string, employeeIds?: string[]) =>
  request<{ created: number; alreadyExisted: number; skipped: { employee: string; reason: string }[] }>(
    `/api/appraisal-cycles/${id}/launch`,
    { method: 'POST', body: JSON.stringify({ employeeIds }) }
  );

export const closeCycle = (id: string) =>
  request<AppraisalCycle>(`/api/appraisal-cycles/${id}/close`, { method: 'POST' });

export const fetchCycleProgress = (id: string) =>
  request<CycleProgress>(`/api/appraisal-cycles/${id}/progress`);
```

- [ ] **Step 2: Typecheck and commit**

```bash
cd client/apps/admin && node_modules/.bin/tsc --noEmit 2>&1 | grep -c "error TS"
git add client/apps/admin/src/services/appraisal.service.ts
git commit -m "feat(appraisals): admin service layer and types"
```

---

### Task 8: "My appraisals" landing and the reviewer form

**Files:**
- Create: `client/apps/admin/src/app/(hydrogen)/appraisals/page.tsx`
- Create: `client/apps/admin/src/app/(hydrogen)/appraisals/reviews/[feedbackId]/page.tsx`
- Create: `client/apps/admin/src/app/shared/appraisals/my-appraisals.tsx`
- Create: `client/apps/admin/src/app/shared/appraisals/reviewer-form.tsx`
- Create: `client/apps/admin/src/app/shared/appraisals/state-badge.tsx`

**Interfaces:**
- Consumes: everything from Task 7.
- Produces: `<MyAppraisals />`, `<ReviewerForm feedbackId />`, `<AppraisalStateBadge state />`.

This is the page most staff will use, so it carries the whole module for them.

- [ ] **Step 1: Build `state-badge.tsx`**

A small presentational component mapping each `AppraisalState` to a label and colour class, following the badge conventions already used in `app/shared/employees/employee-badge.tsx`. Labels: `draft`→"Not started", `collecting`→"In progress", `summarising`→"With your manager", `released`→"Ready to review", `acknowledged`→"Complete", `cancelled`→"Cancelled".

- [ ] **Step 2: Build `my-appraisals.tsx`**

Client component. On mount calls `fetchMyAppraisals()` and `fetchMyReviews()` in parallel. Renders two sections:

1. **My appraisals** — one card per appraisal: cycle name, `<AppraisalStateBadge />`, deadline, and a primary action derived from state. `released` → "Review and acknowledge" linking to `/appraisals/[id]`; `acknowledged` → "View" linking to the same; anything earlier → no link, since the subject cannot read it yet.
2. **Feedback requested from me** — one row per pending `AppraisalFeedback`, showing the subject's name, cycle, deadline, and a link to `/appraisals/reviews/[feedbackId]`. Submitted rows render disabled with a "Submitted" badge.

Empty state when both lists are empty: "You have no appraisals or feedback requests right now."

- [ ] **Step 3: Build `reviewer-form.tsx`**

Client component taking `feedbackId`. Calls `fetchReviewerForm(id)`.

Renders, in order:
- Heading naming the subject and cycle (for `kind === 'self'`, "Your self-assessment").
- **The disclosure banner**, built from `visibility`: for peer feedback, "Your name is visible to *this person's manager and HR*. It is **not** shown to the person being reviewed." For self/manager, state that it is attributed to everyone. Render it before any input so reviewers calibrate candour before writing, not after.
- Each section, each question: a 1–`scaleMax` radio group for `rating`, a textarea for `text`.
- "Save draft" → `saveFeedbackDraft`; "Submit" → `submitFeedback`, behind a confirm step reading "Once submitted, your answers cannot be changed."

Client-side, block submit while any `required` question is unanswered and show which. When `feedback.status !== 'pending'`, render read-only with a "Submitted" notice and no buttons.

Do **not** use `window.confirm` — use the app's existing modal pattern, since a native dialog blocks browser automation.

- [ ] **Step 4: Wire the two pages**

Both page files are thin server components rendering the shared client component, matching the structure of `app/(hydrogen)/employees/page.tsx`.

- [ ] **Step 5: Typecheck and commit**

```bash
cd client/apps/admin && node_modules/.bin/tsc --noEmit 2>&1 | grep -c "error TS"
git add client/apps/admin/src/app/\(hydrogen\)/appraisals client/apps/admin/src/app/shared/appraisals
git commit -m "feat(appraisals): my-appraisals landing and reviewer form"
```

---

### Task 9: Appraisal detail — subject, manager and HR views

**Files:**
- Create: `client/apps/admin/src/app/(hydrogen)/appraisals/[id]/page.tsx`
- Create: `client/apps/admin/src/app/(hydrogen)/appraisals/team/page.tsx`
- Create: `client/apps/admin/src/app/shared/appraisals/appraisal-detail.tsx`
- Create: `client/apps/admin/src/app/shared/appraisals/appraisal-subject-view.tsx`
- Create: `client/apps/admin/src/app/shared/appraisals/appraisal-manager-view.tsx`
- Create: `client/apps/admin/src/app/shared/appraisals/team-appraisals.tsx`

**Interfaces:**
- Consumes: `fetchAppraisal`, `saveSummary`, `releaseAppraisal`, `acknowledgeAppraisal`, `fetchTeamAppraisals` (Task 7).

- [ ] **Step 1: Build the dispatcher**

`appraisal-detail.tsx` calls `fetchAppraisal(id)` and switches on `access.relation`:

```tsx
if (access.relation === 'subject') return <AppraisalSubjectView … />;
if (access.relation === 'manager' || access.relation === 'hr')
  return <AppraisalManagerView … access={access} />;
return <AccessDenied />;
```

The split is what guarantees the subject's component has **no code path** that can render a reviewer name — not merely a conditional that could be edited wrong later.

- [ ] **Step 2: Build `appraisal-subject-view.tsx`**

Shows the manager's summary, the final rating, and all submitted feedback. Feedback of `kind === 'peer'` renders as "Peer feedback" with **no name field read at all** — the component must not reference `feedback.reviewer` for peer rows even defensively.

When `state === 'released'`, show an optional response textarea and an "Acknowledge" button calling `acknowledgeAppraisal`. When `acknowledged`, show the acknowledgement date and the stored response read-only.

- [ ] **Step 3: Build `appraisal-manager-view.tsx`**

Shows all submitted feedback **with reviewer names**, side by side where the same `questionId` appears for both self and manager, so the comparison the `askOf` design exists to enable is visible.

Below it: summary textarea and final-rating input, "Save" calling `saveSummary`, and "Release to employee" calling `releaseAppraisal` — the latter disabled when `!access.canRelease` or the summary is empty, with the reason shown next to it rather than a silently dead button.

- [ ] **Step 4: Build `team-appraisals.tsx` and its page**

A table of `fetchTeamAppraisals()`: employee name, job title, cycle, state badge, feedback progress, link to detail. Sortable by state so outstanding work surfaces first.

- [ ] **Step 5: Typecheck and commit**

```bash
cd client/apps/admin && node_modules/.bin/tsc --noEmit 2>&1 | grep -c "error TS"
git add client/apps/admin/src/app
git commit -m "feat(appraisals): detail views split by relation, plus team list"
```

---

### Task 10: HR cycle pages

**Files:**
- Create: `client/apps/admin/src/app/(hydrogen)/appraisals/cycles/page.tsx`
- Create: `client/apps/admin/src/app/(hydrogen)/appraisals/cycles/[id]/page.tsx`
- Create: `client/apps/admin/src/app/shared/appraisals/cycles-list.tsx`
- Create: `client/apps/admin/src/app/shared/appraisals/cycle-detail.tsx`

- [ ] **Step 1: Build `cycles-list.tsx`**

Table from `fetchCycles()`: name, status, launched date, deadline, link to detail. A "New cycle" form collecting name and feedback deadline, calling `createCycle`.

- [ ] **Step 2: Build `cycle-detail.tsx`**

Shows the cycle, its `fetchCycleProgress()` counts (appraisals by state, feedback submitted / total), and two actions:

- **Launch** → `launchCycle(id)`. On success, report all three numbers plainly: created, already existed, and **the skipped list with reasons** — an employee skipped for having no manager must be visible to HR, not swallowed. Render skipped rows with the employee id and a readable reason ("No manager assigned", "Employee is their own manager").
- **Close** → `closeCycle(id)`, behind a modal confirm noting that outstanding feedback will be marked expired.

- [ ] **Step 3: Typecheck, run Vitest, commit**

```bash
cd client/apps/admin && node_modules/.bin/tsc --noEmit 2>&1 | grep -c "error TS"
cd client/apps/admin && npx vitest run 2>&1 | tail -5
```
Expected: tsc at or below ~461; Vitest 99 passing.

```bash
git add client/apps/admin/src/app
git commit -m "feat(appraisals): HR cycle list and launch/close detail page"
```

---

### Task 11: End-to-end verification

No new code — this task proves the loop works against a real database and real logins.

- [ ] **Step 1: Start backend and admin**

```bash
cd server && lsof -ti:5001 | xargs -r kill && npm run dev
```
Confirm with `lsof -ti:5001` that a PID exists — the banner alone is not proof. Atlas is reachable from this machine; the link is flaky, so retry the start if it hangs.

- [ ] **Step 2: Walk the full loop in the browser**

As a `tenant_admin`: create a cycle, launch it, confirm the created/skipped counts are reported.
As the **employee**: `/appraisals` shows a self-assessment request; complete and submit it; confirm the appraisal itself is still not readable.
As the **manager**: `/appraisals/team` lists the report; open it, see both submitted assessments with names, write a summary and rating, release.
As the **employee** again: the appraisal is now readable; acknowledge it with a response.

- [ ] **Step 3: Verify the two security properties by hand**

1. As the employee, request `/api/appraisals/<id>` while the appraisal is still `collecting` — expect **403**, not a payload.
2. As an unrelated `tenant_staff` user, request the same appraisal — expect **403**.

- [ ] **Step 4: Final suite run**

```bash
cd server && node --test '__tests__/*.test.js' 2>&1 | tail -15
```
Expected: 3 known failures, no new ones.

- [ ] **Step 5: Commit any fixes found during the walkthrough**

---

## Self-Review

**Spec coverage:** cycles (T3), self/manager assessment (T4), summary + release + acknowledge (T5), access model incl. subject-over-HR precedence (T1), anonymity projection (T1, enforced T5, honoured in UI T9), tenant isolation (T2, T3), compound indexes (T2), default template (T1, seeded T3), permissions and the deliberate `/appraisals` middleware asymmetry (T6), all seven Phase-1 edge cases (skipped-no-manager T1/T3/T10, launch idempotency T1/T3, expiry on close T3, immutable feedback T4, cancel transitions T1). `nextAppraisalDate` is correctly untouched. Phase 2/3 surfaces are schema-only, as specified.

**Deferred deliberately:** peer nomination and approval routes, the template editor, and progress dashboards are Phase 2/3 and appear in no task.

**Type consistency:** `resolveAppraisalAccess` returns the same seven keys in Task 1, consumed unchanged in Tasks 4/5 and typed identically as `AppraisalAccess` in Task 7. `projectFeedbackForViewer(feedback, access)` keeps its argument order across Tasks 1 and 5. `planCycleLaunch` returns `{ toCreate, skipped, alreadyExists }` in Task 1 and is destructured with those exact names in Task 3, surfaced as `{ created, alreadyExisted, skipped }` in the API response and typed to match in Task 7.

**Known sharp edge, flagged in-task:** `cycleProgress` uses `$match`, and aggregates do not cast string ids to `ObjectId` the way `find` does. Task 3 Step 1 carries an explicit note and the corrected code.
