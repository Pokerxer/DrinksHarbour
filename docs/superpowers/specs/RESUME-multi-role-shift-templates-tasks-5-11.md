# RESUME: multi-role shift templates — Tasks 5–11

Written 2026-08-13. Handoff from the session that built Tasks 1–4.

**Read §1 first — there is one uncommitted, unverified edit in the tree and it
must be settled before anything else.**

The original handoff, `RESUME-multi-role-shift-templates.md`, is now **stale for
its §2** (the three-way ambiguity is resolved — see §3 below) but **still
accurate for its §4/§5** (things that bite, invariants). Read those two sections;
skip the rest of it.

---

## 0. Why this session exists

The previous session stopped mid-fix on cost, at **$70.08**. Tasks 5–11 are the
larger half of the work — two client UI surfaces plus a final whole-branch
review on the most capable model. Expect this session to cost more than the
last one. That is the human's call, not yours; it is recorded here so nobody is
surprised.

---

## 1. FIRST: the uncommitted edit

`git status` shows one modified file: `server/services/shift.helpers.js`.
**The change is complete and coherent but was never run.** Verify it, then
commit it, before starting Task 5.

### What it is

Task 4's reviewer raised one Important finding. Inside `planPatternFill`, the
`position_full` capacity cap was guarded by `pos._id &&`. That guard works only
because `templatePositions`'s legacy fallback happens to emit `_id: null` —
nothing in that function's contract promises "null `_id` means no cap". A
hand-built template object, or a future caller, could supply a declared position
without an `_id` and silently lose its cap.

The rule itself is correct and must be preserved: **the capacity cap binds
declared crew positions only, never the synthesized legacy one.** A legacy
template (no `positions`, only `role`) normalises to
`[{_id: null, roles: [role], count: 1}]`; capping that at 1 would seat one person
and refuse the rest on every pre-existing pattern, breaking the multi-person fill
that shipped in `f91201bb` two days ago. Eight pre-existing `planPatternFill`
tests depend on the uncapped legacy behaviour.

The edit swaps the *discriminator*, not the rule:

- Added, once, just after `const seats = normaliseSeats(...)` in
  `planPatternFill`, with a comment explaining the legacy exemption:
  ```js
  const hasDeclaredPositions =
    Array.isArray(template.positions) && template.positions.length > 0;
  ```
- Cap guard changed from `pos._id && (filled.get(capKey) || 0) >= pos.count`
  to `hasDeclaredPositions && (filled.get(capKey) || 0) >= pos.count`
- The old comment at the cap site was removed (it now lives on the constant)

### Verify it

```bash
cd /Users/mac/Documents/drinksharbour/server
node --test __tests__/shift.helpers.test.js
```
Expect **127/127**. The ones that matter both ways: the 8 pre-existing
`planPatternFill` tests (they must still seat several people on a legacy
pattern) and the new `refuses a seat on a position that is already full` /
`counts rows already on the position toward the cap`.

Then the full suite:
```bash
cd /Users/mac/Documents/drinksharbour/server
node --test '__tests__/*.test.js' 2>&1 | tail -20
```
Expect **2001 pass / 2004 total, `# fail 3`**.

If it passes, commit on the current branch (**never push**) and append a line to
the ledger closing Task 4. If it fails, the diagnosis above is still sound —
debug the discriminator, do not restore the cap on legacy templates.

### Also do

