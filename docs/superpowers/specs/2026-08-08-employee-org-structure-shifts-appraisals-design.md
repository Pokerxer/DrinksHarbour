# Employee Org Structure, Shift Management & Department-Scoped Appraisals

**Date:** 2026-08-08
**Status:** Approved design
**Scope:** `server/` + `client/apps/admin/src/app/(hydrogen)/employees` and its `app/shared/employees` components

---

## 1. Problem

`User.employeeProfile.work.{department, jobPosition, jobTitle}` are free-text strings. Nothing
can be listed, counted, reported on, or referenced. `employeeProfile.planning.roles` is an unused
`[String]`, and `employeeProfile.approvers.{timeOff, expense, hrResponsible}` are strings naming
people who cannot be resolved to accounts.

Consequences:

- No way to answer "who works in Sales?" without a regex over free text with inconsistent casing.
- No way to staff work by capability, because a "role" is not a thing that exists.
- Appraisal questions are identical for every employee regardless of what they do.
- Every `tenant_admin` sees every appraisal in the tenant; there is no departmental boundary.
- There is no shift, roster, attendance, time-off or swap concept anywhere in the codebase.

## 2. Goals

1. Promote department, job position and (HR/planning) role into real tenant-scoped entities with
   full CRUD, and re-point employees at them by id.
2. Add workforce planning: shift templates, a roster of shift instances, attendance via a PIN
   kiosk, time-off requests, and shift swap requests — all with approval routing.
3. Make appraisals department-aware: department-specific questions, the department's admin as the
   reviewer, admin appraisals reviewed by the owner, owner sees everything, and a new
   employee-authored standing feedback ("who is doing well, who is not") readable only by the owner.

## 3. Non-goals

- The access-control role enum (`tenant_owner` / `tenant_admin` / `tenant_staff`) is **not**
  becoming CRUD-able. It stays exactly as it is. The new `EmployeeRole` entity is an HR/planning
  concept used to staff shifts, and is orthogonal.
- No payroll, no leave-balance accrual, no cost/labour budgeting beyond `EmployeeRole.hourlyCost`.
- No changes to the POS permission model.

## 4. Decisions taken

| Question | Decision |
|---|---|
| What "role" means | New HR/planning `EmployeeRole` entity; access enum untouched |
| Job title vs position | `JobPosition` is an entity owned by a Department; `jobTitle` stays free text, defaulted from the position, overridable (Odoo model) |
| Shift scope | Full: templates, roster, attendance, time-off, swaps |
| Migration | Ids only. Migration script runs, then the string fields are dropped |
| Where screens live | All under `/employees/*` — already covered by the middleware allow-list |
| Open shifts | Yes. A shift carries a required role and a **nullable** employee |
| Clock-in | Dedicated PIN kiosk page |
| Approvals | `approvers.timeOff` → `work.manager` → any tenant_admin |
| Dept-specific questions | `departments[]` tag on template **sections** |
| Reviewer UX | Reviewer sees the employee's answer, gives their own score, **and** a per-question comment |
| Appraisal visibility | Admin sees only departments they manage; owner sees all |
| Standing feedback | Owner-only, attributed |

---

## 5. Phase 1 — Org structure

### 5.1 New models

All tenant-scoped. None hard-delete while referenced; they deactivate.

**`models/Department.js`**

```
tenant     ObjectId → Tenant, required, indexed
name       String, required, trim
code       String, trim                      // short code for badges/rosters
parent     ObjectId → Department             // nested departments
manager    ObjectId → User                   // the "selected admin"; drives appraisal review
color      String                            // hex, for roster + badges
note       String
isActive   Boolean, default true
```

Unique index `{tenant, name}`. `parent` must not form a cycle (same validation shape as the
existing employee-manager cycle check).

**`models/JobPosition.js`**

```
tenant            ObjectId → Tenant, required, indexed
name              String, required, trim
department        ObjectId → Department
employmentType    enum full_time|part_time|contract|intern|temporary
expectedHeadcount Number, min 0, default 0
description       String
requirements      String
isActive          Boolean, default true
```

Unique index `{tenant, department, name}`.

**`models/EmployeeRole.js`**

```
tenant     ObjectId → Tenant, required, indexed
name       String, required, trim
color      String
hourlyCost Number, min 0, default 0
isActive   Boolean, default true
```

