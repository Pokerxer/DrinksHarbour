# Individual examination recipient selection

## Outcome

Implemented locally, uncommitted. Department preview now has individual employee
checkboxes, select-all/clear and selected/eligible counts. Unticked employees use
appraisal and attendance equally, including those in selected departments.

## Contract

Optional `recipientIds` in ExamConfiguration / PeerAppraisalExam. Undefined retains
legacy department assignment (Mongoose array default is explicitly undefined).
Explicit IDs must be nonempty/distinct, active in JWT tenant, in saved cycle roster
and selected current departments. Server revalidates at launch and rejects stale
roster/department choices. Attempts freeze at launch. Closure waits only for actual
selected recipients; other participants still need rated attendance.

UI defaults to all eligible until customized, then never adds new employees
implicitly. New saves persist exact effective choices. Unsaved roster changes
block examination save; successful local roster save hands its revision to the
exam editor without discarding recipient edits. Ordinary refresh/discard cannot
bypass a conflict with saved exam settings.

## Files

- server/models/PeerAppraisalExam.js
- server/services/peerAppraisal/exam-recipients.js (shared membership rules)
- server/services/peerAppraisal/{exam-rules,examination,exam-results}.js
- client/apps/admin/src/services/examination.service.ts
- client/apps/admin/src/app/shared/appraisals/examination/{recipients,setup,setup-settings,use-exam-setup,progress}.tsx (hook is .ts)
- peer-rating/{cycle-panel.tsx,use-cycle-setup.ts} (local roster revision handoff)
- tests: peerExaminationRules; helpers/peerSelectedRecipientsWorkflow and lifecycle;
  examination/recipient-selection.test.tsx.

## Verification

Observed missing-recipient validation and missing-checkbox tests fail before code;
observed local-roster-revision regression fail before the fix. Unit validation green.
Real Mongo/JWT HTTP workflow: 11 passed, including one selected recipient amongst
same-department employees; foreign/non-roster/outside-department/duplicate/empty
selections rejected; changed department and removed roster block launch; unchecked
employee exam submit denied; selected-only closure with expected two/three-component
bonuses. Existing legacy department/timed/personalized cases remain green.
Full appraisal UI: 345 passed /32 files. After the last UI adjustments, focused
examination/roster/panel suite: 39 passed /10 files. Scoped TypeScript clean.
Full server: 4076 passed,36 skipped,0 failed (/tmp/recipient-selection-server-all.log).
Final Mongo/JWT HTTP rerun: 11 passed,0 failed (/tmp/recipient-selection-http-final.log).
Scoped diff whitespace check clean. Self-review checked tenant scoping, legacy
undefined-vs-empty semantics, assignment/closure consistency and local revision
handoff; no outstanding issues found.
Synthetic actual-component desktop/mobile browser: exact checked IDs saved, adding
another department after customization leaves new employees unchecked, clear/all
work, zero selection blocks save, no horizontal overflow or page errors. Screenshots
/tmp/exam-selection-{desktop,mobile}.png. No production data or paid AI requests.

## Operations

Verification complete. Disposable Mongo port27029 /replica peerTest stopped after
final HTTP verification. Browser preview server stopped by its test harness. No commit/push/deploy/dependency changes.
