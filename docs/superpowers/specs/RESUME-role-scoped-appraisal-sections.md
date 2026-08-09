# RESUME — role-scoped appraisal sections (Cashier vs Attendant)

> **DONE 2026-08-09 — this file is spent.** All seven build steps are
> implemented and green; the split is APPLIED TO PROD as template **v2
> `6a78b0397ce3937725461f2b`** (a launched cycle pinned v1, so the seed script
> forked rather than editing in place). The three open decisions were settled
> with the user, and the answers are recorded in the memory entry
> `appraisal_role_scoped_sections.md`:
>
> - role blocks are `departments:[Retail] AND roles:[X]`, so Janice and
>   Rejoice keep the Warehouse sheet (a role-only block would have given them
>   40 criteria / 200 points);
> - `appraisalRolesFor` = `defaultRole` when set, else all of `roles[]`, so a
>   two-role employee still gets one role block and ×5 = 100 stays literal;
> - Mark, Nico and Tony were given the Attendant role.
>
> `check-template-coverage.js --template=6a78b0397ce3937725461f2b --verbose`
> reports all 28 employees at exactly 20 questions and 0 empty forms.
> One deviation from §6: `section-departments-utils.ts` was RENAMED to
> `section-scope-utils.ts` and made generic over both dimensions rather than
> gaining a parallel role copy, and `template-presets.test.ts` now calls
> `sectionAppliesTo` instead of hand-mirroring the filter.

Written 2026-08-09. Read the memory entries `appraisal_scored_anchors.md`,
`employee_org_structure_shifts.md` and `appraisal_shuffle_and_reporting_line.md`
first — they hold the invariants this must not break. This file is the task list.

**Do not commit or push unless asked in that turn.** There is already
UNCOMMITTED work on `main` (base `b6f95acc`) from the prior session — anchor
shuffling and reviewer routing, six files, all green. Leave it alone; this
feature is additive to it.

---

## The problem, in one paragraph

HR wants cashiers and attendants to answer DIFFERENT questions in the
`Scored Performance Assessment`. Template sections are scoped by
**department** (`departments[]`, filtered by `filterSections`), but Cashier and
Attendant are **`EmployeeRole`s** — and a previous migration deliberately moved
those values OUT of the department field precisely because they are job roles,
not departments. Roles also CROSS departments in the live data: Janice and
Rejoice hold the Attendant role while sitting in **Warehouse**, so they receive
the Warehouse sections today, not Retail's. There is therefore no data edit that
achieves this; it needs a new scoping dimension.

**Decided with the user (2026-08-09):** add role tagging to sections, mirroring
the department mechanism; and structure the content as a **shared core plus a
role-specific block** rather than two duplicated 20-question sheets.

---

## Live facts (verified against prod, do not re-derive)

Tenant Wyn City `699165839f3308b1baeca8fc`. Template
**`Scored Performance Assessment`** `_id 6a78434262e70bb58fd574b8`, 26 sections,
every question scored, `optionScores` present throughout.

Sections today are one department each: Facilities (5), Digital Marketing &
Sales (4), Warehouse (4), Logistics (4), Management (4), **Retail (5)**.

The **Retail block is what gets replaced** — 20 questions across
`Reliability & Presentation` (3), `Customer Service & Sales` (7),
`Transactions & Cash` (4), `Stock & Store Standards` (2),
`Conduct & Commitment` (4). It currently serves cashiers and attendants alike.

`EmployeeRole`s: Attendant, Driver, Cashier, Office Assistant, Cleaner,
HR Manager. Holders:

- **Attendant (9)** — Alice, Emmanuel Attah, Faith, Friday Zitta, Gift, Janice,
  Jennifer, Rejoice, Salome  *(Janice + Rejoice are in Warehouse)*
- **Cashier (3)** — Cynthia Abarakwe, Esther Imoh, PROGRESS  *(all Retail)*

Roles live at `employeeProfile.planning.roles[]` and
`employeeProfile.planning.defaultRole`, both ObjectId refs to `EmployeeRole`.

---

## Build order

Each step has a test written FIRST that fails for the right reason. Server tests
are **node:test** (`npm test` is broken):
`cd server && node --test '__tests__/*.test.js'`.

### 1. Section schema
`models/AppraisalTemplate.js` — add `roles: [{ type: ObjectId, ref: 'EmployeeRole' }]`
to the section schema, beside `departments`.

### 2. `filterSections` — the core change
`services/appraisal.helpers.js:610`. Signature becomes
`filterSections(sections, { kind, departmentId, roleIds })`.

Matching rule, and the trap worth a comment:

> A section matches when *(departments is empty OR contains departmentId)*
> **AND** *(roles is empty OR intersects roleIds)*. **Empty means EVERYONE** —
> the same inversion `departments` already uses, and the same trap: a
> multi-select with nothing ticked normally means an empty set, here it means
> unrestricted. AND across the two dimensions so a section can read
> "Retail cashiers" rather than "Retail or any cashier anywhere".

`getAskedQuestionIds` derives from this, so required-field validation,
`partitionAnswersByAskedQuestions` and `buildComparison` all inherit it for
free — that is why this is the only filter that changes.

### 3. Snapshot the roles on the Appraisal
`models/Appraisal.js` — `roles: [ObjectId]`, snapshotted at launch for exactly
the reason `department` and `manager` are: an employee who changes role
mid-cycle must not have the form change under them.