Unique index `{tenant, name}`.

### 5.2 `User.employeeProfile` changes

| Path | Was | Becomes |
|---|---|---|
| `work.department` | String | `ObjectId → Department` |
| `work.jobPosition` | String | `ObjectId → JobPosition` |
| `work.jobTitle` | String | String (unchanged; defaults from position name, overridable) |
| `planning.roles` | `[String]` | `[ObjectId → EmployeeRole]` |
| `planning.defaultRole` | String | `ObjectId → EmployeeRole` |
| `approvers.timeOff` | String | `ObjectId → User` |
| `approvers.expense` | String | `ObjectId → User` |
| `approvers.hrResponsible` | String | `ObjectId → User` |

`buildEmployeeProfile` in `services/employee.helpers.js` must be updated in lockstep — it currently
coerces all of these through `str()`, which would cast an ObjectId to a string and silently break
every ref.

### 5.3 Migration

`server/scripts/migrate-employee-org-structure.js`, **dry-run by default**, `--apply` to write
(mirrors `scripts/repair-orphan-warehouse-stock.js`).

Per tenant:

1. Collect distinct non-empty trimmed values of `work.department`, `work.jobPosition`,
   `planning.roles[]`, `planning.defaultRole`.
2. Create `Department` / `JobPosition` / `EmployeeRole` records, matching case-insensitively so
   "Sales" and "sales" converge on one record.
3. **Before overwriting**, preserve the old position string into `work.jobTitle` when `jobTitle` is
   empty — otherwise ids-only loses information the user still wants displayed.
4. Re-point every employee.
5. Resolve `approvers.*` strings to users by exact name/email match; report any that do not resolve
   rather than guessing.
6. Print a summary: created counts, re-pointed counts, and an explicit list of unmatched values.

The string field definitions are removed from the schema only after this script has run.

### 5.4 API

`server/routes/orgStructure.routes.js` exports three routers (the multi-router pattern from
`appraisal.routes.js`), mounted in `server.js` at `/api/departments`, `/api/job-positions`,
`/api/employee-roles`. Every router: `protect → attachTenant → requireOwnTenant →
tenantAdminOrSuperAdmin`.

Each entity gets `GET /` (list), `POST /`, `GET /:id`, `PATCH /:id`, `DELETE /:id`.

- List supports `?search=&isActive=&department=`.
- List returns `employeeCount` per row from **one aggregate over User**, never one query per row.
- **Delete guards** return `409` with the blocking count and a message directing the caller to
  deactivate instead:
  - Department with employees, child departments, or job positions
  - JobPosition with employees
  - EmployeeRole referenced by an employee's `planning.roles`/`defaultRole`, or by any future shift
- The employee list/get responses populate department / position / role **names** so the admin UI
  never N+1s.

All validation and guard logic lives in **`server/services/orgStructure.helpers.js`** as pure
functions, unit-tested with `node --test`. The controllers do I/O and nothing else.

### 5.5 Admin UI

Under `/employees`, which `/employees/:path*` in `src/middleware.ts` already gates — no new matcher
entry needed.

- `/employees/departments`, `/employees/job-positions`, `/employees/roles` — three thin pages over
  one shared `app/shared/employees/org-config-table.tsx`: searchable table, slide-over create/edit
  form, and delete-guard messaging.
- `services/orgStructure.service.ts` in the admin, following `employee.service.ts`.
- `employee-profile-form.tsx`: the three free-text work inputs become selects fed by the new
  endpoints, with inline "create new". **That file is 1,542 lines**; its Work/HR section is
  extracted into its own component as part of this change, since it is being edited anyway.
- `employees-nav-header.tsx` gains Departments / Job Positions / Roles under **Configuration**.

---

## 6. Phase 2 — Shift templates & roster

**`models/ShiftTemplate.js`**: `tenant, name, role → EmployeeRole, department → Department,
startTime "HH:MM", endTime "HH:MM", breakMinutes, daysOfWeek [0..6], color, isActive`.
An `endTime` <= `startTime` means the shift crosses midnight; this is derived, not stored.

**`models/Shift.js`** (a roster instance):

