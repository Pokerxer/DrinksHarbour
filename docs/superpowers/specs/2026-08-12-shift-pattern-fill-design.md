# Shift pattern fill — put several people on a repeating pattern across a range

Written 2026-08-12 on `main`. Baseline `0b803b8b`.

Supersedes the open questions in `RESUME-recurring-shift-patterns.md`. That
document's §1 (what already ships) and §4 (invariants) still stand and are not
repeated here.

---

## The problem, located in code

The roster has a **template palette** (`shift-roster-page.tsx:678`). Clicking a
template calls `fromTemplate(t, date, null)`, which prefills the drawer for
**exactly one day** — `today` if it falls in the visible week, otherwise `from`
— with nobody assigned. It reads the template's `startTime`, `endTime`,
`breakMinutes` and `role`, and **ignores `recurrence` entirely**.

So a 1-on/1-off template — which `ShiftTemplate` fully understands as
`recurrence: 'cycle'`, `cycleLength: 2`, `cycleDays: [0]` — lands on a single
day when clicked. That is the user's "it should fill more than one day, not just
the day I clicked".

Separately, **Generate** (`POST /api/shifts/generate`) *does* honour recurrence
across a range, but everything it creates is an **open** shift:
`ShiftTemplate` has no employee field and `planShiftGeneration` hardcodes
`employee: null`.

Both halves exist. **What is missing is the join between "this pattern repeats"
and "these people work it."**

---

## Decisions taken

| Question | Decision |
|---|---|
| Durable membership, or a one-time action? | **One-time bulk fill.** Durable membership ("Ada works this pattern from 1 Sept") is a **follow-on spec**, explicitly out of scope. |
| How far does a fill reach? | **The visible week by default, editable** to any range up to `MAX_GENERATION_DAYS` (92). |
| Someone is blocked on day 17 of 30? | **Skip the blocked person-days, write the rest, report every skip in full.** |
| Employee-page entry point? | **In scope.** Same drawer, same endpoint, that person pre-ticked. |
| Undo the batch? | **No.** Everything written is `draft` and unpublished; the roster's existing range/template filters are the escape hatch. No schema change. |

### Why skip-blocked here, when the multi-select is all-or-nothing

`0b803b8b` refuses the whole write with a 409 if any one person is blocked. That
is correct for 3 people on 1 day: the admin sees the breakdown and re-picks.
Over a month it is 3 × 30 = 90 judgements, and one overlap on day 17 would
refuse all 90 rows.

**This divergence is deliberate and must be commented as such at the call site**,
or a later reader will "fix" the inconsistency and reintroduce the problem.

---

## Server design

### `patternDates(template, dates)` — new, pure, in `shift.helpers.js`

Extracted **verbatim** from the per-template branch that today lives inside
`planShiftGeneration` (`shift.helpers.js:310`).

```js
patternDates(template, dates) // dates from eachDateInRange
//   → { ok: true,  dates: ['2026-08-10', '2026-08-12', ...] }
//   → { ok: false, reason: 'Template has no worked days in its cycle' }
```

Refusal reasons, unchanged in wording from today's `skipped` output: template
inactive, invalid start/end time, cycle invalid, empty `cycleDays`, no
`daysOfWeek` set.

`planShiftGeneration` is refactored to call it. **This is the load-bearing part
of the extraction: `planShiftGeneration`'s existing tests must stay green with
zero behaviour change and zero test edits.** That is the proof the extraction
was faithful.

The point of extracting rather than duplicating: **exactly one reader of
`recurrence` / `cycleDays` / `anchorDate` on the server.** A cycle bug fixed in
one path cannot silently persist in the other.

### `planPatternFill(template, employees, opts)` — new, pure

```js
opts = { from, to, offsetMinutes, existing, ctxById, force }
//   → { toCreate: [ …one row per person per day… ],
//       skipped:  [ { employee, name, date, code, reason, forceable } ] }
```

For each date from `patternDates`, build the window **once** via `shiftWindow`,
then judge each employee with **`checkAssignment`** — the one judge. It adds no
rules of its own, exactly as `judgeAssignments` adds none.

Three requirements:

1. **Idempotency key becomes `template@startInstant@employee`.**
   Today's `template@startInstant` cannot distinguish three people's shifts
   generated from one template on one day. Open shifts key as
   `template@startInstant@` (empty trailing segment), so rows written by the
   existing `/generate` keep matching and re-running a range still tops up
   rather than duplicating.

