# Select employees in a shift — design

Written 2026-08-11 on `main`. Resolves
`docs/superpowers/specs/RESUME-select-employees-in-a-shift.md`.

---

## 0. Which reading this is

The resume doc listed three readings of "I should be able to select employees in
a shift". **It is reading (b′): pick several people at once, and get one shift
row per person.** Confirmed with the user before designing.

It is NOT reading (b) — a single `Shift` that holds several employees. It is not
a bug hunt (a), and it is not grid drag-and-drop (c).

That distinction is the whole point of the design: **there is no schema change.**
`Shift.employee` stays a single nullable ref, `null` still means OPEN SHIFT.
Ticking N people writes N rows. Every downstream assumption survives untouched:

- `attendance.controller.js` still matches a punch to a shift by
  `employee: matched._id` — each person owns exactly one row.
- `describeEarlyLeave` still reads one unambiguous `shift.end`.
- `buildRosterLanes` still puts one shift in one lane.
- Swaps still move one employee.
- `shiftSchema.index({ tenant: 1, employee: 1, start: 1 })` is still the right
  index for the overlap check.

## 1. Goal

In the roster drawer, staff a slot with several people in one action:

- **New shift** — tick 3 people for an 18:00–02:00 Bartender slot, get 3 shifts.
- **Edit shift** — tick extra people on an existing shift; the original row is
  kept and the newcomers get their own rows with the edited times.
- See **who is unavailable before ticking them**, judged by the server.
- Ticking nobody still means "open shift, waiting to be filled".

### Out of scope

Named here so they are not smuggled in:

- Multiple *open* slots ("3 unfilled bartender shifts").
- Drag-and-drop assignment on the week grid.
- Bulk-filling a week or copying a day.

---

## 2. Invariants this design must not break

Carried from the resume doc; each is load-bearing here.

1. **`Shift.employee === null` means OPEN SHIFT.** Not unset, not invalid. The
   picker's empty state must still express "this slot needs covering".
2. **`checkAssignment` is the ONE place an assignment is judged** (overlap,
   time off, role eligibility, inactive). No second check in a controller, and
   none in the browser. `force` keeps working, and a forced assignment is
   reported back, never silent.
3. **Rules live in `services/*.helpers.js`, never in a controller.** The suite is
   unit-only with no database, so anything left in a controller is untested.
4. **Admin tests cannot render components** (`environment: 'node'`, no jsdom).
   Any decision worth testing lives in `shift-roster-utils.ts`.
5. **Creating a shift never publishes it.** New rows are always `status:
   'draft'`, including rows created while editing a *published* shift.

---

## 3. Server

### 3.1 Batched assignment context

`assignmentContext(tenantId, employeeId, window, excludeId)`
(`shift.controller.js:216`) runs three queries pinned to one employee. Add:

```js
async function assignmentContexts(tenantId, employeeIds, window, excludeId)
  // -> Map<employeeIdString, { employee, shifts, timeOff }>
```

Same three collections, `employee: { $in: employeeIds }`, then grouped by
employee id. Every clause stays a NARROWING, exactly as documented on the
existing function — `findOverlaps` and `overlapsTimeOff` still decide.

The singular `assignmentContext` is **reimplemented as a one-element call** to
the plural version so there is one set of queries. Its signature and return
shape do not change: shift-swap approval depends on it, and a second loader
would be a second set of rules the moment one of them learned something.

The grouping itself is extracted as a pure function in `shift.helpers.js` so it
can be tested without a database:

```js
function groupAssignmentContexts(employees, shifts, timeOff)
  // -> Map<employeeIdString, { employee, shifts, timeOff }>
```

It must yield **empty arrays, not `undefined`**, for an employee with no shifts
and no time off.

### 3.2 `judgeAssignments` — the new helper

In `server/services/shift.helpers.js`, beside `checkAssignment`:

```js
function judgeAssignments(shift, employees, ctxById, { force = false } = {})
// -> {
//      allowed: [{ employee, warnings }],
//      blocked: [{ employee, code, message, conflicts, forceable }],
//    }
```

It maps `checkAssignment` over the people and sorts the verdicts. **It adds no
rules of its own** — this is the point. It is pure, takes its context as an
argument, and is therefore fully unit-testable with no database.

`forceable` is derived from one exported set:

```js
const FORCEABLE_CODES = new Set(['role_mismatch']);
```

`overlap` is physics and `time_off` is a real approval, so neither is forceable.
The flag is returned to the client so the browser stops maintaining its own
`canForce` list — one definition, on the server.

### 3.3 `bindEditedAssignment` — the edit fan-out rule

Also in `shift.helpers.js`, pure:

```js
function bindEditedAssignment(currentEmployeeId, tickedIds)
// -> { keep: string | null, create: string[] }
```

