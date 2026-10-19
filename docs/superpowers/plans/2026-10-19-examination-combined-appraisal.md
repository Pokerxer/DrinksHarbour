# Examination and Combined Appraisal Implementation Plan

> Execute inline using executing-plans and test-driven-development; no subagents.

Goal: Department-targeted automatically marked MCQ examination, monthly attendance
and peer appraisal combined equally to determine the employee's allocated bonus.
Spec: ../specs/RESUME-examination-combined-appraisal.md.
Stack: existing Express/Mongoose, Next/React/TypeScript; no new dependencies.

## Confirmed rules

Selected departments: (exam% + appraisal% + attendance%)/3.
Other departments: (appraisal% + attendance%)/2 (user explicitly confirmed).
Bonus = full unrounded combined percentage /100 × allocation, rounded once to
minor units. All peer eligibility/no-self-rating/tenant/HR restrictions remain.
Optional combined examination setup on draft peer cycles; existing cycles with
no setup preserve existing appraisal-only behavior. No retroactive recalculation.

## Implementation choices

Choose attendance month explicitly. Finalize only after the month ends and every
employee has a numeric roster-based attendance score; zero is valid, null blocks.
Use tenant calendar offset and existing published-shift/approved-leave scoring.
Snapshot monthly components at closure, so later corrections do not rewrite bonuses.
One single-choice answer per equally weighted MCQ, one final submission per person;
save draft/retry allowed. Answer keys never enter employee projections. Assignments
and definition freeze at cycle launch, using the current roster department snapshot.
No questions are shown to people outside target departments. No payments.

## File structure

Server: new PeerAppraisalExam and PeerAppraisalExamAttempt models; focused
services/peerAppraisal/exam-rules.js, examination.js, exam-reviews.js,
exam-results.js, monthly-attendance.js; examination controller and routes under
existing /api/peer-appraisals. Extend participant result composite snapshot and
HR progress/employee projections; hook launch/close into existing transactions.
Client: examination.service.ts contracts; appraisals/examination/{setup,
question-editor,employee-exam,score-breakdown}.tsx and focused hooks as needed.
Integrate draft setup/progress into peer cycle panel and employee page; augment
final owner table and employee result card without changing normal cycles.

## Tasks and verification

- [x] Task 1: Write failing pure tests for config validation, exact MCQ membership,
  hidden answer keys, monthly date boundaries, equal 2/3 component arithmetic and
  money rounding. Implement minimal rules and models; run tests.
- [x] Task 2: Add database/HTTP lifecycle tests first: active same-tenant department
  validation, stale configuration, frozen assignment, answer-key secrecy, employee
  submission, missing attendance, selected and outside department bonus results,
  no override by client score, retry immutability and original cycle compatibility.
  Implement services/controllers and transactional launch/close hooks; run tests.
- [x] Task 3: Add failing UI tests for authoring/department targeting, MCQ answers,
  incomplete submit, employee exam scores and final 2/3 component breakdown.
  Implement focused UI, dirty launch guards, progress and final breakdowns.
  Run appraisal UI tests and scoped TypeScript check.
- [x] Task 4: Self-review against key leakage, tenant spoofing, stale edits, missing
  denominators, exact rounding, snapshot behavior. Run full server suite and real
  local Mongo workflow; record limits and update spec/README/memory. No commit.

## Execution ledger

User clarified auto MCQ, equal weights and combined-score bonuses. Outside selected
exam departments include appraisal AND attendance equally. Existing uncommitted
appraiser work is a dependency; work in this checkout and preserve unrelated edits.

Final ledger: Tasks 1–4 complete. Pure rules 9 passed; real database/JWT/HTTP
lifecycle 7 passed; full server 4,051 passed/36 skipped; appraisal UI 322 passed;
scoped TypeScript, formatting and changed-file whitespace passed. Self-review
covered projection secrecy, authenticated identity, stale forms, exact money,
month/overnight bounds and immutable results. No production data mutated.