2. **The batch accumulates into its own conflict set.** A row just planned for
   Ada is appended to Ada's `ctxById` entry *before* the next date is judged.
   Without this, a template with `endDayOffset: 1` — the 24h20m case the model
   already supports — would write two overlapping shifts for the same person on
   consecutive worked days, because neither exists in the database yet when the
   other is judged. `checkAssignment` cannot catch this on its own; it only sees
   the context it is handed.

3. **Every row is `status: 'draft'`.** Creation never publishes.

`force` maps to `checkAssignment`'s `force`, so only `role_mismatch` is
overridable (`FORCEABLE_CODES`). `overlap` is physics and `time_off` is a
commitment already made to the person; neither is forceable, and each skipped
entry carries `forceable` so the browser never keeps its own copy of that list.

### `POST /api/shifts/fill` — new endpoint

Declared **before `/:id`** in `shift.routes.js`, alongside `/generate`,
`/publish` and `/availability`, so `fill` is never read as an id. Inherits the
same four guards (`protect`, `attachTenant`, `requireOwnTenant`,
`tenantAdminOrSuperAdmin`).

```
body → { templateId, employees: string[], from, to, force?: boolean }
201  → { success: true, data: { created: Number, items: [...], skipped: [...] } }
```

`201` and the `{ success, data }` envelope both match `generateShifts`, which is
the closest existing sibling — a fill that answered `200` or returned a bare
body would be the only endpoint in this controller shaped differently.

Controller responsibilities only — no rules:

- `parseRosterRange` for `from`/`to`; reject an empty `employees`.
- Load the template, tenant-scoped.
- **One** `assignmentContexts` call spanning `[range.start, range.end)` for all
  employees. **Not one call per day** — 30 days must not become 30 round trips.
- One `Shift.find` over the range for the idempotency set.
- `planPatternFill` → `insertMany`.
- Return `skipped` **in full, never truncated or swallowed.** "Created 0 shifts"
  with no reason is indistinguishable from a broken feature.

---

## Client design

Admin Vitest runs `environment: 'node'` with **no jsdom — components cannot be
rendered**. Every decision therefore lives in `shift-roster-utils.ts` and is
tested there; the `.tsx` files only wire.

### New pure functions in `shift-roster-utils.ts`

- **`fillPreview(template, from, to)`** → `{ dates: string[], count: number }`,
  driving `→ Mon 10, Wed 12, Fri 14, Sun 16 · 4 days`.
- **`fillSummaryLabel(days, people)`** → `4 days × 2 people = 8 shifts`.
- **`summariseFillResult(result)`** → the created count plus skips grouped by
  person, reusing `conflictLabel` for wording so refusal text matches the
  drawer's existing 409 path.

**Known duplication, accepted:** `fillPreview` re-reads recurrence on the
client. `isCycleWorkDay` / `cyclePreview` already live in this file for the
template editor's preview, so this is pre-existing duplication rather than new.
The server stays authoritative — **the preview is a label, never an input to
what gets written.** If the two ever disagree, the server is right and the
preview is the bug.

### `shift-roster-page.tsx`

`fromTemplate` stops prefilling a single date. A palette click opens the drawer
in **fill mode**:

```
Repeat  1 on, 1 off  (from template — read-only)
From [2026-08-10]  To [2026-08-16]     ← defaults to days[0].date / days[6].date
→ Mon 10, Wed 12, Fri 14, Sun 16  · 4 days

People  ☑ Ada  ☑ Bola  ☐ Chidi        ← the existing multi-select, unchanged
→ 4 days × 2 people = 8 shifts
```

Save posts to `/fill`. The result renders as:

```
✅ 58 shifts created · all draft, unpublished
⚠ 2 skipped
   Bola · Wed 17 Sep — approved leave
   Bola · Tue 23 Sep — overlaps 09:00–17:00 shift
```

The drawer's existing single-day create/edit path is **untouched** — clicking
`+` on a cell still creates one shift, and editing an existing shift still edits
one shift. Fill mode is entered only from a template.

### Employee page

`employee-detail.tsx` gains an **"Add to a shift pattern"** action opening the
same drawer with a template dropdown and that person pre-ticked (and editable).
Same endpoint, same rules, **no second code path** — this is an entry point, not
a feature.

---

## Testing (TDD — test first, watch it fail, then implement)

**Server** (`cd server && node --test '__tests__/*.test.js'`), all against pure
helpers, no database:

