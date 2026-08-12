# RESUME: recurring shift patterns that fill the roster themselves

Written 2026-08-12 on `main`, clean tree, everything pushed at `0b803b8b`.

The request reads three different ways and **most of the machinery already
exists**. §1 is the important section: a 1-day-on/1-day-off pattern is already a
supported, tested, shipping concept. Read it before designing anything, or you
will rebuild `planShiftGeneration`.

---

## Prompt

> In `/Users/mac/Documents/drinksharbour`: shifts should apply to the roster
> automatically. For a 1-day-on/1-day-off pattern, selecting it on the roster
> should fill more than one day, not just the day I clicked. I also want to put
> several employees on a shift pattern, or set the pattern from the employee
> page.
>
> Read `docs/superpowers/specs/RESUME-recurring-shift-patterns.md` first — §1
> lists what already ships (cycle recurrence and generation both exist), and §2
> lists the three things this request could mean and how to tell them apart.
> Establish which one it is before designing. Then brainstorm → spec → TDD.
> Don't commit unless I ask.

---

## 0. State of the tree

Clean. Nothing uncommitted. `main` == `origin/main` == `0b803b8b`.

Last two commits, both pushed 2026-08-11:

- `0b803b8b` **feat(scheduling): staff one shift slot with several people at once** —
  the multi-select picker. `POST /shifts` and `PATCH /shifts/:id` accept
  `employees: string[]` and fan out into one row per person; `POST
  /shifts/availability` badges the picker; `forceable` is server-decided.
  **Never opened in a browser** — see §5.
- `04a4fc02` **fix(kiosk): allow x-kiosk-token through CORS…** — unrelated, ships
  the CORS fix production was missing.

Baselines, all measured 2026-08-11 with that work in place:

- **Server:** `cd server && node --test '__tests__/*.test.js'` → 1957 tests,
  **1954 pass, `# fail 3`**. The 3 are pre-existing (1 pricelist tenant-scope,
  2 SO-number). **`npm test` is BROKEN.**
- **Admin tests:** `cd client/apps/admin && ./node_modules/.bin/vitest run` →
  **669/669**. `environment: 'node'`, **no jsdom — components cannot be
  rendered**, so anything worth testing lives in a `*-utils.ts`.
- **Admin types:** `cd client/apps/admin && ./node_modules/.bin/tsc --noEmit` →
  **456**, all pre-existing. **Never `npx tsc`** — it installs a decoy
  `tsc@2.0.4` that prints "This is not the tsc command you are looking for" and
  exits 0.

---

## 1. What already exists — read this before designing

### 1-on-1-off is already a supported pattern

`ShiftTemplate` (`server/models/ShiftTemplate.js`) has had cycle recurrence since
2026-08-10:

```js
recurrence: 'weekly' | 'cycle'   // weekly reads daysOfWeek; cycle ignores it
cycleLength: Number              // 2 = one on, one off
cycleDays:   [Number]            // 0-based offsets worked within the cycle; [] = nothing
anchorDate:  String              // 'YYYY-MM-DD' local, the day offset 0 falls on
```

One-on/one-off is `recurrence: 'cycle'`, `cycleLength: 2`, `cycleDays: [0]`.
`isCycleWorkDay` uses `floorMod`, not `%`, so dates before the anchor still work.
The stored `anchorDate` is what keeps generation idempotent — do not recompute it.

### Generation across a date range already exists

`planShiftGeneration` (`server/services/shift.helpers.js:310`) is pure, unit-tested,
and already walks a range emitting one shift per matching day. `POST
/api/shifts/generate` (`shift.controller.js`, `generateShifts`) runs it over a
range for a set of chosen templates and `insertMany`s the result. The roster page
already has a **Generate** button wired to it with a template picker.

Idempotency is keyed on **`template@startInstant`** — re-generating the same range
recognises what it already made instead of duplicating. `skipped` is returned in
full and never swallowed, because "created 0 shifts" with no reason is
indistinguishable from a broken feature.

### So what is actually missing?

**Everything generation creates is an OPEN shift.** `ShiftTemplate` has no
`employee` field at all — it carries a `role`, not a person. `generateShifts`
therefore performs **no `checkAssignment` whatsoever**, because an open shift
conflicts with nobody. That is deliberate: the roster is built as open slots and
filled afterwards.

The gap the user is describing is the join between *"this pattern repeats"* and
*"these people work it"*.

### And the multi-select just shipped

`0b803b8b` added fan-out across **people** for a single day: `employees: [a,b,c]`
on `POST /shifts` writes three rows. What the user now wants is fan-out across
**days** as well — which makes the natural shape N people × M days.

---

## 2. What the request could mean, and how to tell

### (a) Recurrence in the roster drawer — "repeat this shift"

The drawer creates exactly one shift on one date. The user clicks `+` on Monday,
and wants a 1-on/1-off choice right there that also creates Wednesday, Friday,
Sunday… to some horizon.

Smallest of the three, and it composes cleanly with what shipped: the drawer
already sends `employees[]`; this adds `dates[]` (or a recurrence + an end date)
alongside it. No schema change — still one row per person per day.

**Tell it apart by:** the user talks about the drawer, about "the day I clicked",
about wanting it to keep going for a few weeks. The words *"if I select it on the
roster it should select more than one day"* point here.

### (b) People attached to a pattern — a template that knows who works it

`ShiftTemplate` gains employees (or a new join collection does), so **Generate**
produces assigned shifts rather than open ones. This is what makes the roster
"apply automatically" in the strongest sense: set it up once, generate a month,
everybody's rota is filled.

Bigger, and it changes generation from a zero-judgement operation into one that
must run `checkAssignment` per person per day. See §3 — that is where the real
design work is.

