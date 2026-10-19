# Individual examination recipients

Extend the existing department preview in `client/apps/admin/src/app/shared/appraisals/examination/recipients.tsx` with employee checkboxes and select-all/clear controls. Store optional `recipientIds` in the examination configuration. Departments constrain the eligible list; explicit selection limits assignments. Legacy omitted selection continues assigning all matching participants.

Backend: validate explicit IDs, active tenant membership, saved cycle roster and current department on save and launch. Persist the selection, return it only with HR configuration, and use it consistently for assignment and closure. Non-recipients retain appraisal plus attendance scoring.

Frontend: default all displayed employees selected until customized; preserve customized selection, require at least one recipient, save roster changes before examination settings. Prune removed department/roster candidates from the effective saved selection. Never expand an explicit selection automatically. Persist exact IDs when candidate data is loaded.

Verification: failing validation and UI selection tests first; API/Mongo workflow covers selected and excluded same-department employees, invalid selections and launch revalidation. Run full server suite, appraisal UI suite and scoped TypeScript. Update resume and project memory with results.

Completed and verified. Results and operational state: ../specs/RESUME-exam-recipient-selection.md.
