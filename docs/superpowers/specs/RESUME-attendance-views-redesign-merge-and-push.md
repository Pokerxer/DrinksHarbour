# RESUME — Attendance views redesign: merged, pushed, and the leftovers

**Branch:** `feat/attendance-views-redesign` — 12 commits, `47001320..9bc4308d`
**Status:** **MERGED `--no-ff` and PUSHED 2026-08-14** — `1d8dc2fa..6ad3afc6` on `main`
**Plan:** `docs/superpowers/plans/2026-08-13-attendance-views-redesign.md`

## State: all code done and integrated

Tasks 1–10 of the plan are implemented and committed, plus one post-plan
refactor. The merge is `6ad3afc6`; `origin/main` and local `main` are level.

```
9bc4308d refactor(attendance): one shift-window label, not four copies of an en-dash
0d1c3bdc feat(attendance): an exceptions worklist ordered by what needs a human
83538d54 feat(attendance): a week timesheet the day view could never express
54fce3cf feat(attendance): draw the day as lanes so lateness reads as shape
5f4f3983 feat(attendance): a live board answering who is in right now
f0db545f feat(attendance): fetch the roster alongside the punches and switch views
775b8389 refactor(attendance): lift the log table out of the page unchanged
80250237 feat(attendance): fit the timeline window to the day and clamp its bars
6ab9b270 feat(attendance): aggregate a week of punches into a timesheet grid
82066cc3 feat(attendance): order the exceptions worklist by what needs a human
4e62962b fix(attendance): a shift that has not run yet is not owed attendance
47001320 feat(attendance): join punches to the roster so an absence can be seen
```

**Verified (all green, re-verify only if you change code):**
admin vitest **755/755** (39 files) · source-only tsc **453** · `npm run build`
completes · all five views returned `200` from the smoke route · prettier clean
on the six attendance files · ESLint clean on the four panes. Vitest was re-run
on the merged result and stayed at 755/755.

## 1. The merge and push — DONE

Pre-flight was re-run immediately before merging and both checks were clean
(`origin/main...main` = 0/0; branch 12 ahead, 0 behind). Merged with the repo's
`--no-ff` convention (cf. `1d8dc2fa`, the multi-role-templates merge) and pushed:

```
1d8dc2fa..6ad3afc6  main -> main
```

The diff is admin-only (9 files, +2795/−212), so the server suite was not
implicated. The push authorisation was re-confirmed with the user before the
push, since the original approval came from a session that had ended.

## 2. The branch is UNREVIEWED past Task 1 — flagged twice, merged anyway

Only Task 1 ever got a review gate. Tasks 2–10 and the `9bc4308d` refactor have
**never been reviewed**. The user was told this twice and chose to merge; that
is their call and it is not a blocker. But it matters for what to do next,
because **three separate defects were found in the plan's own code** during
implementation — the plan was not trustworthy, and nothing has re-checked the
parts a human never read:

1. `isExcused` matched leave to shifts by date overlap alone — one person's
   approved leave excused **everybody's** shift that day. Fixed in Task 2.
2. `due` shifts counted in the attendance denominator — the KPI read 50% at
   10:00 when nothing was wrong. Fixed in `4e62962b`.
3. Task 4's first `timelineWindow` test expected `07:00`/`17:00` and **forgot
   the +60 tenant offset**. The window snaps to whole UTC hours and
   `toLocalTimeLabel` then adds the hour, so the labels are `08:00`/`18:00`.
   The implementation was right; the expectations were wrong. Corrected in
   `80250237`.

A whole-branch review of `1d8dc2fa..9bc4308d` is the highest-value remaining
work. After merging it is a review of `main`, not of a branch — same diff,
different blast radius if something is found.

## 3. Ledger — CORRECTED

`.superpowers/sdd/progress.md` had gone stale ("Task 1: complete", baseline
"635/635"). It has been rewritten to record all 10 tasks plus the refactor, the
true pre-branch baseline of **713**, the final **755**, and the merge. Note that
`.superpowers/` is **gitignored**, so that ledger is local-only and never
reached `main` — it misleads the next session, not the repo.

Note `.superpowers/sdd/task-*-report.md` are from the PRIOR project
(multi-role shift templates), not this one. Don't read them as this branch's.

## 4. The untracked doc set

```
docs/superpowers/plans/2026-08-13-attendance-views-redesign.md
docs/superpowers/specs/2026-08-13-attendance-views-redesign-design.md
docs/superpowers/specs/RESUME-cannot-seat-seven-on-attendants-shift-1.md
docs/superpowers/specs/RESUME-attendance-views-redesign-merge-and-push.md  (this file)
```

`docs/superpowers/` IS a tracked directory (113 files), so these are an
omission, not a policy. A fifth file, `RESUME-...-tasks-3-10.md`, **has been
deleted**: it claimed Tasks 3–10 were not started, which would have put a
misleading document on `main`. Everything in it that still mattered — the plan
defects and the tooling traps — is preserved here and in the ledger.

## 5. Settled — do not re-litigate

`shiftWindowLabel(shift, offsetMinutes)` now lives in
`attendance-board-utils.ts` and all four panes call it (`9bc4308d`). The
argument for extracting was not line count: both parts that can drift are
invisible when they do — the offset must be applied to **both** ends, and the
separator is an **en-dash, not a hyphen**. Two of its four tests guard exactly
that.

**Deliberately NOT folded in:** `attendance-day-timeline.tsx`'s *punch* window
with its `'still in'` open end. A punch's end may not have happened yet — a
different rule. Routing it through would need a second parameter and make the
helper about two things.

## The rule that must not drift

Absence semantics mirror `server/services/attendanceRating.helpers.js:89-95`
exactly: **only a `published` shift that has already ENDED can be an absence.**
A draft never produces one; a shift still to run is `due`, not `absent`. If
this drifts, the board and the per-employee rating disagree about the same day.

## Tooling traps (these cost real time)

- **`npx tsc` in `client/apps/admin` installs a DECOY `tsc@2.0.4`** that prints
  "This is not the tsc command you are looking for" and **exits 0**. Always
  `./node_modules/.bin/tsc`.
- **The tsc count is contaminated by `.next/`.** Measure source-only:
  `./node_modules/.bin/tsc --noEmit 2>&1 | grep "error TS" | grep -vc "\.next/"` → **453**.
- **Vitest is `environment: 'node'`, no jsdom — components CANNOT be rendered.**
  Every rule lives in `attendance-board-utils.ts`; the panes' gate is typecheck
  plus the smoke route.
- **The smoke route trick:** admin auth is middleware with an explicit PATH-LIST
  matcher (`src/middleware.ts`), so a route *outside* that list renders a gated
  component with no login. Create `src/app/smoke-x/page.tsx`, curl it,
  **delete it before committing** — it must never be committed.
- **Measure SERIALLY** — parallel curl against this stack fakes 90s timeouts.
- **`npx prettier --write "src/app/shared/employees/attendance-*"` also
  reformats three files this branch never touched** — `attendance-history-page.tsx`,
  `attendance-kiosk-page.tsx`, `attendance-utils.test.ts`. Revert those before staging.
- **`kiosk-devices-page.tsx` and `kiosk-device-utils.test.ts` are dirty from
  unrelated earlier work.** Never stage them; never `git add` the directory broadly.
