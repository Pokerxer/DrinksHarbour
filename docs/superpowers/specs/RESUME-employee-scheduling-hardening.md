# RESUME: kiosk crash + a functional pass over employee scheduling

Written 2026-08-10. Paste the "Prompt" section into a fresh session.

---

## Prompt

> In `/Users/mac/Documents/drinksharbour`, the attendance kiosk crashes and the
> scheduling modules have never been exercised for real. Two jobs, in order:
>
> 1. **Fix the kiosk crash.** `/employees/attendance/kiosk` falls through to the
>    error boundary ("Something went wrong / Try again") and the console shows
>    `Cannot stop, scanner is not running or paused.` Reproduce it first, then
>    fix it.
> 2. **Go through the functionality and logic** of the roster, shift templates,
>    attendance + clock kiosk, time off and shift swaps — end to end, as a
>    working system rather than six separate screens.
>
> Read `docs/superpowers/specs/RESUME-employee-scheduling-hardening.md` first —
> it has the diagnosis so far, the invariants not to break, and the baselines.
> TDD. Don't commit unless I ask.

---

## 1. The kiosk crash

**Symptom.** The page renders the app's error boundary (`src/app/error.tsx`),
not a blank camera. Console: `Cannot stop, scanner is not running or paused.`
That string is html5-qrcode's, raised by `Html5Qrcode#stop()` when the instance
is not in a SCANNING or PAUSED state.

**Prime suspect** — `client/apps/admin/src/app/shared/employees/kiosk-scan-view.tsx:108`:

```js
return () => {
  disposed = true;
  scanner
    ?.stop()
    .catch(() => {})
    .finally(() => scanner?.clear());
};
```

The `.catch()` only handles a *rejected promise*. `stop()` raises for a scanner
that was constructed but never successfully started, and if that raise is
synchronous it escapes the cleanup function entirely — React then surfaces it
and the boundary takes the page down. The window is real and easy to hit: the
effect constructs the scanner, then `await`s `getCameras()` and `start()`, so
between `new QR(...)` (line 69) and `await scanner.start(...)` (line 88) the
instance exists and is not running. React 18 StrictMode mounts, unmounts and
remounts in dev, which lands squarely in that window every time.

**This is a hypothesis, not a verified root cause — reproduce before fixing.**
Confirm which of these is true rather than assuming:

- Is the throw synchronous or a rejection in the installed html5-qrcode version?
  Check `node_modules/html5-qrcode` for the `stop()` implementation and the
  exact state guard.
- Does it also happen in a production build, or only under StrictMode?
- Does the crash happen on unmount only, or also on the camera-permission-denied
  path (`onErrorRef.current()` at line 84/102)?

**The shape of the fix** (once confirmed): guard on the scanner's own state
(`getState()` against `Html5QrcodeScannerState`) instead of on the variable
being non-null, wrap the teardown in `try/catch` so cleanup can never throw, and
handle the in-flight-start race — if `disposed` flips while `start()` is still
awaiting, stop it *after* it resolves rather than leaving a camera running.

**Do not regress the double-punch work** (committed in `678b2abd`, see
`memory/attendance_kiosk_double_punch.md`): html5-qrcode fires the success
callback once per decoded frame at `fps: 10`, so a badge held up to the lens
clocked in and straight back out for a 0-minute shift. The guard is two-layer —
server `MIN_PUNCH_INTERVAL_SECONDS=60` plus a client `SCAN_COOLDOWN_MS` deduped
**by code** — and `pushScanKey` must keep ignoring modifier keys, because Shift
was truncating every uppercase badge. Any rewrite of the scanner lifecycle has
to keep all three.

---

## 2. The functional pass

### The one fact that changes how you should approach this

**None of these modules has ever been used in production.** Verified against
Atlas on 2026-08-10: the Wyn City tenant has **0 shifts, 0 shift templates and
0 attendance records** (39 employees and 6 roles do exist). So:

- there is no data to migrate and no roster anyone is relying on;
- correspondingly, **nothing has been validated against reality** — every rule
  in these modules is as-designed, never as-observed;
- a bug here is currently free to fix and will stop being free the moment the
  first real roster is published.

Treat it as a system about to be switched on for the first time, and prefer
finding the gaps between the modules over polishing any one of them.

### Where the seams are

The modules are individually tested but barely tested *against each other*.
Worth pulling on, roughly in order of how much damage each would do:

- **Roster → attendance → rating.** `attendanceRating.helpers.js` uses
  published, already-ended shifts as its denominator, so what the roster
  generates decides what someone is marked down for. Cycle recurrence
  (`d1518083`) was sanity-checked end to end on 2026-08-10 and the denominator
  was exactly the cycle's worked days — but that was a synthetic run that
  deleted itself. Nobody has watched a real week flow through.
- **Time off vs generation.** `TimeOffRequest` is half-open `[start, end)`.
  Generation does not consult time off at all — `checkAssignment` blocks
  *assignment* over approved leave, but `planShiftGeneration` will happily
  create an open shift on a day the only qualified person is away. Decide
  whether that is correct (an open shift someone else can cover) or a gap.
