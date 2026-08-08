# RESUME — employee module, Phase 5 (department-scoped appraisals)

Paste the section below into a fresh session.

---

## Continue the employee module — Phase 5 (department-scoped appraisals)

Repo: `/Users/mac/Documents/drinksharbour` (branch `feat/free-delivery-first-purchase`). Everything below is **uncommitted**, including all four earlier phases. Do not commit or push unless I ask in that turn.

### Read first

- Design spec: `docs/superpowers/specs/2026-08-08-employee-org-structure-shifts-appraisals-design.md` — **section 9** is Phase 5, and section 10 is the testing end. This is the LAST phase. The spec is approved; do not re-brainstorm it.
- Memory entries `employee_org_structure_shifts.md`, `appraisal_cycle_detail_overhaul.md`, `appraisal_question_type_contract.md`, `appraisal_module_phase1.md`.

### Already done — do NOT rebuild

**Phases 1–4 are complete and verified.** Do not re-derive any of this:

- **Phase 1 (org structure)** — `models/{Department,JobPosition,EmployeeRole}.js`, `services/orgStructure.helpers.js`, `controllers/orgStructure.controller.js`, `routes/orgStructure.routes.js` at `/api/departments`, `/api/job-positions`, `/api/employee-roles`. Admin: `services/orgStructure.service.ts`, `app/shared/employees/{org-config-page.tsx,org-config-utils.ts,employee-org-fields.tsx}`, pages `/employees/{departments,job-positions,roles}`.
- **Phase 2 (shift templates + roster)** — `models/{ShiftTemplate,Shift}.js`, `services/shift.helpers.js`, `controllers/shift.controller.js`, `routes/shift.routes.js`.
- **Phase 3 (attendance & kiosk)** — `models/Attendance.js`, `services/attendance.helpers.js`, `controllers/attendance.controller.js`, `routes/attendance.routes.js`.
- **Phase 4 (time off & swaps)** — `services/timeOff.helpers.js`, `models/{TimeOffRequest,ShiftSwapRequest}.js`, `controllers/timeOff.controller.js`, `routes/timeOff.routes.js` at `/api/time-off` + `/api/shift-swaps`. Admin: `services/timeOff.service.ts`, `app/shared/employees/{time-off-utils.ts,time-off-page.tsx,shift-swaps-page.tsx}`, pages `/employees/time-off` and `/employees/swaps`.

**The org-structure migration is APPLIED to production** (2026-08-08). Wyn City has 6 departments, 4 EmployeeRoles, 1 JobPosition; zero free-text values remain in any ObjectId ref path. **Do not re-run `scripts/migrate-employee-org-structure.js` and do not re-investigate the department data.**

Decisions from earlier phases you inherit rather than re-make:

- **`Department.manager` already exists** and is the field §9.2 means by "the selected admin for the department". `employeeProfile.work.department` is an ObjectId ref to Department, not free text.
- **All pure rules live in `services/*.helpers.js`, DB-free and unit-tested directly.** Never reimplement one in a controller. Phase 5's rules belong in the existing `services/appraisal.helpers.js`.
- **Never read the server's local TZ.** `tenantOffsetMinutes(tenant)` / `tenantToday(offset, now)` in `services/shift.helpers.js` are the one definition of the tenant clock.
- Derived state is computed server-side, never accepted from a request.

### The shape of what you are changing

`services/appraisal.helpers.js` is ~1000 lines and already exports (among others) `resolveAppraisalAccess`, `projectFeedbackForViewer`, `filterSectionsForKind`, `getAskedQuestionIds`, `partitionAnswersByAskedQuestions`, `normaliseAnswers`, `findUnansweredRequired`, `buildComparison`, `planCycleLaunch`. Controllers: `appraisal.controller.js` (997), `appraisalCycle.controller.js` (692, holds `cycleRoster` + the cycle report + `byState`), `appraisalFeedback.controller.js` (270), `appraisalTemplate.controller.js` (549). Routes: `routes/appraisal.routes.js` (4 routers).

There are **27 `appraisal*` test files** in `server/__tests__/`. Several of them will need updating, not just adding to.

### Your task: build Phase 5

#### 1. Department-specific questions (§9.1)

