# RESUME — Employee module, Phase 2 (shift templates + roster)

> **STATUS: Phase 2 is COMPLETE as of 2026-08-08 and uncommitted.** Models, helpers,
> controller, routes, admin service, roster page and template page all shipped;
> server 1590/1593 (3 pre-existing failures), admin tsc 461, Vitest 43 green.
> The brief below is kept for reference only — do not re-execute it. The one
> thing still outstanding is the **open decision at the bottom**: the org-structure
> migration has not been applied.
>
> Next up is Phase 3 (attendance + kiosk), spec §7.

Paste the block below into a fresh session.

---

## Continue the employee shift module — Phase 2

Repo: `/Users/mac/Documents/drinksharbour` (branch `feat/free-delivery-first-purchase`). Everything below is **uncommitted**. Do not commit or push unless I ask in that turn.

### Read first

- Design spec: `docs/superpowers/specs/2026-08-08-employee-org-structure-shifts-appraisals-design.md` — sections 6 (Phase 2), 7, 8, 9. It is approved; do not re-brainstorm it.
- Memory entry `employee_org_structure_shifts.md`.

### Already done — do NOT rebuild

**Phase 1 (org structure) is complete and verified.**
- `server/models/{Department,JobPosition,EmployeeRole}.js`
- `server/services/orgStructure.helpers.js` + `__tests__/orgStructure.helpers.test.js` (24 tests)
- `server/controllers/orgStructure.controller.js` (one handler factory for all three entities), `server/routes/orgStructure.routes.js` (3 routers), mounted in `server.js` at `/api/departments`, `/api/job-positions`, `/api/employee-roles`
- `server/scripts/migrate-employee-org-structure.js` — **written, dry-run clean, NOT APPLIED** (see "Open decision" below)
- `User.employeeProfile`: `work.department`, `work.jobPosition`, `planning.roles[]`, `planning.defaultRole`, `approvers.*` are now ObjectId refs. `buildEmployeeProfile` in `employee.helpers.js` has an `oid()` coercer that **drops** non-ObjectId values on purpose.
- Admin: `services/orgStructure.service.ts`, `app/shared/employees/{org-config-page.tsx,org-config-utils.ts,employee-org-fields.tsx}`, pages `/employees/{departments,job-positions,roles}`, nav + `config/routes.ts` wired.

**Phase 2 is ~25% done.** `server/services/shift.helpers.js` is complete with `__tests__/shift.helpers.test.js` at **31/31 passing**. It exports:
`SHIFT_STATUSES`, `parseTimeOfDay`, `formatTimeOfDay`, `crossesMidnight`, `shiftWindow`, `shiftDurationMinutes`, `eachDateInRange`, `dayOfWeek`, `planShiftGeneration`, `findOverlaps`, `overlapsTimeOff`, `checkAssignment`, `summariseRoster`, `canTransitionShift`.

**Build on these helpers — do not reimplement any rule they already cover.**

### Your task: finish Phase 2

1. **`server/models/ShiftTemplate.js`** — `tenant, name, role→EmployeeRole, department→Department, startTime "HH:MM", endTime "HH:MM", breakMinutes, daysOfWeek [0..6], color, isActive, createdBy`. Import the status/enum constants from `shift.helpers.js` rather than redeclaring them (`JobPosition.js` imports `EMPLOYMENT_TYPES` from `orgStructure.helpers.js` — follow that).

2. **`server/models/Shift.js`** — `tenant, template→ShiftTemplate (nullable), employee→User (**NULLABLE — null means an open shift**), role→EmployeeRole (required), department→Department, start/end Date, breakMinutes, status enum from SHIFT_STATUSES, publishedAt, note, createdBy`. Indexes `{tenant, start}` and `{tenant, employee, start}`.

