# Employee attendance history + rating

Written 2026-08-10. Builds on the attendance module (kiosk, log, corrections)
and the roster. Uncommitted on `main` unless asked otherwise.

## The problem

`summariseAttendance` counts punches. An employee who never turned up has no
punches, so a rating built on records alone scores an absentee **perfectly**.

A fair rating needs the **roster as the denominator**: `Shift` rows the person
was expected to work, matched against the `Attendance` rows they produced.

## Scope

A per-employee history page with a derived 0–100 rating, at
`/employees/attendance/[employeeId]`.

## The rating is derived, never stored

Computed on read from `Shift` + `Attendance` + `TimeOffRequest`. A stored score
goes stale the moment a manager corrects a punch, and correcting punches is a
first-class feature of this module.

## Server

New module `services/attendanceRating.helpers.js`. Kept out of
`attendance.helpers.js`, which owns *punch* rules and is already 260 lines.
Pure — no DB, no Express — and unit-tested directly, same split as its
neighbours.

### Building blocks

- `pairShiftsWithAttendance(shifts, records, now)` — each **countable** shift
  paired with the record that matched it, or `null`. Countable =
  `status === 'published'` **and** `end <= now`. A draft roster is invisible to
  staff, so nobody can fail to attend it; a shift still running is not a
  no-show.
- `isExcused(shift, timeOff)` — delegates to the existing
  `shift.helpers#overlapsTimeOff`, which already filters to `approved` and
  compares half-open.
- `describeDeparture(record, shift, opts)` — the mirror of
  `describePunctuality` for the other end of the shift:
  `no_shift | open | early | on_time | overtime`, minutes always non-negative.
- `rateAttendance({ shifts, records, timeOff }, opts)` — the whole picture.

### Components and weights

| Component | Weight | Numerator ÷ denominator |
|---|---|---|
| Attendance | 40 | attended ÷ expected (expected = countable − excused) |
| Punctuality | 30 | `on_time` + `early` arrivals ÷ attended |
| Completeness | 15 | records closed ÷ attended |
| Duration | 15 | did not leave early ÷ attended-and-closed |

Bands: `excellent` ≥ 90, `good` ≥ 75, `fair` ≥ 60, else `needs_attention`.

### Invariants

1. **Excused absences leave the denominator entirely.** Approved leave is not a
   shift somebody failed to attend.
2. **A component with no denominator is `null`, not 0**, and the score
   renormalises over the components that do apply — the same rule the appraisal
   module uses for `pct`. Nobody rostered is *unrated*, not zero.
3. **Overtime is reported, never scored.** Staying late is not a fault, so it
   cannot deduct — and it must not add credit either, or the clock becomes
   something to pad. Only leaving early deducts. Overtime is shown as hours.
4. **Only shifts whose end is past count.** (Encoded in `pairShiftsWithAttendance`.)
5. **A corrected record still counts as attended** — a manager's fix is the
   truth of what happened — but a record left `open` costs completeness.
6. **Unrostered punches never hurt.** A punch matching no shift is reported
   separately and is not a rating input.

### Endpoint

`GET /api/attendance/employee/:employeeId?from=&to=`
→ `{ employee, range, rating, timeline[], summary }`

Behind the existing `tenantAdminOrSuperAdmin` guard — this is the manager's
view, not a self-service one. Declared before `/:id`.

## Client

The server does the arithmetic; the client only formats. One definition of the
rule, no second copy to drift.

- `app/shared/employees/attendance-rating-utils.ts` (+ tests) — band label and
  tone, component rows, minute formatting.
- `app/shared/employees/attendance-history-page.tsx` — range picker, rating
  card with the component breakdown visible, per-shift timeline (rostered vs
  actual, late/early by how much, overtime), and the raw punches.
- Route `app/(hydrogen)/employees/attendance/[employeeId]/page.tsx`. `/kiosk`
  is a static segment and still wins over the dynamic one.
- Linked from the log rows and the employee record.

## Testing

- `server/__tests__/attendanceRating.test.js` — node:test, TDD.
- `attendance-rating-utils.test.ts` — Vitest, `environment: 'node'`, so pure
  helpers only; components cannot be rendered.