- `sectionSchema` in `models/AppraisalTemplate.js` gains `departments: [ObjectId → Department]`. **Empty means asked of everyone.**
- **`filterSectionsForKind(sections, kind)` becomes `filterSections(sections, {kind, departmentId})`.** A section is kept when it is company-wide **or** matches the employee's department, **and** it still has at least one question for that reviewer kind after `askOf` filtering. Because `getAskedQuestionIds` derives from the filtered sections, required-field validation, `partitionAnswersByAskedQuestions` and `buildComparison` all follow with no further change.
  - Known callers to re-point: `controllers/appraisalFeedback.controller.js:93`, and the doc references in `services/appraisalAi.service.js`. **`client/apps/admin/src/app/shared/appraisals/template-presets.test.ts` hand-mirrors the old function** — update the mirror or the test asserts a contract that no longer exists.
- **`Appraisal` gains `department`, snapshotted at launch** — identical reasoning to the existing `manager` snapshot (see the comment on that field in `models/Appraisal.js`): an employee transferred mid-cycle must not have the shape of a form they are already filling change underneath them. `planCycleLaunch` is where the snapshot is taken.
- The template editor and the AI generator (`client/apps/admin/src/app/shared/appraisals/template-ai-modal.tsx`) get a per-section department multi-select. **The AI sanitizer snaps an unrecognised department id to empty (company-wide) rather than dropping the section** — losing a whole section of questions to a bad id is worse than over-asking. `__tests__/appraisalAiSanitize.test.js` is where that belongs.

#### 2. Reviewer routing (§9.2)

New pure helper `resolveAppraisalReviewer(employee, {departmentManagerOf, ownerId})`, resolving in order:

1. Employee is `tenant_owner` → **no appraisal**; the row is **reported as skipped with a reason**, never silently omitted. `planCycleLaunch` already has a `skipped[]` vocabulary (`no_manager`, `self_manager`) — add to it, do not invent a second channel.
2. Employee is `tenant_admin` → reviewer is the **tenant owner**.
3. Otherwise → the manager of the employee's department.
4. If that resolves to the employee themselves (a department admin inside their own department) → the owner.
5. If department or department manager is unset → `work.manager`, then the owner.

The result is written into the **existing `Appraisal.manager` field**. `kind: 'manager'` feedback rows, the `{tenant, manager, state}` index, and every downstream query keep working unchanged. **No new reviewer kind is introduced.**

#### 3. Per-question review (§9.3)

- `answerSchema` in `models/AppraisalFeedback.js` gains `comment: String, maxlength 5000` — the reviewer's note on that specific answer.
- `GET /api/appraisals/:id/subject-answers` returns the employee's self-answers **to the assigned reviewer only (and the owner)**, and **only once the self feedback is `submitted`**. While self is pending, the reviewer's form shows "not yet submitted" rather than an empty comparison that reads as though the employee answered nothing.
- **`normaliseAnswers` strips `comment` from `self` and `peer` answers.** Only `kind: 'manager'` may carry one — otherwise an employee could annotate their own form and it would render downstream as reviewer commentary. This is the same class of bug as the `notObserved` strip already in `appraisalFeedback.controller.js`.
- `projectFeedbackForViewer` exposes comments to the subject **only after release**, the same rule that already governs the rest of manager feedback. `buildComparison` carries the comment on the manager side.

#### 4. Visibility (§9.4) — ⚠️ this REMOVES access today's admins have

`resolveAppraisalAccess(user, appraisal)` gains:

- `tenant_owner` and `super_admin` → full HR access, always, to everything in the tenant.
- `tenant_admin` → HR access **only for appraisals whose `department` they manage**. Otherwise they fall through to the ordinary reviewer / subject / peer resolution like anyone else.

**One helper `scopeDepartmentsFor(user)`** returns `null` (unrestricted) for an owner or super_admin, otherwise the array of department ids that user manages. It is applied by `cycleRoster` (`appraisalCycle.controller.js:422`), the cycle report, `byState`, and the appraisal list — **a single definition so no endpoint can forget it**.

This module has already shipped a fix for an HR-only tab leak, so **Phase 5 must add `node --test` cases asserting that a non-owning admin is filtered or 403'd on the roster, the cycle report, and appraisal detail.** `__tests__/appraisalLifecycleLeaks.test.js` is the existing home for that kind of assertion.