3. **`server/controllers/shift.controller.js`** + **`server/routes/shift.routes.js`** (two routers, the `orgStructure.routes.js` / `appraisal.routes.js` pattern), mounted in `server.js` at `/api/shift-templates` and `/api/shifts`. Guards on every router: `protect → attachTenant → requireOwnTenant → tenantAdminOrSuperAdmin`.
   - Template CRUD, mirroring the org-structure controller.
   - `GET /api/shifts?from=&to=` — the roster window, plus a `summary` from `summariseRoster`.
   - `POST /api/shifts` / `PATCH /api/shifts/:id` — on assignment run `checkAssignment` and return **409** with its `code`/`message`/`conflicts` when it fails. Pass `force: true` through from the body; remember `force` overrides `role_mismatch` but **never** `overlap`.
   - `POST /api/shifts/generate {from, to, templateIds}` — call `planShiftGeneration`, `insertMany` the result, and return **both** `created` and the `skipped` array with its reasons (skips are the useful output; swallowing them makes generation look broken).
   - `POST /api/shifts/publish {from, to}` and `PATCH /api/shifts/:id` status changes — gate every status move through `canTransitionShift`.
   - Delete guard on EmployeeRole: `orgStructure.helpers.js → describeDeleteBlockers` already accepts a `shifts` key that is currently never populated. **Now populate it** in `ENTITIES['employee-roles'].countBlockers` in `orgStructure.controller.js`, counting future non-cancelled shifts.
   - Tenant offset: pass `req.tenant?.employeeProfile`-independent tenant timezone through to the helpers. Default `60` (Africa/Lagos). Do not read the server's local TZ.

4. **Admin UI**
   - `services/shift.service.ts` — follow `services/orgStructure.service.ts` exactly, including its generic `handle<T>` envelope typing (the plain version trips `TS18046` under this tsconfig).
   - `/employees/shifts/templates` — reuse `app/shared/employees/org-config-page.tsx`; it is already generic over entity + form.
   - `/employees/shifts` — week roster: employees as rows, days as columns, an **"Unassigned / open shifts" lane pinned above** the employee rows, template palette, Generate + Publish. Put any pure logic (week construction, conflict labels, grid bucketing) in `app/shared/employees/shift-roster-utils.ts` with Vitest tests — **the admin Vitest env is `node`, no jsdom, so components cannot be rendered.**
   - Add both routes to `config/routes.ts` under `routes.employees` and to the Organisation/Planning nav in `employees-nav-header.tsx`. **No middleware change needed — `/employees/:path*` already covers them.**

### Verification (must all hold before you report done)

- `cd server && node --test '__tests__/*.test.js'` → **1571/1574 expected** (1540 now + your new shift tests). Exactly **3** failures are pre-existing and acceptable: 1 pricelist populate, 2 SO-number. Any other failure is yours.
- `cd client/apps/admin && ./node_modules/.bin/tsc --noEmit` → **461 src errors, the baseline**. Never use `npx tsc` — it installs a decoy `tsc@2.0.4` that prints "This is not the tsc command you are looking for" and exits 0 without checking anything.
- `npx vitest run src/app/shared/employees/` → green.
- Verify any new `react-icons/pi` names actually exist (`node -e "console.log(typeof require('react-icons/pi').PiX)"`) — a bad name is a runtime crash TypeScript will not catch.

### Open decision, needs the user — do not decide it yourself

`scripts/migrate-employee-org-structure.js` has **not** been applied. Its dry run showed tenant `699165839f3308b1baeca8fc` (wyncity, 39 employees) would create 10 departments, but **at least 4 are job roles people typed into the department box**: `Attendant`, `Driver`, `Cashier`, `Office Assistant` (the genuine ones being `Retail`, `Administration`, `Management`, `accounts`, `Sales`, `Utility`). Those four are really `EmployeeRole`s. Ask the user before running `--apply`.

### Cost

The prior session reached ~$71. Work efficiently: batch independent tool calls, don't re-read files already established, and don't spawn subagents unless asked.