- `patternDates` parity — `planShiftGeneration`'s existing tests green, unedited.
- `patternDates` refusals for each of the five reasons.
- 1-on/1-off across a range hits exactly the anchored dates; dates *before* the
  anchor still work (`floorMod`, not `%`).
- N people × M days produces N×M rows.
- One blocked person-day is skipped; the other rows are still written.
- **In-batch overlap:** `endDayOffset: 1` on consecutive worked days — the
  second is skipped as an overlap.
- Re-running an identical range creates nothing (idempotency on the new
  three-part key), and does not collide with `/generate`'s open rows.
- `role_mismatch` is forceable; `overlap` and `time_off` are not.

**Admin** (`cd client/apps/admin && ./node_modules/.bin/vitest run`):
`fillPreview`, `fillSummaryLabel`, `summariseFillResult`.

### Baselines to hold

- Server: **`# fail 3`** (pre-existing: 1 pricelist tenant-scope, 2 SO-number).
  **`npm test` is broken** — use `node --test` directly.
- Admin tests: **669/669** at start.
- Admin types: **456** pre-existing errors, via `./node_modules/.bin/tsc --noEmit`.
  **Never `npx tsc`** — it installs a decoy `tsc@2.0.4` that prints "This is not
  the tsc command you are looking for" and exits 0.

---

## Invariants this must not break

Carried from `RESUME-recurring-shift-patterns.md` §4:

- **`Shift.employee === null` means OPEN SHIFT**, a single nullable ref. One row
  per person per day. No `employees[]` on the model.
- **`checkAssignment` is the ONE judge.** No client-side copy of
  `FORCEABLE_CODES`.
- **Generation stays idempotent**, and `skipped` keeps being reported in full.
- **Creation never publishes.** Generated and filled rows are `draft`.
- **Never write retroactively without thought** — `clampPublishRange` exists
  because a publish reaching into the past rewrote attendance history. Fill
  writes `draft` rows, which are invisible to staff and count as no absence, so
  a past-dated fill is not the same hazard as a past-dated publish. It is still
  worth a deliberate look during implementation.
- **Rules live in `services/*.helpers.js`, never a controller** — controllers are
  untested here.

---

## Out of scope

- Durable pattern membership on the employee record (the follow-on spec).
- Undo / batch delete.
- Any change to `/generate`'s observable behaviour.
- Any change to the single-day create/edit path.
- Publishing.

---

## Risks

1. **The multi-select shipped without ever being opened in a browser**
   (`RESUME-…` §5). This design builds directly on its picker and its
   `session.withTransaction` write path, which **needs a replica set**. Verify
   that first — the five drawer flows are written up in
   `.superpowers/sdd/shift-multiselect/progress.md` under "HOW TO FINISH
   VERIFYING". Building on an unverified picker means debugging the wrong layer.
2. **The `patternDates` extraction is a refactor of shipping code.** If
   `planShiftGeneration`'s tests need editing to stay green, the extraction
   changed behaviour and is wrong.
3. **N×M cost.** One context query over the whole range, judged day by day in
   memory. A per-day query would be 92 round trips at the cap.

---

## Files

**Server**
- `server/services/shift.helpers.js` — `patternDates` (new), `planPatternFill`
  (new), `planShiftGeneration` (refactored to call `patternDates`)
- `server/controllers/shift.controller.js` — `fillPattern` (new)
- `server/routes/shift.routes.js` — `POST /fill`, before `/:id`
- `server/__tests__/` — new cases beside the existing shift helper tests

**Client**
- `client/apps/admin/src/app/shared/employees/shift-roster-utils.ts` —
  `fillPreview`, `fillSummaryLabel`, `summariseFillResult`
- `client/apps/admin/src/app/shared/employees/shift-roster-utils.test.ts`
- `client/apps/admin/src/app/shared/employees/shift-roster-page.tsx` — fill mode
- `client/apps/admin/src/app/shared/employees/employee-detail.tsx` — entry point
- `client/apps/admin/src/services/shift.service.ts` — `fill()`

---

## Note on the working tree

At the time of writing, four files are dirty:
`shift-roster-page.tsx`, `shift-roster-utils.ts`, `shift-roster-utils.test.ts`,
`shift.service.ts`. All four are **Prettier reflow only** — no semantic change
from `0b803b8b`. `RESUME-recurring-shift-patterns.md` §0 claims a clean tree;
that is now stale, but harmless.