#### 5. Standing feedback (§9.5)

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

The employee fills this as an **optional step on their own self-form**. Candidates are active employees in the author's department, excluding themselves; `entries.length` is capped at the department size.

`GET /api/appraisal-feedback/standing?cycle=` is gated to **`tenant_owner` + `super_admin` at the route AND re-checked inside the controller** — belt and braces, because "HR-only by mount point" is exactly the pattern that leaked in this module before. It is **never** included in any roster, report or comparison payload. Feedback is **attributed** to its author.

### Verification (must all hold before you report done)

- `cd server && node --test '__tests__/*.test.js'` → **1659/1662 expected** before you add anything. Exactly **3** failures are pre-existing and acceptable: 1 pricelist tenant-scope, 2 SO-number. Any other failure is yours. `routeGuardCoverage`, `routeDeclarationUniqueness` and `cjsRequireable` auto-scan the routes directory, and **`routeGuardCoverage` flags any mutating route without an auth guard**.
- `cd client/apps/admin && ./node_modules/.bin/tsc --noEmit` → **461 src errors, the baseline.** Never use `npx tsc` — it installs a decoy `tsc@2.0.4` that prints "This is not the tsc command you are looking for" and exits 0 without checking anything.
- `npx vitest run src/app/shared/appraisals/ src/app/shared/employees/` → green. `src/app/shared/employees/` is **96 tests** before yours.
- Verify any new `react-icons/pi` names actually exist (`node -e "console.log(typeof require('react-icons/pi').PiX)"`) — a bad name is a runtime crash TypeScript will not catch.
- Watch for `TS2802` when spreading a `Map`/`Set` iterator: this tsconfig targets ES5 iteration, so use `Array.from(...)`, not `[...x.values()]`.
- The admin Vitest env is `node` — **no jsdom, no testing-library, so components cannot be rendered.** Extract pure logic and test that.
- SSR-smoke any new or materially changed page: the admin middleware uses an explicit PATH-LIST matcher, so a temp route OUTSIDE it (e.g. `src/app/smoke-x/page.tsx`) renders a gated component with no login — the only browser-free way to prove a page compiles and SSRs. `npx next dev -p <free port>` from `client/apps/admin`, curl it, **then delete the temp route** (`rm -rf` with an ABSOLUTE path; the shell cwd drifts between calls).

### Hazards specific to this phase

- **Changing `filterSectionsForKind`'s signature touches a tested contract in four places.** Grep before you rename, including the client-side mirror in `template-presets.test.ts`.
- **`resolveAppraisalAccess` has a documented precedence order (subject → hr → manager → reviewer)** with a long comment explaining why `subject` wins and why `hr` precedes `manager`. Inserting the department check must not reorder those; read the comment at `services/appraisal.helpers.js:79-160` first.
- **A peer never sees another peer, and the subject never sees raw peer feedback at any state.** That is deliberate and load-bearing — see the comment block at `appraisal.helpers.js:106-118`. Nothing in Phase 5 may widen it.
- Per `appraisal_question_type_contract.md`: `yes_no` stores 1/0, so **never gate averaging on "is it a number"**, and `!answer.rating` treats a real "no" as unanswered.
- Per `appraisal_cycle_detail_overhaul.md`: there is **ONE `deadlineTone`, in `my-appraisals-utils.ts`** — don't add a third copy. And `appraisal-answer-views.tsx` reads `feedback.reviewer`, so it is **HR-only BY MOUNT POINT** — never import it from `appraisal-subject-view.tsx`.

### After Phase 5

Nothing in this five-phase module has been committed. When Phase 5 lands, the whole thing is ready to be reviewed as one branch — **ask me before committing or pushing any of it.**

### Cost

Phase 4 cost ~$50 in one session; Phase 3 ~$40; Phase 2 plus the migration ~$77. Phase 5 is the largest surface of the five — it modifies an existing 1000-line helper and 27 test files rather than adding a fresh module. Work efficiently: batch independent tool calls, don't re-read files already established in the conversation, and don't spawn subagents unless asked. If you are running long, **finish and verify §9.1 + §9.2 + §9.4 (the questions, the routing and the visibility tightening) before starting §9.5** — standing feedback is the one piece that stands alone.
