# RESUME: "I should be able to select employees in a shift"

Written 2026-08-11 on branch `feat/public-kiosk-and-tenant-branding` (merged to
main and pushed as `41ec0d49`; **later work on this branch is UNCOMMITTED — see
§0**).

The request is one sentence and reads three different ways. **Resolve which one
before designing anything** — one of them is a bug hunt, one is a schema change
that touches the attendance code, and they share almost no work.

---

## Prompt

> In `/Users/mac/Documents/drinksharbour`: I want to be able to select employees
> in a shift. Read
> `docs/superpowers/specs/RESUME-select-employees-in-a-shift.md` first — a
> single-employee selector already exists, so §1 lists the three things this
> could mean and how to tell them apart. Establish which one it is before
> designing. Then brainstorm → spec → TDD. Don't commit unless I ask.

---

## 0. State of the tree — read this first

`git status` is dirty and the work in it is **finished, verified and
undeployed**. Do not "clean up" or re-do it.

Uncommitted, all from 2026-08-11:

- `server/config/cors.js` + `server/__tests__/cors.test.js` (new) — **the CORS
  allowlist was missing `x-kiosk-token`, which killed the entire public kiosk in
  a browser while every curl and every server test passed.** The preflight still
  answers 204; the BROWSER compares the requested header against the returned
  list and blocks the request, so the symptom is a bare `Failed to fetch` with
  no status. Config extracted out of `server.js` so it can be asserted.
- `server/services/attendance.helpers.js` — `describeEarlyLeave`, the mirror of
  `describePunctuality` against `shift.end`.
- `server/controllers/attendance.controller.js` — clock-out returns **409
  `leaving_early`** and writes NOTHING until the client re-posts with
  `confirmEarlyLeave: true`.
- `client/.../kiosk-early-leave.tsx` (new), `attendance-kiosk-page.tsx`,
  `attendance-utils.ts`, `kiosk-confirmation.tsx`, `attendance.service.ts` — the
  confirm dialog, and a wall-tablet redesign of the kiosk.

Baselines with that work in place (all measured, all matching):

- **Server:** `node --test '__tests__/*.test.js'` from `server/` — **1935/1938**.
  The 3 failures are pre-existing (1 pricelist tenant-scope, 2 SO-number).
  `npm test` is broken.
- **Admin:** `./node_modules/.bin/vitest run` — **647/647**. `environment: 'node'`,
  **no jsdom, components cannot be rendered** — logic worth testing must live in
  a `*-utils.ts`.
- **Admin typecheck:** `./node_modules/.bin/tsc --noEmit` — **456**, all
  pre-existing. **Never `npx tsc`** — it installs a decoy `tsc@2.0.4` that prints
  "This is not the tsc command you are looking for" and exits 0.

**Production runs `41ec0d49` and does NOT have the CORS fix**, so the kiosk is
still broken there until main is pushed again.

---

## 1. What the request could mean, and how to tell

**A single-employee selector already exists and appears to work.**
`shift-roster-page.tsx:678` renders a `<select>` bound to `draft.employee`,
populated from `employeeService.getEmployees(token, { status: 'active' })`
(:156), and the drawer submits `employee: draft.employee || null` (:240). So the
literal reading of the request is already built — which means the user wants
something the current selector does not do.

### (a) The selector is broken FOR THEM — a bug

Cheapest to rule out, so rule it out first. Ask, or look:

- Is the dropdown empty? `getEmployees(..., { status: 'active' })` returns only
  ACTIVE staff, so anybody `inactive`/`suspended` is silently absent.
- Does it save? `PATCH` runs `checkAssignment`
  (`shift.helpers.js:458`) and **refuses on overlap, time-off and role
  eligibility** — a refusal here surfaces as an error the user may be reading as
  "I can't select employees". `checkAssignment` takes `force`, so there is
  already a documented override path.
- Does the person they want not appear because they hold no matching
  `employeeProfile.planning.roles`?

### (b) Several people on ONE shift — a schema change

