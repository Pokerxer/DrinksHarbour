# Employee peer appraisal workspace

## Outcome and boundaries

Improved `/appraisals/peer/[cycleId]` locally. Cycle header with human status,
main task column + desktop guide sidebar, mobile stacking, responsive five-cell
rating controls, rating progress, search and All/Unrated filters, useful empty
states, draft save feedback, unload warning for unsaved ratings and explicit final
submission review. All filtered-out colleague values remain in the payload.

Employee page now retains the loaded cycle when checking results fails and retries
without a blank page. Keyed cycle wrapper isolates route changes. Closed/cancelled
and non-appraiser states never offer editing. Existing examination stays mounted
while refreshing collecting review data; no exam timer/grading changes. Guide treats
hasExamination as a cycle setting, not proof of individual assignment. EmployeeExam
continues checking actual assignment through the existing endpoint.

## Files

- peer-rating/employee-page.tsx: loader, retry and lifecycle views.
- employee-header.tsx / employee-guide.tsx: page framing and task instructions.
- use-peer-review.ts: ratings, dirty/revision tracking, lock and API persistence.
- review-form.tsx: filters/progress/drafts/final-review composition.
- rating-confirmation.tsx: explicit final confirmation, selected score list and
  focus on entry. Keep editing returns focus to submission button.
- rating-row.tsx: responsive accessible 1–5 radios and selected state.
- employee-workspace.test.tsx and review-form.test.tsx: interaction regressions.

All paths above under client/apps/admin/src/app/shared/appraisals. No API/schema,
permission, weight, money arithmetic, exam recipient or attendance changes.

## Verification

Observed four new behavior tests fail before implementation: filtering/empty state,
explicit final confirmation, dirty/unload lifecycle, loaded cycle retained after
failed released-result fetch. Also observed Keep-editing focus test fail before fix.
Final full appraisal suite349pass/33files,0 failures (/tmp/employee-workspace-ui-final.log).
Full server4085pass/36skip/0fail (/tmp/employee-workspace-server.log).
Final scoped TypeScript clean (/tmp/employee-workspace-types-final.log).
Browser actual components with synthetic API data: desktop1366/mobile390&320,
draft persistence, filters, confirmation before API submission, submitted read-only,
released composite result, non-appraiser waiting and timed-exam start access passed.
No page errors/horizontal overflow. Final layout refinements rechecked: full-width mobile title and search field,
Keep-editing focus restored. Scoped diff whitespace check clean.

## Operational state

No commits/push/deploy or dependency changes. No real employee/HR data or paid AI
requests. Synthetic Vite/Playwright harness stays in /tmp/drinksharbour-peer-workspace;
helper stops its server. Final verification logs /tmp/employee-workspace-*.log.
