# Selected Appraisers Implementation Plan

> Execute inline with superpowers:executing-plans; the user prohibits subagents.

**Goal:** Select appraisers from the employees being appraised in each draft cycle.
**Architecture:** Add participant `isAppraiser`, default true for legacy records.
Selected appraisers rate every other participant; everyone retains their bonus
allocation and private result. Existing transaction/revision protections remain.
**Tech Stack:** Express/Mongoose, Next/React/TypeScript, existing test runners.
**Spec:** docs/superpowers/specs/RESUME-peer-appraiser-selection.md

## Global constraints

At least two selected appraisers; no self-rating; draft-only selection changes.
No new dependencies, external appraisers, payments, commits or subagents.
Preserve JWT tenant authority and unrestricted HR management. Leave unrelated edits.

## File boundaries

Server: participant model, peerAppraisal rules/lifecycle/reviews/queries, existing
controller contract. Client: peer service types, focused setup hook and setup row,
setup form, progress/actions/table, My cycles and employee result page.
Tests: extend rules/API/model/lifecycle, setup/panel and employee UI tests.

## Review focus

Legacy missing flags must mean true. False flags must be boolean, not coerced.
Non-appraisers cannot write via API. Required pairs and closure count appraisers
only. Stale saves/reloads must retain the appraiser choices alongside allocations.

## Task 1: Server rules and permissions

- [x] Add failing tests for selected/legacy appraisers, malformed flags, fewer
  than two appraisers, and HTTP submission denial/closure/results for 2 of 3.
- [x] Run tests and confirm failures before changing production code.
- [x] Persist isAppraiser; validate and freeze it with roster; enforce it in review
  writes; return it in own review/my cycles/HR projections. Return appraiserTotal
  independently of subject total; count submitted appraisers only.
- [x] Verify exact selected rating matrix, unchanged bonus formula, legacy cycles,
  stale writes and tenant boundaries in existing and new tests.

## Task 2: Draft selection and progress UI

- [x] Add failing UI tests for saved appraiser choice, invalid selection count,
  dirty launch guard, appraiser-only progress and non-appraiser result access.
- [x] Extract setup state to use-cycle-setup.ts and row to setup-employee.tsx.
  Add per-selected-employee “Can appraise” checkbox; new inclusions default true.
  Save flags atomically with allocations; preserve explicit stale-edit reload.
- [x] Update progress/sidebar/table and employee waiting view; no form or submit
  prompt for non-appraisers. Keep their closed result visible.
- [x] Run appraisal UI suite and scoped TypeScript check.

## Task 3: Verification and handoff

- [x] Self-review diff against review focus; run full server suite, focused client
  checks and whitespace/format checks. Use only disposable local DB for integration.
- [x] Update service README, resume and project memory with results and limits.

## Decisions and evidence

User confirmed appraisers are selected from participants (2026-10-19).
Default true preserves existing cycles and clients; explicit false removes rating
permission. Require at least two appraisers because each must receive an incoming
non-self rating. Existing live cycles remain immutable. No additional approval
needed: this executes the requested and clarified functionality in the current
workspace. Review locally because user prohibits subagents.

Task 1: complete. Unit tests failed first (4) then passed (12); actual HTTP
workflow failed on missing appraiserTotal before implementation, then all six
integration tests passed with selected-appraiser permissions and correct bonuses.
Task 2: complete. New UI tests failed first (selection, close guard and waiting
view); all 22 appraisal files / 312 tests passed. Scoped TypeScript passed.
Task 3: complete. Sandbox prevented local HTTP listeners; network-enabled full
server rerun passed 4,041 tests with 36 skipped and no failures. Final setup-only
rerun 7 passed. Formatting and changed-file whitespace passed; unrelated existing
platform next-env.d.ts whitespace left untouched. No production harness changes.
Self-review complete; CodeRabbit unavailable. Docs and memory updated; no commit.

Owner results follow-up: user confirmed excluding self from the denominator.
Existing backend already matches; final score cells now expose ratingCount as the
eligible appraiser count. Verified RED→GREEN table regression; UI 315 passed,
peer server checks 15 passed, scoped types and whitespace passed. No recalculation.