| Ticked set | `keep` (the edited row) | `create` (new rows) |
| --- | --- | --- |
| original still ticked | the original | every other ticked person |
| original unticked, others ticked | the first of them (a reassignment) | the rest |
| nothing ticked | `null` — **the row becomes an open shift** | none |
| exactly the original | the original | none |

"The first of them" means **first in the array as received** — the client sends
the ticked ids in the picker's display order (by name), so the choice is
deterministic and not dependent on click order.

Unticking is unassigning, which is what choosing "Open shift — nobody yet" does
today. It never deletes a row; cancelling has its own button.

### 3.4 `POST /api/shifts` — create fan-out

Accepts `employees: string[]` alongside the existing body.

- When `employees` is present it must be a **non-empty** array of ids. An empty
  array is a 400 — the open-shift case is expressed by omitting `employees` and
  sending `employee: null`, exactly as today, so `null` never has to survive a
  round trip inside an array.
- When `employees` is absent, behaviour is unchanged (single or open).
- Judge **everyone first** via `assignmentContexts` + `judgeAssignments`. If any
  are blocked, answer 409 and **write nothing** (§3.6).
- On success, `Shift.insertMany` the N documents — all `tenant`-stamped,
  `status: 'draft'`, `createdBy: req.user._id`.
- Response `201 { success: true, data: { items: [...], warnings: [...] } }`.
  `warnings` carry the employee id so a forced assignment names the person.

### 3.5 `PATCH /api/shifts/:id` — edit fan-out

Accepts `employees: string[]` (may be empty here — empty means open shift).

- `bindEditedAssignment` splits the ticked set into `keep` and `create`.
- The edited row is judged with `excludeId = row._id` so it does not overlap
  itself. The new rows are judged without an exclusion.
- Same all-or-nothing 409 across the whole set, same `force` / `skipBlocked`.
- New rows inherit the *edited* role, start, end, breakMinutes and note, and are
  `status: 'draft'` even when the edited row is `published`.
- Response `200 { success: true, data: { item, created: [...], warnings: [...] } }`.

### 3.6 The 409

Both writes answer:

```json
{
  "success": false,
  "code": "assignment_conflicts",
  "message": "2 of 5 people cannot be scheduled",
  "blocked": [
    { "employee": { "_id": "…", "firstName": "…", "lastName": "…" },
      "code": "overlap", "message": "…", "conflicts": [ … ],
      "forceable": false }
  ],
  "allowed": [ { "employee": { … }, "warnings": [ … ] } ]
}
```

Nothing is written. Two explicit ways forward, both chosen by the user:

- `force: true` — re-judge with force. `role_mismatch` becomes a warning;
  `overlap` and `time_off` still 409.
- `skipBlocked: true` — create only the allowed ones and report what was
  skipped, in `data.skipped`.

`force` and `skipBlocked` compose: forcing what can be forced and skipping the
rest is one request.

### 3.7 `POST /api/shifts/availability` — the pre-flight

Body `{ role, start, end, excludeId? }`. Loads every `status: 'active'` employee
in the tenant, batches their context, and runs the **same `checkAssignment`**
with `force: false`.

```json
{ "success": true, "data": { "items": [
  { "employee": { "_id": "…", "firstName": "…", "lastName": "…" },
    "ok": false, "code": "time_off",
    "message": "This employee has approved time off covering that period",
    "forceable": false }
] } }
```

Sorted by name. Declared in `shift.routes.js` **before `/:id`**, alongside
`generate` and `publish`, so `availability` is never read as an id. It inherits
the router's existing guards (`protect`, `attachTenant`, `requireOwnTenant`,
`tenantAdminOrSuperAdmin`) — a draft roster is not visible to the people on it.

This is why the badges are trustworthy: the picker's warnings and the save's
refusals come from the same judge, so they cannot drift.

---

## 4. Client (admin)

### 4.1 The picker

`ShiftDraft.employee: string` becomes `employees: string[]`. The `<select>` at
`shift-roster-page.tsx:678` becomes a bounded, scrollable checkbox list with a
filter box — a tenant can have a hundred staff and the drawer is `max-w-md`.

```
Assigned to                          3 selected
┌──────────────────────────────────────────────┐
│ 🔍 Filter…                                   │
├──────────────────────────────────────────────┤
│ ☑ Ada Obi              Bartender             │
│ ☑ Chidi Nwosu          Bartender             │
│ ☐ Ngozi Eze            ⚠ On approved time off│
│ ☐ Tunde Okafor         ⚠ Already scheduled   │
│ ☑ Sam Bello            ⚠ Not marked for this │
└──────────────────────────────────────────────┘
Nothing ticked = an open shift, waiting to be filled.
```

- Badges come from `POST /shifts/availability`, refetched **debounced** when
  role, date, start or end settle — never on a filter keystroke.
- Unavailable people are **badged, not disabled**: `role_mismatch` is forceable,
  and a greyed row hides its own reason.