**Tell it apart by:** the user talks about templates, about setting it up once,
about not wanting to fill the roster by hand every week.

### (c) A pattern on the employee record — "Ada works 1-on-1-off"

The employee page grows a working-pattern field, and the roster fills from the
person rather than from the template. Conceptually this is a **rota membership**:
a durable statement that a person works a pattern from some date, which is a new
domain object rather than a field on `Shift`.

This is the most powerful reading and the largest. It also raises questions
nothing in the codebase answers yet: what happens when the pattern changes
mid-month, does changing it rewrite already-published shifts, and does it apply
retroactively. **`clampPublishRange` exists precisely because a retroactive
publish once rewrote attendance history — do not let a pattern change do the same.**

**Tell it apart by:** *"or set it from the employee page"* is literally this, but
the user offered it as an alternative ("or"), so it may just be a second entry
point to (b) rather than a separate concept. **Ask.**

### Most likely: (a) + (b) together

The sentence covers both a roster-side repeat and attaching people to a pattern.
If the user confirms both, **build (a) first** — it is small, it ships value
immediately, and it forces you to solve the N×M assignment-check problem on a
small scale before (b) makes it a month wide.

---

## 3. The design tension that will bite

**All-or-nothing does not survive contact with a month.** The multi-select's rule
is: if anyone is blocked, write nothing and answer 409 with a per-person
breakdown. That is right for 3 people on 1 day. For 3 people over 30 days it is
90 judgements, and one overlap on day 17 would refuse all 90 rows. Nobody wants
that, and "skip the blocked ones" is probably the correct default here rather
than the opt-in it is today — but that is a **product decision, so ask**.

Related, and worth settling in the spec:

- **What is the idempotency key** when a shift is generated for a person from a
  pattern? Today it is `template@startInstant`, which cannot distinguish three
  people's shifts generated from one template on one day. It likely becomes
  `template@startInstant@employee`.
- **How far ahead does it generate?** A pattern is infinite; a roster is not.
  Either a horizon or a run-on-demand range. `MAX_GENERATION_DAYS` already exists.
- **What happens when the pattern changes?** Regenerate future only, never
  touching published or past shifts. See `clampPublishRange`.
- **N×M cost.** `assignmentContexts` batches per employee over ONE window. For 30
  days it must not become 30 round trips — plan one query over the whole range,
  then judge day by day in memory.
- **Does a generated-and-assigned shift stay `draft`?** It must. Publishing is an
  explicit act and creation never publishes.

---

## 4. Invariants not to break

- **`Shift.employee === null` means OPEN SHIFT**, still a single nullable ref.
  `0b803b8b` deliberately avoided `employees[]` on the model so that attendance's
  punch→shift match, `describeEarlyLeave`, swaps and `buildRosterLanes` keep
  working. One row per person per day. **Do not revisit this.**
- **`checkAssignment` is the ONE judge** of an assignment. `judgeAssignments`
  wraps it over N candidates and adds no rules; `FORCEABLE_CODES` (only
  `role_mismatch`) lives on the server and the browser reads `forceable` off the
  response. Do not reintroduce a client-side copy.
- **Generation is idempotent and must stay so.** Re-running a range must not
  duplicate. `skipped` must keep being reported in full.
- **Creation never publishes.** Generated rows are `draft`.
- **Retroactive writes are a known hazard.** `clampPublishRange` was added because
  a publish reaching into the past rewrote attendance history.
- **Rules live in `services/*.helpers.js`, never a controller** — the server suite
  is unit-only with no database, so anything in a controller is untested.
- **Admin tests cannot render components.** Put decisions in
  `shift-roster-utils.ts` and test those.

---

## 5. Also outstanding

- **The multi-select shipped without ever being opened in a browser.** The five
  drawer flows and a live API pass are written up in
  `.superpowers/sdd/shift-multiselect/progress.md` under "HOW TO FINISH
  VERIFYING" (gitignored, local only). **Do that first** — building on top of an
  unverified picker is how you spend a day debugging the wrong layer.
  Highest risk there: every roster edit now goes through
  `session.withTransaction`, which needs a replica set.
- **The badge backfill has still never been run.** 27 Wyn City employees have no
  badge number, 36 across all tenants:
  `node scripts/backfill-employee-badge-numbers.js [--tenant=…] --apply`,
  dry-run first.

---

## Files

- `server/models/ShiftTemplate.js` — recurrence, `cycleLength`/`cycleDays`/`anchorDate`; **no employee field**
- `server/models/Shift.js:27` — `employee`, single nullable ref; `:46` the overlap index
- `server/services/shift.helpers.js:310` — `planShiftGeneration`, idempotency on `template@start`
- `server/services/shift.helpers.js:458` — `checkAssignment`, the one judge
- `server/services/shift.helpers.js` — `judgeAssignments`, `bindEditedAssignment`, `groupAssignmentContexts`, `FORCEABLE_CODES` (all new in `0b803b8b`)
- `server/controllers/shift.controller.js` — `generateShifts` (no assignment check today), `assignmentContexts`, `readFanOut`, the fan-out create/update, `shiftAvailability`
- `server/routes/shift.routes.js` — `/generate`, `/publish`, `/availability` all declared before `/:id`
- `client/apps/admin/src/app/shared/employees/shift-roster-page.tsx` — the drawer, the checkbox picker, `fromTemplate`, the Generate modal
- `client/apps/admin/src/app/shared/employees/shift-roster-utils.ts` — `isCycleWorkDay`, `cyclePreview`, `cycleSummaryLabel`, `cycleOffsets`, `toggleCycleDay`, `mergeAvailability`, `toggleTicked`
- `client/apps/admin/src/app/shared/employees/shift-templates-*` — the template editor, where cycles are configured today