- **Swaps.** Only an `approved` swap writes `Shift.employee`. Check what happens
  to a swap whose underlying shift is later cancelled, re-generated, or moved.
- **Publish semantics.** A published shift can only be cancelled, never
  un-published — staff have been told. Check every path that mutates a shift
  respects that, especially bulk operations and re-generation.
- **Open shifts.** `Shift.employee: null` is a value, not missing data. Check
  the rating, the roster summary and the swap flow all treat an unfilled shift
  as unfilled rather than as an absence or an error.

### Where to work

Server (`/Users/mac/Documents/drinksharbour/server`):
- `services/shift.helpers.js` — generation, overlap, assignment, cycles
- `services/attendance.helpers.js`, `services/attendanceRating.helpers.js`
- `services/timeOff.helpers.js`
- `controllers/{shift,attendance}.controller.js`
- `models/{Shift,ShiftTemplate,Attendance,TimeOffRequest}.js`
- `__tests__/shift.helpers.test.js`, `shift.payloads.test.js`,
  `attendance.helpers.test.js`, `attendanceRating.test.js`

Admin (`/Users/mac/Documents/drinksharbour/client/apps/admin/src`):
- `app/shared/employees/` — `attendance-kiosk-page.tsx`, `kiosk-scan-view.tsx`,
  `kiosk-pin-pad.tsx`, `kiosk-confirmation.tsx`, `attendance-log-page.tsx`,
  `attendance-history-page.tsx`, `shift-roster-page.tsx`, `shift-swaps-page.tsx`,
  `time-off-page.tsx`, plus the `*-utils.ts` files that hold the testable logic
- `app/(hydrogen)/employees/…` — the routes: `attendance/kiosk`,
  `attendance/[employeeId]`, `shifts`, `shifts/templates`, `swaps`, `time-off`
- `services/{shift,attendance,orgStructure}.service.ts`

---

## Invariants not to break

From memory files, each of which was written because something broke:

- **Rules live in `services/*.helpers.js`, never in a controller.** The
  controller does IO; anything decidable from the request body is decided and
  unit-tested in the helper.
- **`Shift.employee` NULL = an open shift**, by design — the roster is drafted
  first and filled after.
- **`TimeOffRequest` is half-open `[start, end)`.**
- **Only an `approved` swap writes `Shift.employee`.**
- **`resolveAppraisalAccess` fails closed for `tenant_admin`** (adjacent module,
  but the same employee data — load scope only via `appraisalScope.service.js`).
- **Attendance: the ROSTER is the denominator.** An earlier `summariseAttendance`
  counted punches, so a no-show read as a clean sheet. Empty denominator is
  `rate: null` and band `unrated`, never 0. Excused leave leaves the reckoning
  entirely. Overtime is reported, never scored.
- **Cycle recurrence:** the stored `anchorDate` is what keeps generation
  idempotent; `floorMod`, not `%`; empty `cycleDays` generates nothing and is
  not "every day"; switching a template back to `weekly` clears the cycle.
  The admin mirrors `isCycleWorkDay` in `shift-roster-utils.ts` — if you change
  one copy, change both or the form's preview lies.

## Gotchas

- **Server tests:** `node --test '__tests__/*.test.js'` from `server/`.
  `npm test` is broken. Baseline **1835/1838** as of 2026-08-10 — the 3 failures
  are pre-existing (1 pricelist tenant-scope, 2 SO-number) and are not yours.
- **Admin tests:** `npx vitest run` from `client/apps/admin`. Baseline
  **534/534**. Vitest runs with `environment: 'node'` — **no jsdom, components
  cannot be rendered**, so pure logic has to be extracted into `*-utils.ts` to
  be testable. This is why every screen has a utils file.
- **Admin typecheck:** `./node_modules/.bin/tsc --noEmit`. Baseline **464**
  errors, all pre-existing. **Never `npx tsc`** — it installs a decoy
  `tsc@2.0.4` that prints "This is not the tsc command you are looking for" and
  exits 0, i.e. a typecheck that checked nothing.
- **ESLint 9 cannot run in this repo at all** (no flat config). Pre-existing.
- **Atlas is reachable from this Mac.** Backend runs locally on `:5001`. Any
  script that writes to it is writing to live data — tag what you create and
  delete it in a `finally`.

## Open deployment item

The admin app has **not had a successful production build since `6084f024`**.
Two commits since then touched its Vercel config:

- `fb0dbd7a` — pointed the ignored build step at `VERCEL_GIT_PREVIOUS_SHA` (the
  last *successful* deploy) instead of `HEAD^`, which had been skipping any app
  whose changes were not in the tip commit. That deployment **failed schema
  validation**: `ignoreCommand` must be ≤ 256 characters and the guard clause
  pushed it over. It shows as ERROR with **no build logs at all**, which looks
  like a build crash and is not one.
- `580ad790` — shortened it (admin 232 chars, platform 217) using `|| exit 1` to
  normalise every failure onto "build". **Not yet verified.**

So: confirm the admin build actually goes green, and that the shift-cycle UI
from `d1518083` is live, before assuming any admin-side fix has shipped.