```
tenant, template → ShiftTemplate (optional)
employee   ObjectId → User, NULLABLE          // null = open shift
role       ObjectId → EmployeeRole, required  // what the shift needs
department ObjectId → Department
start, end Date
breakMinutes Number
status     enum draft|published|cancelled
publishedAt, note, createdBy
```

Indexes `{tenant, start}` and `{tenant, employee, start}`.

Rules, pure, in `server/services/shift.helpers.js`:

- **No overlap**: an employee may not hold two shifts whose `[start, end)` intersect. Rejected with
  the conflicting shift named.
- **Role capability**: assigning an employee whose `planning.roles` lacks the shift's role is
  rejected unless the request passes `force: true`.
- **Time-off block** (once Phase 4 lands): approved time-off over those dates blocks assignment.
- `POST /api/shifts/generate {from, to, templateIds}` creates a week of **draft** shifts from
  templates. Publishing is a separate, explicit action — a draft roster is never visible to staff.

UI: `/employees/shifts` — week grid, employees as rows, days as columns, an **Unassigned / open
shifts** lane pinned above the employee rows, a template palette, and Generate + Publish actions.
`/employees/shifts/templates` for template CRUD.

## 7. Phase 3 — Attendance & kiosk

**`models/Attendance.js`**: `tenant, employee, shift (optional), clockIn, clockOut, source
enum kiosk|admin, minutesWorked (derived on close), status enum open|closed, editedBy, note`.

`/employees/attendance/kiosk` is a full-screen PIN pad. The device is signed in as a manager, so
the existing `/employees/:path*` middleware already protects the page.
`POST /api/attendance/clock {pin}` resolves the employee **within `req.tenant`** using the same
bcrypt-compare-over-candidates pattern as `controllers/pos.controller.js:785`, toggles in/out, and
auto-matches the employee's shift for that day. It is rate-limited and never discloses whether a
given PIN existed.

`/employees/attendance` gives managers the daily log plus manual entry and correction (every
correction records `editedBy`).

## 8. Phase 4 — Time off & swaps

**`models/TimeOffRequest.js`**: `tenant, employee, type enum annual|sick|unpaid|parental|other,
startDate, endDate, halfDay, reason, status enum pending|approved|rejected|cancelled, approver,
decidedAt, decisionNote`.

**`models/ShiftSwapRequest.js`**: `tenant, shift, requestedBy, targetEmployee (optional — null means
open to anyone holding the role), status enum pending|accepted|rejected|cancelled|approved,
approver, note`.

`resolveApprover(employee)` — one definition in `server/services/timeOff.helpers.js`, used by both
time-off and swaps: `approvers.timeOff` → `work.manager` → any `tenant_admin`.

Approved time-off feeds back into Phase 2's assignment guard.

UI: `/employees/time-off` (request list + approve/reject queue) and `/employees/swaps`.

---

## 9. Phase 5 — Department-scoped appraisals

Depends on Phase 1: `Department` must exist.

### 9.1 Department-specific questions

`sectionSchema` in `models/AppraisalTemplate.js` gains `departments: [ObjectId → Department]`.
**Empty means asked of everyone.**

`filterSectionsForKind(sections, kind)` in `services/appraisal.helpers.js` becomes
`filterSections(sections, {kind, departmentId})`. A section is kept when it is company-wide **or**
matches the employee's department, **and** it still has at least one question for that reviewer kind
after `askOf` filtering.

Because `getAskedQuestionIds` derives from the filtered sections, required-field validation,
`partitionAnswersByAskedQuestions` and `buildComparison` all follow with no further change.

`Appraisal` gains **`department`, snapshotted at launch** — identical reasoning to the existing
`manager` snapshot: an employee transferred mid-cycle must not have the shape of a form they are
already filling change underneath them.

The template editor and the AI generator (`template-ai-modal.tsx`) get a per-section department
multi-select. The AI sanitizer **snaps an unrecognised department id to empty** (company-wide)
rather than dropping the section — losing a whole section of questions to a bad id is worse than
over-asking.

### 9.2 Reviewer routing

`Department.manager` is the "selected admin" for the department.

New pure helper `resolveAppraisalReviewer(employee, {departmentManagerOf, ownerId})` resolves in
order:

1. Employee is `tenant_owner` → **no appraisal**; the row is reported as skipped with a reason
   (there is nobody above them), never silently omitted.
