# Attendance: multiple views + redesign

**Date:** 2026-08-13
**Screen:** `/employees/attendance`
**Status:** design approved, not implemented

## The problem

`/employees/attendance` answers exactly one question — "who punched today" — with
exactly one control surface: a day picker, an employee filter, and a table
grouped by person.

That is a good answer to the question a manager opens the page with. It is the
only question the page can answer, and three others are asked of it constantly:

1. **Who is in the building right now?** Derivable from the table, but you read
   every row to find out.
2. **Who did not turn up?** *Not derivable at all.* An absence leaves no
   record — there is nothing in the punch list to see. The screen is silent
   about the failure managers most need to know about.
3. **How many hours did each person do this week?** The page cannot express a
   range longer than a day.

The fix is not a bigger table. It is four framings of the same window, plus a
shell that makes switching between them cheap.

## What is NOT changing

- **The server.** `GET /api/attendance` already accepts arbitrary `from`/`to`
  (parsed by `shift.helpers#parseRosterRange`, capped at `MAX_GENERATION_DAYS`),
  `shiftService.roster` already returns the shifts for a range, and
  `timeOffService.list` already filters to approved. No endpoint is added and no
  handler is touched.
- **The correction rules.** A kiosk punch is still corrected, never deleted; the
  server still stamps `editedBy`; the drawer keeps its overnight and re-open
  wording. Every new view routes its edit action into the *existing* drawer.
- **The visual idiom.** Kiosk red `#b20202`, `rounded-2xl`, `border-gray-200`,
  Fraunces headings. This page has to look like the rest of `/employees`.

## Architecture

`attendance-log-page.tsx` is 679 lines today. Four views inline would put it near
2,000, so the page becomes a shell and each pane gets its own file.

```
attendance-board-utils.ts        NEW  the join, timeline geometry,
attendance-board-utils.test.ts   NEW  week aggregation, exception buckets
attendance-log-page.tsx          MOD  shell: toolbar, KPIs, view switch, drawer
attendance-log-table.tsx         NEW  the current table, lifted out unchanged
attendance-live-board.tsx        NEW
attendance-day-timeline.tsx      NEW
attendance-week-timesheet.tsx    NEW
attendance-exceptions.tsx        NEW
```

Every rule lands in `attendance-board-utils.ts`. The admin's Vitest environment
is `environment: 'node'` with no jsdom, so components cannot be rendered and any
logic worth testing has to live outside them — the same split already used by
`attendance-utils.ts` and `shift-roster-utils.ts`.

The view components stay presentational: they receive a built model and render
it. They do not fetch, and they do not derive.

## Data flow

One effect, three requests in parallel, range derived from the active view:

```
range = view === 'week'
  ? { from: startOfWeek(day), to: addDays(startOfWeek(day), 6) }
  : { from: day, to: day }

attendanceService.log({ ...range, employee })     → punches
shiftService.roster({ ...range, employee })       → the denominator
timeOffService.list({ ...range, employee, status: 'approved', scope: 'all' })
```

The employee filter is passed to **all three**, not just the punches. Filtering
only the log would leave the board joining one person's punches against
everybody's roster, and every other employee would appear as an absence.

**Why the roster is required, not decorative:** an absence is precisely the
*absence* of a record. It cannot be computed from punches at any cost. The
roster supplies the denominator, exactly as `employeeHistory` does server-side.

**Why approved leave is fetched:** without it, an excused shift reads as a
missed one, and the exceptions worklist fills with people who did nothing wrong.
A worklist that cries wolf gets ignored.

### Partial failure is not total failure

The roster and leave requests may fail independently (permissions, a flaky link)
without the punches failing. When either does:

- punches still render; the log table and the week timesheet are unaffected
- views that depend on the roster show an explicit "roster unavailable" notice
  and **do not** render an absence section

Rendering zero absences from a failed roster fetch would report good news that
was never verified. Saying nothing is worse than saying "unknown", so the page
says "unknown".

## The join — `buildAttendanceBoard`

Shift-led, not punch-led. The same shape `GET /api/attendance/employee/:id`
returns, so the day board and the per-employee history cannot tell different
stories about the same day.

```ts
export type EntryState =
  | 'in' | 'done' | 'due' | 'absent' | 'leave' | 'unrostered';

export interface BoardEntry {
  key: string;
  /** null = a punch that matched no shift. */
  shift: BoardShift | null;
  /** Punches the server matched to this shift. More than one is legal. */
  records: AttendanceRecord[];
  excused: boolean;
  state: EntryState;
  /** Non-negative; the state carries the direction. */
  lateMinutes: number;
}

export interface BoardPerson {
  employeeId: string;
  name: string;
  avatar?: string;
  entries: BoardEntry[];
  /** Closed minutes only — an open record has none yet. */
  minutesWorked: number;
  isIn: boolean;
  /** The person's headline state, worst-first across their entries. */
  state: EntryState;
  lateCount: number;
}
```

Records are matched to shifts by `refId(record.shift)`. `AttendanceRecord.shift`
arrives as an id, a populated doc, or `null` — `refId` already normalises all
three, and this is the same `id | doc | null` shape that has blanked pages in
this codebase before.

### State rules

| State | Condition |
|---|---|
| `in` | a record against this shift is `open` |
| `done` | a record against this shift is `closed` |
| `leave` | the shift overlaps an approved time-off window (checked first) |
| `due` | published shift, no record, **shift has not ended yet** |
| `absent` | published shift, no record, **shift has ended**, not excused |
| `unrostered` | a record whose `shift` is null |

