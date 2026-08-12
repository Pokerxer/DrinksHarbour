# RESUME: more than one role on a shift template

Written 2026-08-12 on `main`, clean tree, everything pushed at `f91201bb`.

The request reads three different ways and they differ enormously in size. §2 is
the important section — **establish which one it is before designing anything.**
§3 contains the one structural insight that decides whether this is a small
change or a large one.

---

## Prompt

> In `/Users/mac/Documents/drinksharbour`: work on the shift template — I should
> be able to select more than one role.

---

## 0. State of the tree

Clean. `main` == `origin/main` == `f91201bb`, pushed 2026-08-12.

`f91201bb` **feat(scheduling): fill a repeating pattern for several people at
once** added `POST /api/shifts/fill`, `patternDates`, `planPatternFill` and
`fillContextWindow`. Its UI **has never been opened in a browser** — see §6.

Baselines, measured 2026-08-12 with that work in place:

- **Server:** `cd server && node --test '__tests__/*.test.js'` → **1976 tests,
  1973 pass, `# fail 3`.** The 3 are pre-existing (1 pricelist tenant-scope,
  2 SO-number). **`npm test` is BROKEN.**
- **Admin tests:** `cd client/apps/admin && ./node_modules/.bin/vitest run` →
  **684/684**, 37 files. `environment: 'node'`, **no jsdom — components cannot
  be rendered**, so anything worth testing lives in a `*-utils.ts`.
- **Admin types:** `cd client/apps/admin && ./node_modules/.bin/tsc --noEmit` →
  **456**, all pre-existing. **NEVER `npx tsc`** — it installs a decoy
  `tsc@2.0.4` that prints "This is not the tsc command you are looking for" and
  exits 0, so a typecheck that verified nothing looks like a pass.

---

## 1. How roles work today

**A person already holds MANY roles. A shift needs exactly ONE.** That asymmetry
is the whole subject of this request.

```
User.employeeProfile.planning.roles  → [ObjectId]   an ARRAY, already
ShiftTemplate.role                   → ObjectId     single, REQUIRED
Shift.role                           → ObjectId     single, REQUIRED
```

- `server/models/ShiftTemplate.js:25` — `role`, required. The comment says why:
  "a shift nobody is qualified for cannot be checked against an employee's
  capabilities."
- `server/models/Shift.js:28` — `role`, required.
- `server/services/shift.helpers.js:677-678` — the ONLY place the two meet:
  ```js
  const held = (employee.employeeProfile?.planning?.roles || []).map(idOf);
  const required = idOf(shift.role);
  ```
  then `held.includes(required)` → otherwise `role_mismatch`.

`role_mismatch` is the **only forceable refusal** (`FORCEABLE_CODES`). An admin
who knows the person can cover it may override; `overlap` and `time_off` are not
overridable. Whatever multi-role means, it must not quietly make an override
unnecessary in cases where a human should still be deciding.

**Where `template.role` is read** (all of it — there is not much):
- `shift.helpers.js:412` — `planShiftGeneration`, `role: idOf(tpl.role)`
- `shift.helpers.js:507` — `planPatternFill`, the candidate handed to `checkAssignment`
- `shift.helpers.js:552` — `planPatternFill`, the row it emits
- `shift.helpers.js:937-943` — `buildShiftTemplatePayload`, rejects a template
  with no role: *"A template must require a role"*
- `shift.helpers.js:1051-1055` — `buildShiftPayload`, the same for a shift

**UI:** the template editor is
`client/apps/admin/src/app/(hydrogen)/employees/shifts/templates/page.tsx`.
(Older notes referring to `shift-templates-*.tsx` are STALE — no such files.)

---

## 2. What the request could mean, and how to tell

### (a) Wider eligibility — "anyone who is a bartender OR a server can work this"

One shift per slot, as today, but more than one role qualifies someone for it.
`checkAssignment`'s test changes from `held.includes(required)` to "the sets
intersect".

**Smallest of the three.** Arguably `Shift.role` does not even have to change if
the template resolves to a single role at generation time — but if the SHIFT is
meant to stay open to several roles, `Shift.role` becomes an array and that
touches the roster lanes, the colour fallback, and every existing row.

**Tell it apart by:** the user talks about who is *allowed* to work it, about
cross-trained staff, about a shift being refused for someone who can obviously
cover it.

### (b) Composition — "Friday night needs 1 bartender AND 2 servers"

The template describes a *crew*, not a slot. Generation stops being one row per
day and becomes **one row per required position per day**.

This is the reading that changes generation cardinality, and it almost certainly
wants a count per role, not just a list — "2 servers" is the normal case.

**Tell it apart by:** the user talks about how many people a shift needs, about
staffing a whole night in one action, about a template being a rota rather than
a slot.

### (c) Convenience only — grouping, filtering or labelling

The roles are metadata: the template shows against several roles in a filter, or
the palette groups by role. No change to generation or judgement at all.

**Tell it apart by:** the user talks about finding templates, about the palette
being cluttered, about a template "belonging to" more than one team.

