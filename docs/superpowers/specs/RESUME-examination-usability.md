# Examination usability — 2026-10-19

Status: implemented locally and verified, uncommitted.
Plan: ../plans/2026-10-19-examination-usability.md.
Previous complete feature: RESUME-weighted-timed-examinations.md.

Scope: management readiness overview and actionable shared validation, bank search/
difficulty filters, employee progress/question navigation, selected answer styles,
review before final submission. Preserve all scoring/timing/tenant rules.


## Delivered

Management settings now have separate responsive settings/readiness columns with
paper count, duration, assigned marks context and actionable readiness checks.
Shared setup-validation.ts replaces the old partial boolean validity check: actual
calendar dates, inclusive max366days, reversed bounds, duration1–240, departments,
bank10–100, trimmed duplicate prompts, marks1–20, options and answer indexes. Save
is blocked with the exact question named; corrected inputs restore readiness.
No new server validation or schema changes in this iteration.

Question bank search matches prompts/options, difficulty filter includes unspecified,
matching count/clear/empty state. Filtering retains original indexes and edits;
new questions clear filters. Difficulty badges and marks are visible in collapsed
rows. Fieldsets/settings/editor shrink on mobile instead of overflowing.

Employee progress navigator shows answered/remaining, completion bar and numbered
answered buttons. Next-unanswered navigation scrolls/focuses the actual fieldset.
Selected options get brand-red styles. Submit opens an in-page review; Keep
answering retains selections, Confirm submission calls the existing server mutation.
Server deadline/autosave stay active during review; expiry hides confirmation.
All existing timing/weighted bonus/privacy/departments rules remain unchanged.

Files: setup-validation(+tests), setup-overview, setup-settings, answer-progress,
submission-review; setup/use-exam-setup/question-bank-editor/employee-exam and tests.
No new dependencies, backend behavior change, live HR changes, subagents, commit,
push or deployment. Preserve other worktree changes.

## Verification

- Full server regression:4065 passed,36 skipped,0failed; /tmp/exam-usability-server.log.
- Appraisal UI regression and scoped tsc run; final counts in completion ledger below.
- Actual React components rendered in local Vite harness with synthetic fixtures
  and compiled project Tailwind. Python headless Playwright desktop1366px and mobile
  390px: bank search/difficulty/clear, no horizontal overflow, employee progress,
  focus navigation and confirmed submission; no page errors.
  Log /tmp/exam-usability-browser-final.log. Harness /tmp/drinksharbour-exam-preview
  only; no production preview route or live auth/data. Browser helper stopped server.
- Browser caught native fieldset min-content overflow at390px. Measured offending
  elements, added min-w-0 at parent/nested fieldsets, reran to OVERFLOW [].
- Screenshots viewed: /tmp/exam-owner-desktop.png, /tmp/exam-owner-mobile.png,
  /tmp/exam-employee-mobile.png. Preview uses system fonts and synthetic data;
  no authenticated live-product walkthrough or live paid AI call claimed.
- RED logs: /tmp/exam-usability-validation-red.log (new helper absent),
  /tmp/exam-usability-ui-red.log (search/progress absent).
- Self-review. CodeRabbit CLI unavailable from previous check. No Mongo process
  required this iteration; previous timer database workflow remains documented.


## Final completion ledger

Appraisal UI337passed/29files (/tmp/exam-usability-ui-last.log), scoped tsc clean
(/tmp/exam-usability-types-last.log), whitespace/formatting passed. Full server
4065pass/36skip unchanged. Synthetic desktop/mobile browser passed and temporary
preview server stopped. No outstanding required work; changes local/uncommitted.


Dropdown design follow-up: shared styled floating select for exam/AI departments;
latest handoff docs/superpowers/specs/RESUME-appraisal-dropdowns.md.


Department recipient preview added: live draft roster + current departments, names
and counts; latest handoff docs/superpowers/specs/RESUME-exam-recipient-preview.md.