2. Employee is `tenant_admin` → reviewer is the **tenant owner**.
3. Otherwise → the manager of the employee's department.
4. If that resolves to the employee themselves (a department admin inside their own department) →
   the owner.
5. If department or department manager is unset → `work.manager`, then the owner.

The result is written into the **existing `Appraisal.manager` field**. `kind: 'manager'` feedback
rows, the `{tenant, manager, state}` index, and every downstream query keep working unchanged.
**No new reviewer kind is introduced.**

### 9.3 Per-question review

`answerSchema` in `models/AppraisalFeedback.js` gains `comment: String, maxlength 5000` — the
reviewer's note on that specific answer.

`GET /api/appraisals/:id/subject-answers` returns the employee's self-answers to **the assigned
reviewer only** (and the owner), and **only once the self feedback is `submitted`**. While self is
pending, the reviewer's form shows "not yet submitted" rather than rendering an empty comparison
that reads as though the employee answered nothing.

`normaliseAnswers` **strips `comment` from `self` and `peer` answers**. Only `kind: 'manager'` may
carry one — otherwise an employee could annotate their own form and it would render downstream as
reviewer commentary.

`projectFeedbackForViewer` exposes comments to the subject only after release, the same rule that
already governs the rest of manager feedback. `buildComparison` carries the comment on the manager
side.

### 9.4 Visibility

`resolveAppraisalAccess(user, appraisal)` gains:

- `tenant_owner` and `super_admin` → full HR access, always, to everything in the tenant.
- `tenant_admin` → HR access **only for appraisals whose `department` they manage**. Otherwise they
  fall through to the ordinary reviewer / subject / peer resolution like anyone else.

One helper `scopeDepartmentsFor(user)` returns `null` (unrestricted) for an owner or super_admin,
otherwise the array of department ids that user manages. It is applied by `cycleRoster`, the cycle
report, `byState` and the appraisal list — a single definition so that no endpoint can forget it.

⚠️ **This removes visibility that today's `tenant_admin` accounts have.** This module has already
shipped a fix for an HR-only tab leak, so Phase 5 must add `node --test` cases asserting that a
non-owning admin is filtered or 403'd on the roster, the cycle report, and appraisal detail.

### 9.5 Standing feedback

**`models/PeerStandingFeedback.js`**

```
tenant      ObjectId → Tenant, required, indexed
cycle       ObjectId → AppraisalCycle, required, indexed
appraisal   ObjectId → Appraisal            // the author's own appraisal
author      ObjectId → User, required
department  ObjectId → Department           // snapshot at authoring time
entries     [{ subject → User, standing enum doing_well|needs_support, note maxlength 1000 }]
submittedAt Date
```

Unique index `{author, cycle}`.

The employee fills this as an optional step on their own self-form. Candidates are active employees
in the author's department, excluding themselves; `entries.length` is capped at the department size.

`GET /api/appraisal-feedback/standing?cycle=` is gated to **`tenant_owner` + `super_admin` at the
route AND re-checked inside the controller** — belt and braces, because "HR-only by mount point" is
exactly the pattern that leaked in this module before. It is never included in any roster, report or
comparison payload. Feedback is **attributed** to its author.

---

## 10. Testing

- `node --test '__tests__/*.test.js'` for every pure helper: org-structure validation and delete
  guards, migration value mapping, shift overlap, role capability, approver resolution, appraisal
  reviewer resolution, department section filtering, comment stripping, and the visibility scope
  helper. Baseline is 1423/1426 with 3 known pre-existing failures.
- Admin: Vitest, `environment: 'node'`. **No jsdom, so no component rendering** — pure utilities
  only (roster week construction, conflict labels, form option mapping).
- Typecheck with `./node_modules/.bin/tsc --noEmit`, never `npx tsc` (which installs a decoy
  package that exits 0 without checking anything). Admin src baseline is 461 errors.

## 11. Build order

1. **Phase 1** — org structure entities, CRUD, migration, employee re-point, three config pages,
   profile-form selects.
2. **Phase 2** — shift templates, roster, publish.
3. **Phase 3** — attendance, kiosk.
4. **Phase 4** — time-off, swaps, approval routing.
5. **Phase 5** — department-scoped appraisals.

Each phase gets its own implementation plan.