### Most likely: (b), and it is the big one

"Select more than one role" on a *template* most naturally reads as "this shift
needs these roles filled". But (a) is a genuinely different feature that the
same words describe, and building the wrong one is expensive. **Ask.**

---

## 3. The structural insight that decides the size of this

**`Shift.employee === null` means OPEN SHIFT, and the model deliberately keeps a
single nullable ref — one row per person per day.** This was reaffirmed in
`0b803b8b` and again in `f91201bb`; `buildRosterLanes`, the attendance
punch→shift match, `describeEarlyLeave` and swaps all depend on it.

**Therefore, for reading (b), `Shift.role` probably does NOT need to change.**
A template requiring 1 bartender + 2 servers generates **3 rows**, each an
ordinary open shift with its own single `role`. Only `ShiftTemplate` gains the
richer field — something like:

```js
positions: [{ role: ObjectId, count: Number }]
```

If that holds, this is a **template-and-generation change, not a Shift schema
change**, which is dramatically cheaper and touches nothing in attendance. Test
that assumption early — it is the difference between a day and a week.

For reading (a), the reverse is true: eligibility lives on the *shift*, so
`Shift.role` is exactly what would have to change, and every consumer of it.

---

## 4. Things that will bite

- **Migration.** `ShiftTemplate.role` is `required: true` and every existing
  template has one. Whatever replaces it must either keep `role` as the legacy
  single field and add the new one, or backfill. Mongoose will not do this for
  you, and **it never drops a de-declared index nor re-options an existing one**
  — see the stale-global-unique-index note in project memory.
- **Idempotency.** `planShiftGeneration` keys on `template@startInstant`;
  `planPatternFill` keys on `template@startInstant@employee`. If one template
  now emits 3 rows on one day, **both keys stop being unique** and re-generating
  a range will duplicate. This is the single most likely way to break shipped
  behaviour. The key probably needs a position index or the role in it.
- **`checkAssignment` is the ONE judge.** `judgeAssignments` and
  `planPatternFill` both delegate to it and add no rules. Do not grow a second
  role test anywhere.
- **`role_mismatch` is the only forceable code.** Widening eligibility must not
  accidentally delete the override path or make it meaningless.
- **The colour fallback.** A template's colour falls back to *the role's* colour
  on the roster. With several roles, which one? Trivial, but it will surface.
- **`buildShiftTemplatePayload` rejects a role-less template.** That validation
  and its message are user-visible and tested.

---

## 5. Invariants not to break

- **`Shift.employee === null` = OPEN SHIFT**, single nullable ref, one row per
  person per day. **Do not revisit this.**
- **`checkAssignment` is the ONE judge**; `FORCEABLE_CODES` lives on the server
  and the browser reads `forceable` off the response. No client-side copy.
- **Generation is idempotent and must stay so.** Re-running a range must not
  duplicate. `skipped` is reported in full, never swallowed.
- **Creation never publishes.** Generated and filled rows are `draft`.
- **`patternDates` is the ONE reader** of `recurrence`/`cycleDays`/`anchorDate`.
  Both planners call it. Do not add a second reader.
- **Rules live in `services/*.helpers.js`, never a controller** — the server
  suite is unit-only with no database, so controller code is untested by
  construction.
- **Admin tests cannot render components.** Put decisions in a `*-utils.ts`.

---

## 6. Also outstanding

- **`f91201bb`'s UI has never been opened in a browser.** The fill drawer, both
  entry points and `fill-report-modal.tsx` have zero automated coverage. The
  seven manual checks are at the end of
  `docs/superpowers/plans/2026-08-12-shift-pattern-fill.md`. **Do these first if
  you are about to change the same screens** — otherwise a bug you introduce and
  a bug that was already there are indistinguishable.
- **Dead `fromTemplate`** in `shift-roster-page.tsx` — zero callers, left in
  place deliberately (plan said keep, final review said delete, the human did
  not rule). If you touch that file, ask.
- **The badge backfill has still never been run.** 27 Wyn City employees have no
  badge number, 36 across all tenants:
  `node scripts/backfill-employee-badge-numbers.js [--tenant=…] --apply`,
  dry-run first.

---

## Files

- `server/models/ShiftTemplate.js:25` — `role`, single + required
- `server/models/Shift.js:28` — `role`, single + required
- `server/services/shift.helpers.js:412` — `planShiftGeneration` emits `role`
- `server/services/shift.helpers.js:507,552` — `planPatternFill` reads and emits it
- `server/services/shift.helpers.js:677` — `checkAssignment`, the one judge
- `server/services/shift.helpers.js:937,1051` — the two payload builders
- `server/controllers/shift.controller.js` — `generateShifts`, `fillPattern`
- `client/apps/admin/src/app/(hydrogen)/employees/shifts/templates/page.tsx` — the template editor
- `client/apps/admin/src/app/shared/employees/shift-roster-page.tsx` — palette + fill drawer
- `client/apps/admin/src/services/shift.service.ts:46` — the `ShiftTemplate` type