The spec never recorded this exemption. Amend
`docs/superpowers/specs/2026-08-12-multi-role-shift-templates-design.md` §6.1 —
which currently reads as "one cap, one place" — to say that a template with no
declared `positions` is deliberately uncapped, and why (`f91201bb`'s contract).

---

## 2. State of the tree

Branch **`feat/multi-role-shift-templates`**, cut from `main` at `f91201bb`.
**`main` is untouched. Nothing has been pushed. Never push.**

```
6189c0e7  Task 4  fill a pattern by seating people into crew positions   2001/2004
019487a9  Task 3  a shift may accept any of several roles                1994/1997
3e7dae91  Task 2  generate one open shift per crew position              1988/1991
32ad3f48  Task 1  a shift template can describe a crew of positions      1978/1981
4ecde984  docs    spec and plan
f91201bb  (main)  fill a repeating pattern for several people at once
```

`# fail 3` at every commit — the same three pre-existing failures (1 pricelist
tenant-scope, 2 SO-number). They were failing before this branch existed.

**Baselines to hold:** server `# fail 3`; admin vitest **684/684**; admin tsc
**456** errors, all pre-existing.

### Test commands — the traps

- **`npm test` is BROKEN.** Use `node --test '__tests__/*.test.js'` from
  `server/`.
- **NEVER `npx tsc` in `client/apps/admin`** — it installs a decoy `tsc@2.0.4`
  that prints "This is not the tsc command you are looking for" and **exits 0**,
  so a typecheck that verified nothing looks like a pass. Use
  `./node_modules/.bin/tsc --noEmit`.
- Admin tests are Vitest with `environment: 'node'` — **no jsdom, components
  cannot be rendered.** Anything worth testing must live in a `*-utils.ts`.
  This is why Task 7 exists.

---

## 3. What was decided (the ambiguity is resolved)

The request — "I should be able to select more than one role" — was ambiguous
three ways. The human chose the **largest** reading, both halves:

> A template describes a **crew of positions**, each with a **count**, and each
> position accepts **any of several roles**.
> *"1× Bartender OR Barback, 2× Server OR Runner."*

And, for the fill drawer: **the admin picks which position each person fills**,
explicitly. No auto-assignment.

Consequences, all already built in Tasks 1–4:

- `ShiftTemplate` gained `positions: [{ roles: [ObjectId], count: Number }]`.
  `role` **stays `required: true`** as the mirrored display role — hence no
  migration script.
- `Shift` gained `altRoles: [ObjectId]` and `templatePosition: ObjectId`.
  `Shift.role` is unchanged and still single. **`Shift.employee === null` still
  means open shift, one row per person per day. Do not revisit this.**
- Idempotency keys are **position-`_id` based**, not derived from the role set.
  This was a deliberate correction: a role-signature key would rekey — and
  therefore duplicate — every already-generated day the moment somebody edited a
  position's roles.

Full design: `docs/superpowers/specs/2026-08-12-multi-role-shift-templates-design.md`

---

## 4. What remains

Plan: `docs/superpowers/plans/2026-08-12-multi-role-shift-templates.md`
(complete TDD code in every step — the tasks below are line references into it)

| Task | Line | What |
|---|---|---|
| 5 | 1087 | Payload builders validate positions — **and implement the `role` mirror** |
| 6 | 1295 | Controller wiring |
| 7 | 1431 | `shift-position-utils.ts` — all the arithmetic the UI needs |
| 8 | 1668 | Client types |
| 9 | 1756 | The template editor's positions list |
| 10 | 1907 | The fill drawer's position dropdown |
| 11 | 1993 | End-to-end verification |

Two of these carry a trap the plan already handles — **do not "simplify" them**:

- **Task 5** owes the mirror. Task 1's reviewer flagged a comment claiming
  `role` is "mirrored on save" when nothing mirrored it yet; the controller
  deferred it here. `role` must end up as `positions[0].roles[0]`.
- **Task 6 Step 4** exists because **Mongoose mints new `_id`s for subdocuments
  on a `$set` of the whole `positions` array.** New `_id`s mean new idempotency
  keys, which means every future generation duplicates every already-generated
  day. Follow that step exactly.

### Task 0 was never run

Task 0 (line 47) is a browser baseline of `f91201bb`'s fill drawer, which **has
never been opened in a browser** and has zero automated coverage. The human
chose to proceed without it. It gates Tasks 9/10: without it, a bug you
introduce in the fill drawer and a bug that was already there are
indistinguishable. **Resolve this with the human before Task 10** — run it, or
get it explicitly accepted as skipped and say so in the final review.

### Minor findings carried to the final review

Point the final reviewer at these; it triages which must be fixed before merge.

- Task 1: no test for `positions` non-empty but all entries filtered out **and**
  `role` set (falls through to the legacy fallback correctly, just unasserted).
- Task 1: `templatePositions` lower-clamps `count` to 1 but has no upper clamp;
  the schema caps at 20, so this is only reachable via a non-persisted template
  object.
- The §1 fix above, once landed: confirm the spec amendment went in.

---

## 5. How to execute

Use **`superpowers:subagent-driven-development`**. The human chose it, and
Tasks 1–4 were built that way: fresh implementer subagent per task, task review
(spec compliance + code quality) after each, one broad whole-branch review at
the end on the most capable model.

- **Ledger:** `.superpowers/sdd/progress.md`. Tasks listed complete there are
  DONE — trust it and `git log` over recollection. Append a line per clean
  review.
- **Briefs and reports:** `.superpowers/sdd/task-N-brief.md` /
  `task-N-report.md`, produced by the skill's `scripts/task-brief` and
  `scripts/review-package`. Hand subagents **file paths**, never pasted plan
  text. Do not paste prior-task history into later dispatches.
  - `.superpowers/sdd/archive-pre-2026-08-12/` holds unrelated briefs from
    August 3–4 appraisals work. A Task 1 reviewer read one and got confused.
    **Ignore that directory.**
- **Never `HEAD~1`** for a review package base — record the base commit before
  dispatching each implementer. Task 4 was multi-commit.
- **Model selection matters.** Tasks 5, 6, 8 are close to transcription — cheap
  tier. Tasks 7, 9, 10 need judgment — standard. The final whole-branch review —
  most capable.
- **Commit per task on the branch. Never push. `main` stays untouched.**

---

## 6. Invariants — do not break these

- **`Shift.employee === null` = OPEN SHIFT**, single nullable ref, one row per
  person per day. `buildRosterLanes`, the attendance punch→shift match,
  `describeEarlyLeave` and swaps all depend on it.
- **`checkAssignment` is the ONE judge.** `judgeAssignments` and
  `planPatternFill` both delegate to it and add no rules. Do not grow a second
  role test anywhere.
- **`role_mismatch` is the only forceable code.** Widening eligibility must not
  delete the override path or make it meaningless. `FORCEABLE_CODES` lives on
  the server; the browser reads `forceable` off the response. No client-side
  copy.
- **Generation is idempotent and must stay so.** Re-running a range must not
  duplicate. `skipped` is reported in full, never swallowed.
- **Creation never publishes.** Generated and filled rows are `draft`.
- **`patternDates` is the ONE reader** of `recurrence`/`cycleDays`/`anchorDate`.
- **Rules live in `services/*.helpers.js`, never a controller** — the server
  suite is unit-only with no database, so controller code is untested by
  construction.
- **Mongoose never drops a de-declared index nor re-options an existing one.**

---

## 7. Also outstanding (pre-existing, not this branch's job)

- Dead `fromTemplate` in `shift-roster-page.tsx` — zero callers. The plan said
  keep, the last final review said delete, the human never ruled. **If you touch
  that file, ask.**
- The badge backfill has still never been run. 27 Wyn City employees have no
  badge number, 36 across all tenants:
  `node scripts/backfill-employee-badge-numbers.js [--tenant=…] --apply`,
  dry-run first.
- Two dev servers may still be running from the last session (`:5001` backend,
  `:3000` admin).

---

## The prompt

> In `/Users/mac/Documents/drinksharbour`, continue the multi-role shift
> templates work on branch `feat/multi-role-shift-templates`.
>
> Read `docs/superpowers/specs/RESUME-multi-role-shift-templates-tasks-5-11.md`
> first, all of it, before doing anything.
>
> There is one uncommitted, unverified edit in `server/services/shift.helpers.js`
> — §1 of that doc explains exactly what it is and how to verify it. Settle that
> first: run the tests, commit if green, and amend spec §6.1 as described.
>
> Then execute Tasks 5–11 of
> `docs/superpowers/plans/2026-08-12-multi-role-shift-templates.md` using
> `superpowers:subagent-driven-development`, resuming from the ledger at
> `.superpowers/sdd/progress.md`. Tasks 1–4 are done and reviewed — do not
> re-dispatch them.
>
> Commit per task. **Never push. Do not touch `main`.**
>
> Two things need me, not a guess: Task 0's browser baseline was skipped and
> gates Task 10, and the dead `fromTemplate` in `shift-roster-page.tsx` has
> never been ruled on. Ask me when you reach them.