`planCycleLaunch` rows become `{ employee, manager, department, roles }`.

### 4. Launch controller
`controllers/appraisalCycle.controller.js` — **add
`employeeProfile.planning.roles` and `employeeProfile.planning.defaultRole` to
the `.select()` at ~line 256.** This is the same omission that silently
collapsed department routing in Phase 5: a missing select does not error, it
just makes every employee look role-less and every role-scoped section vanish.

### 5. Every remaining call site
Pass `roleIds` from `appraisal.roles` wherever `filterSections` is called —
including `subjectAnswers` in `appraisal.controller.js` and
`employeesAskedNothing`, which is what stops an employee silently receiving an
empty form.

### 6. Admin
- `roles?: string[]` on the section type in `services/appraisal.service.ts`
- Editor UI beside the existing department picker — see
  `section-departments-utils.ts` + its tests for the exact pattern to mirror
- ⚠ **`template-presets.test.ts` hand-mirrors the filter logic** and will drift
  silently if not updated with it. It is the one place a client copy exists.

Admin vitest is `environment: 'node'` — **no jsdom, components cannot be
rendered.** Put decisions in a pure module and test that; leave the `.tsx` a
thin renderer. Typecheck with `./node_modules/.bin/tsc --noEmit` —
**`npx tsc` installs a decoy `tsc@2.0.4`** that prints "This is not the tsc
command you are looking for" and exits 0.

### 7. Content — the seed script
Idempotent, refuses a second copy, in the style of
`scripts/create-cleaner-scored-template.js`. Replaces the Retail block with:

- a **shared core** tagged to neither role (so it reaches everyone in Retail),
- a **Cashier-only** block,
- an **Attendant-only** block.

Each role must still total **20 criteria × 5 = 100**, so the shared core counts
toward both. Scores are 5/4/3/2/1 and **must be DISTINCT within a question** —
the score is the identity of the chosen anchor (`scoredOptionLabel` reverse-looks
it up). Anchors are authored best-first; the reviewer's form now shuffles them
per rater, so do not try to encode rank by position.

Grade bands HR uses: 90–100 A, 80–89 B, 70–79 C, 60–69 D, below 60 E.
`scoreAppraisal` already produces the /100; bands are presentation only and are
NOT currently rendered anywhere — treat as out of scope unless asked.

#### Shared core (8 criteria — both roles)
Punctuality · Attendance & Reliability · Personal Appearance & Professionalism ·
Customer Service · Teamwork · Following Company Procedures ·
Integrity & Trustworthiness · Overall Attitude & Commitment

#### Cashier-only (12 criteria)
Transaction Accuracy · Cash Handling Accuracy · Cash Reconciliation ·
POS System Competence · Card/Transfer Verification · Speed & Efficiency ·
Receipt & Documentation Accuracy · Refund/Void/Discount Compliance ·
Fraud Awareness & Prevention · Accountability · Handover Procedures ·
Communication Skills

#### Attendant-only (12 criteria)
Customer Greeting & Approach · Product Knowledge · Product Recommendation ·
Upselling & Cross-selling · Sales Performance · Customer Complaint Handling ·
Accuracy · Stock Handling · Shelf Arrangement & Display ·
Cleanliness of Work Area · Initiative · Responsibility & Accountability

Full criterion wording is in the conversation that produced this file; the
one-liners above are the labels, and each needs five behavioural anchors written
best-first. Rating meaning: 5 Excellent, 4 Very Good, 3 Good, 2 Fair, 1 Poor.

---

## Open question — decide before writing the seed

**An employee holding TWO tagged roles** would match both blocks and receive ~28
questions, breaking the clean ×5 = 100 total. Options: scope on `defaultRole`
only, or union the roles and accept a variable denominator (`scoreAppraisal`
handles a variable `possible` correctly — it sums earned over summed possible —
so the score stays valid, but "out of 100" stops being literally true).

**Nobody in Wyn City holds two roles today**, so this is decidable rather than
urgent. Decide it explicitly; do not discover it in production.

---

## Verify

```bash
cd server && node --test '__tests__/*.test.js'   # baseline 1752/1755
cd client/apps/admin
npx vitest run src/app/shared/appraisals/        # baseline 286/286
./node_modules/.bin/tsc --noEmit                 # baseline 461 src errors
node scripts/check-template-coverage.js --template=6a78434262e70bb58fd574b8
```

The three server failures are pre-existing and unrelated (1 pricelist
tenant-scope, 2 SO-number). **`check-template-coverage.js` is the real
acceptance test here** — it runs the actual launch path and reports who would be
asked NOTHING. After the change it must show every cashier and every attendant
covered, including Janice and Rejoice in Warehouse.

To prove a changed admin page still compiles and SSRs without jsdom: add a temp
route OUTSIDE `src/middleware.ts`'s path matcher (e.g. `src/app/smoke-x/page.tsx`,
`'use client'` if it takes handlers), `npx next dev -p <free port>`, curl it,
delete the route.

## Do not

- Do not make Cashier/Attendant into departments — it reverses a deliberate
  migration and breaks shift rostering, which staffs shifts by `EmployeeRole`.
- Do not change how a scored answer is STORED (a bare `rating`), or the
  distinct-scores rule that makes the reverse lookup unambiguous.
- Do not re-route existing appraisals; `Appraisal.manager`/`department`/`roles`
  are launch snapshots.
- Do not touch the peer-anonymity path.