Two rules mirror the server (`attendanceRating.helpers.js:89-95`) and must not
drift from it:

**Only a published shift counts.** A draft is a plan the staff have never seen.
Marking someone absent for one blames them for not attending a shift nobody told
them about.

**Only an ended shift counts.** At 10:00, nobody rostered 14:00–22:00 is absent.
A board that says otherwise has managers chasing people who are not late yet —
the fastest way to make the whole screen untrusted. `due` is the honest state,
and it is not a fault.

A person's headline `state` is the worst of their entries, ordered
`in > absent > due > unrostered > done > leave`: someone currently clocked in
reads as present even if they missed an earlier shift, because "are they here"
is the live question, and the missed shift still surfaces in Exceptions.

## The four views

### Live board

Card sections: **On the clock** / **Due in** / **Done** / **Not clocked in** /
**On leave**, counts in each heading. A card carries avatar, name, role chip,
clock-in time, the shift it answers, and a ticking elapsed.

Polls every 60s, **and only on this view**. The interval is cleared when the
view changes and when `document.hidden` goes true, and re-armed on visibility.
The other four views cost nothing in background traffic.

Elapsed is a *display* concern computed from a `now` state that ticks each
minute. It is never written back into `minutesWorked` — the server reports 0 for
an open record deliberately, so the same record does not read differently on
every refresh, and that rule stands.

### Day timeline

One lane per person. The rostered shift is a pale bar; the punch is a solid bar
drawn over it. A live "now" rule runs down the day. Late starts, early leaves
and overtime read as shape rather than as numbers to compare.

The window auto-fits the day's real extent — `min(shift starts, clock-ins)` to
`max(shift ends, clock-outs, now)`, snapped out to whole hours with a minimum
8-hour span — rather than a hardcoded 06:00–22:00, so a night shift is not drawn
off-canvas.

`barGeometry(startMs, endMs, window)` returns `{ leftPct, widthPct }` **clamped
to [0, 100]**, so a bar crossing midnight clips at the edge instead of
overflowing its lane. An open record draws to `now`, with a soft trailing edge
so it does not read as a clock-out that happened.

Absent lanes render an outlined bar labelled with the shift, not an empty row.
An empty row is indistinguishable from "no data".

### Week timesheet

Employees × 7 days. Each cell is hours worked; each row ends in a total; a
footer row totals each day.

Closed minutes only. Bucketed by the day the punch **started** (`recordDateKey`,
the existing rule) — an overnight shift belongs to the day it began, on this
screen and on the roster both.

A cell carrying a late arrival or an absence gets a small corner marker, so the
payroll framing still shows the exceptions rather than laundering them into an
hours figure.

### Exceptions

A worklist, ordered by how much it needs a human:

1. **Still open from a previous day** — a record nobody closed. It is silently
   scoring 0 minutes and will keep doing so.
2. **Absent** — published, ended, unexcused, no punch.
3. **Late**
4. **Left early**
5. **Unrostered punch** — reported, never scored.

Every row opens the existing correction drawer. This is the view where work
actually gets done, so the action is on the row, not behind a navigation.

## Shell

**Header** — unchanged in structure: icon, title, subtitle, "Open the kiosk",
"Add by hand".

**Toolbar** — one row holding a segmented view switcher (Live · Timeline · Log ·
Week · Exceptions), the date nav whose label adapts day↔week, Today, the
employee filter, and refresh.

**KPI cards** — the cramped right-aligned stat strip becomes a card row:
**On the clock · Attendance % · Hours · Late · Absent**. Attendance % and Absent
render as "—" when the roster is unavailable, never as 100% and 0.

**URL state** — `?view=` and `?date=` via `useSearchParams` + `router.replace`,
so a manager can send someone a link to the exceptions list. An unrecognised
`view` falls back to the live board rather than rendering nothing.

The existing `withoutPin` warning banner and the correction drawer are unchanged
and shared by every view.

## Testing

Vitest, `environment: 'node'`, pure utils only — no component rendering.
`attendance-board-utils.test.ts` covers:

- the join is shift-led: a published, ended shift with no record still produces
  an entry
- a **draft** shift with no record produces no absence
- a published shift that has **not ended** is `due`, never `absent`
- a shift overlapping approved leave is `leave`, and outranks `absent`
- a record with `shift: null` lands in `unrostered`, and is excluded from the
  absence reckoning
- `refId` normalisation: `shift` as id-string, as populated doc, and as null all
  join correctly
- headline state ordering: someone `in` now with an earlier missed shift reads
  `in`, and the missed shift still appears in the exception buckets
- timeline geometry clamps a bar crossing the window edge to [0, 100]
- the timeline window honours its 8-hour minimum on a day with one short shift
- week aggregation sums **closed** minutes only, and buckets by the punch's
  start day
- exception ordering puts a stale open record above a late arrival

Baselines to hold: admin Vitest **635/635** before this work, admin
`./node_modules/.bin/tsc --noEmit` source-only **453** (`.next/` excluded —
`npx tsc` in this package installs a decoy `tsc@2.0.4` that checks nothing).

## Out of scope

- Department / role filters on this screen. The log's records carry no
  department; only the roster does. Adding it means filtering two datasets by
  different keys, and nobody has asked.
- Export to CSV/XLSX from the week timesheet.
- Editing shifts from the timeline. The roster owns that.
- Any change to the kiosk, the badge, or the per-employee history page.
