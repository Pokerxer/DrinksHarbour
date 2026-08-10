# RESUME: cycle recurrence for shift templates (one day on, one day off)

Written 2026-08-10. Nothing for this task has been built yet — this is the
whole brief. Everything it builds on is **committed** as of `678b2abd`.

Paste the "Prompt" section below into a fresh session.

---

## Prompt

> In `/Users/mac/Documents/drinksharbour`, shift templates can only repeat on
> days of the week, so a rotation like "one day on, one day off" cannot be
> expressed. Add cycle recurrence to the shift template model and the roster
> generator, so N-days-on / M-days-off patterns generate correctly over any
> range. Read `docs/superpowers/specs/RESUME-shift-cycle-recurrence.md` first —
> it has the analysis and the invariants. TDD, and don't commit unless I ask.

---

## Why `daysOfWeek` cannot do this

`ShiftTemplate.daysOfWeek` is `[0..6]` and `planShiftGeneration`
(`services/shift.helpers.js:207`) matches it against `dayOfWeek(dateISO)`.

**A cycle whose length does not divide 7 changes phase every week.** One-on/
one-off worked Mon/Wed/Fri becomes Sun/Tue/Thu the following week, then
Mon/Wed/Fri again. The same is true of 4-on/4-off and 2-on/3-off. No set of
weekday flags can express any of them — this is a second *kind* of recurrence,
not a configuration of the existing one.

## The shape to add

```
recurrence:  'weekly' | 'cycle'   // default 'weekly'
cycleLength: Number                // 2 = one on, one off
cycleDays:   [Number]              // offsets within the cycle that are worked
anchorDate:  'YYYY-MM-DD'          // what pins the phase
```

`weekly` keeps reading `daysOfWeek` and must behave **exactly** as today —
every existing template keeps generating the roster it already generates.

### The anchor is the load-bearing part

Without a stored origin date, "day 0 of the cycle" is undefined for an
arbitrary range. Worse, **`planShiftGeneration` is deliberately idempotent** —
its own comment says re-running over a partly-generated range tops it up
instead of duplicating. If the phase were derived from the range start,
generating March and then April would land on different phases and the top-up
guarantee would break, silently producing shifts on the wrong days.

Anchoring to a stored date makes the worked/off decision a **pure function of
the calendar date**, so any range generates identically regardless of when, in
what order, or how many times it is run.

The rule is roughly:

```
worked(date) = cycleDays.includes(floorMod(daysBetween(anchorDate, date), cycleLength))
```

`floorMod`, not `%` — JavaScript's `%` returns a negative for dates **before**
the anchor, and a manager backfilling last month's roster is an ordinary thing
to do.

## Invariants to encode

1. `weekly` templates are untouched — assert this with a test, not by reading.
2. `cycleLength >= 1`; `cycleDays` entries are integers in `0..cycleLength-1`,
   de-duplicated and sorted. `normaliseDaysOfWeek` (`shift.helpers.js:469`) is
   the pattern to copy — it exists because an unsorted list with repeats
   generated the same shift twice.
3. Empty `cycleDays` generates nothing. It is not "every day".
4. Dates before the anchor still resolve (see `floorMod` above).
5. Generation stays idempotent across overlapping and repeated ranges.
6. `anchorDate` is a local date key, like the rest of the roster. Times are
   local wall-clock; only `Shift` holds absolute instants.

## Where to work

- `server/services/shift.helpers.js` — new tested `isCycleWorkDay` +
  `normaliseCycle`; `planShiftGeneration` (line ~207) branches on `recurrence`;
  `buildShiftTemplatePayload` (line ~487) validates the new fields.
- `server/models/ShiftTemplate.js` — the four fields. Enums import from
  `shift.helpers.js`, never redeclared — the model comment says why.
- `server/__tests__/shift.helpers.test.js` — extend.
- `client/apps/admin/src/services/shift.service.ts` — types.
- `client/apps/admin/src/app/(hydrogen)/employees/shifts/templates/page.tsx` —
  a recurrence toggle, cycle length, which days, and the anchor date picker.
  Show a preview of the next ~14 generated days; a cycle is hard to picture and
  getting the anchor wrong is invisible until the roster is generated.

## Gotchas that will bite

- **Server tests:** `node --test '__tests__/*.test.js'`. `npm test` is broken.
  Baseline **1811/1814** — the 3 failures are pre-existing (1 pricelist
  tenant-scope, 2 SO-number) and are not yours.
- **Admin typecheck:** `./node_modules/.bin/tsc --noEmit` from
  `client/apps/admin`. **Never `npx tsc`** — it installs a decoy `tsc@2.0.4`
  that prints "This is not the tsc command you are looking for" and exits 0.
  Baseline **464** errors, all pre-existing.
- **Admin tests are Vitest with `environment: 'node'`** — no jsdom, components
  cannot be rendered. Pure logic only.
- ESLint 9 cannot run in this repo at all (no flat config). Pre-existing.

## Downstream that reads the roster

The attendance rating (`services/attendanceRating.helpers.js`, committed in
`678b2abd`) uses **published, already-ended shifts as its denominator**. Once
cycles generate real rosters, a wrong anchor doesn't just misplace shifts — it
invents absences and marks people down for days they were never meant to work.
Worth a sanity check on one employee's rating after the first cycle roster is
generated.