The expensive one. `Shift.employee` is a **single nullable ref** and the model's
own comment (`models/Shift.js:4`) says the nullability is the point: a roster is
built as unassigned slots first and filled later. `null` means OPEN SHIFT, not
missing data — this is recorded in memory as an invariant.

Going to `employees[]` ripples further than it looks:

- `shiftSchema.index({ tenant: 1, employee: 1, start: 1 })` (:46) — the overlap
  check's index.
- `shift.controller.js` — `assignmentContext` (:216), the `employee=open` filter
  (:255), the create (:279) and patch (:331–345) assignment re-checks.
- `shift.helpers.js:458` `checkAssignment` — overlap/time-off/role, per person.
- **`attendance.controller.js` matches a punch to a shift by
  `employee: matched._id`** — and the `describeEarlyLeave` work in §0 reads
  `open.shift` to find `shift.end`. Both assume one person per shift.
- `shift-roster-utils.ts:298` `buildRosterLanes` — one lane per employee, so a
  shift with three people has to appear in three lanes or the grid model changes.
- Swaps live in `shift.controller.js` (there is no separate swap controller) and
  a swap moves ONE employee.

**Strongly consider the cheaper equivalent first:** N shifts with the same role
and time, one per person, which the data model already supports. If the user
wants "3 bartenders, 18:00–02:00", a "duplicate this slot ×3" affordance
delivers that without touching the schema, and keeps one row per person —
which is what attendance, swaps and the early-leave rule all need anyway.
Only go to `employees[]` if the user genuinely needs the three to be ONE
object that moves and cancels together.

### (c) Assign from the GRID rather than the drawer

UI-only, moderate. Click a cell to assign, drag somebody onto an open slot,
multi-select a week and fill it. The roster already knows its lanes and days
(`buildRosterLanes`), and `openNew(day.date, lane.employeeId)` (:420) already
pre-fills the employee from the lane that was clicked — so the grid is half way
there and the gap is bulk/direct manipulation, not the data.

---

## Invariants not to break

- **`Shift.employee === null` means OPEN SHIFT.** Not "unset", not "invalid". The
  roster pins open shifts above the employee rows on purpose. Any multi-employee
  design has to keep expressing "this slot needs covering and nobody has it".
- **`checkAssignment` is the ONE place assignment is judged** (overlap, time-off,
  role eligibility). Do not add a second check in a controller; extend that
  helper, per person, and keep `force` working.
- **A punch is matched to a shift by employee + time** in
  `attendance.controller.js`. If a shift can hold several people, `matchShiftForClock`
  and the `describeEarlyLeave` lookup both need to say WHICH person's slot —
  otherwise one person's early clock-out reads another's shift end.
- **Rules live in `services/*.helpers.js`, never in a controller** — the whole
  suite is unit-only with no database, so anything not in a helper is untested.
- **Admin tests cannot render components.** Put the decision in
  `shift-roster-utils.ts` and test that; a component test is not available.

---

## Files

- `server/models/Shift.js:27` — `employee` single nullable ref; `:46` the index
- `server/controllers/shift.controller.js:216,255,279,331` — assignment paths
- `server/services/shift.helpers.js:458` — `checkAssignment`, the one judge
- `server/controllers/attendance.controller.js` — punch→shift matching
- `client/apps/admin/src/app/shared/employees/shift-roster-page.tsx:678` — the
  existing employee `<select>`; `:156` how employees are loaded; `:420` `openNew`
- `client/apps/admin/src/app/shared/employees/shift-roster-utils.ts:298` —
  `buildRosterLanes`
- `client/apps/admin/src/services/shift.service.ts:8` — the nullable-employee note

---

## Also still outstanding

- **The kiosk work in §0 is undeployed.** Merging main is what fixes the live
  kiosk.
- **The badge backfill has never been run.** 27 Wyn City employees have no badge
  number, 36 across all tenants.
  `node scripts/backfill-employee-badge-numbers.js [--tenant=699165839f3308b1baeca8fc] --apply`,
  dry-run first.
- **Nothing in the kiosk has been seen in a browser** — pairing, the logged-out
  scan, the early-leave dialog and the redesign are verified by unit tests,
  typecheck and a direct API round-trip only.
