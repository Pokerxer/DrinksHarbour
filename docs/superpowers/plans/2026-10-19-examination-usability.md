# Examination usability and design improvements

User: improve design and functionalities of the ongoing appraisal/exam feature.
Work inline, no agents, production edits, commits or dependency changes.

## Scope and design

Management: preserve brand red #b20202, deeper heading #790505, white #ffffff,
neutral gray #f9fafb/#6b7280 and amber #92400e for actionable readiness warnings.
Reuse existing typography. Responsive configuration + readiness layout, clear
paper count/duration/marks and completion issues. Sources/editor remain full width.
Validation should identify exact missing/invalid question, date, mark and duration
instead of only disabling Save. Share validation with the setup hook.

Bank: search question text/options, filter difficulty; maintain original indexes,
show matching count/empty state, keyboard-accessible accordions and scrollable list.
Do not lose edits, marks or answer keys when filtering.

Employee: answer progress bar, numbered question navigator, next-unanswered action,
visible selected answer, submission review/confirmation before immutable submit.
Keep server timers/marks/grading unchanged. Navigation focuses actual question;
countdown and autosave stay live during review. Expiry hides confirmation actions.

Files: new setup-validation.ts + tests; setup-overview.tsx; setup-settings.tsx;
question-bank-editor.tsx + interaction tests; new answer-progress.tsx and
submission-review.tsx; employee-exam.tsx (keep under300lines), existing tests.

- [x] RED→GREEN specific readiness validation/date bounds/duplicates and save guard.
- [x] RED→GREEN searchable difficulty bank preserving original edits.
- [x] RED→GREEN employee progress/navigation/selection and submission confirmation.
- [x] Relevant/full appraisal suite, scoped types, full server baseline, self-review.
- [x] Update domain rules, resume and project memory. Synthetic browser walkthrough at1366px and390px completed; preserve privacy and legacy exam behavior.