- While the call is in flight the list renders **without** badges rather than
  blocking the drawer.
- In Edit mode the current employee starts ticked.

### 4.2 The conflict panel

The single amber banner becomes a list — one line per blocked person and reason
— above two buttons driven by the server's `forceable` flags:

- **"Assign anyway (N)"** — only when *every* block is forceable. Re-posts with
  `force: true`.
- **"Add the other N, skip these"** — whenever at least one person is allowed.
  Re-posts with `skipBlocked: true`.

When neither applies (a lone unforceable block, nobody allowed) the panel keeps
today's "This one cannot be overridden" line. Forced assignments still surface
as per-person warning toasts.

### 4.3 Where the logic goes

Components cannot be rendered under test, so the decisions move into
`shift-roster-utils.ts` as pure functions:

- `mergeAvailability(employees, verdicts)` → the badge list.
- `summariseAssignmentResult(response)` → banner lines, the two button
  conditions, and the "N selected" / "open shift" label.

`conflictLabel` stays where it is; `canForce` is **deleted** in favour of the
server's `forceable` flag.

`shift.service.ts` gains `employees`, `skipBlocked`, `availability()`, and a
`ShiftConflictError` that carries `blocked` / `allowed` instead of flattening
them to a string.

---

## 5. Test plan (TDD — red first)

Unit-only, no database, no rendering. Every rule above is reachable from a pure
function on purpose.

### Server — `server/__tests__/shift.helpers.test.js`

`judgeAssignments`:
- everyone clear → all in `allowed`, no `blocked`
- one overlap → that person blocked, `forceable: false`, the rest allowed
- one `role_mismatch` → blocked, `forceable: true`
- mixed overlap + role_mismatch → both blocked, flags differ
- `force: true` → role_mismatch moves to `allowed` **with a warning**; overlap
  stays blocked
- empty employee list → empty `allowed` and `blocked`, no throw

`bindEditedAssignment`:
- original still ticked → `keep` = original, `create` = the rest
- original unticked, others ticked → `keep` = first of them, `create` = the rest
- nothing ticked → `{ keep: null, create: [] }`
- ticked set is exactly the original → `create` empty

`groupAssignmentContexts` (the pure grouping half of §3.1):
- flat `$in` results grouped by employee id
- an employee with neither shifts nor time off yields **empty arrays**

### Admin — `shift-roster-utils.test.ts`

- `mergeAvailability`: verdict attached by id; an employee with no verdict is
  unbadged, **not hidden**
- `summariseAssignmentResult`: banner lines; "Assign anyway" only when all
  blocks are forceable; "skip these" only when someone is allowed; the
  "N selected" / "open shift" label

### Not unit-testable, verified otherwise

Controller wiring and the new route have no database in the suite, so they are
covered by `./node_modules/.bin/tsc --noEmit` plus a direct API round-trip
against the local backend, as the rest of the roster is.

### Baselines to hold

- Server `node --test '__tests__/*.test.js'` from `server/` — **1935/1938**.
  The 3 failures are pre-existing (1 pricelist tenant-scope, 2 SO-number).
  `npm test` is broken.
- Admin `./node_modules/.bin/vitest run` — **647/647**.
- Admin `./node_modules/.bin/tsc --noEmit` — **456**, all pre-existing. Never
  `npx tsc`; it installs a decoy `tsc@2.0.4` that prints "This is not the tsc
  command you are looking for" and exits 0.

---

## 6. Files this touches

| File | Change |
| --- | --- |
| `server/services/shift.helpers.js` | + `judgeAssignments`, `bindEditedAssignment`, `FORCEABLE_CODES`, `groupAssignmentContexts` |
| `server/controllers/shift.controller.js` | `assignmentContexts`; fan-out in create (:279) and update (:331); `availability` handler |
| `server/routes/shift.routes.js` | `POST /availability`, before `/:id` |
| `server/__tests__/shift.helpers.test.js` | the cases in §5 |
| `client/.../shift-roster-page.tsx` | `employees: string[]` draft, checkbox picker, conflict list |
| `client/.../shift-roster-utils.ts` | + `mergeAvailability`, `summariseAssignmentResult`; − `canForce` |
| `client/.../shift-roster-utils.test.ts` | the cases in §5 |
| `client/apps/admin/src/services/shift.service.ts` | `employees`, `skipBlocked`, `availability()`, richer `ShiftConflictError` |

Unchanged, and deliberately so: `server/models/Shift.js`, `attendance.controller.js`,
`attendance.helpers.js`, `buildRosterLanes`, the swap paths.

---

## 7. Note on the working tree

`git status` is dirty with **finished, verified, undeployed** kiosk work
(CORS `x-kiosk-token`, `describeEarlyLeave`, the 409 `leaving_early` flow, the
kiosk redesign). Do not clean it up or re-do it. This design touches none of it.
Production runs `41ec0d49` and still lacks the CORS fix.
