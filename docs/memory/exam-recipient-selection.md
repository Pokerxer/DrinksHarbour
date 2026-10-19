---
name: exam-recipient-selection
description: Exact employee exam recipients selected within department preview; legacy department-only assignment remains supported.
updated: 2026-10-19
---

Recipient checkboxes now persist optional recipientIds. Undefined means legacy
all matching departments; explicit IDs are checked against active tenant employees,
saved roster and selected departments at save and launch. Use the shared
exam-recipients helper for assignment and closure. Unticked same-department employees
get no attempt and use appraisal+attendance. Questions/timing/grading unchanged.

UI saves exact checked eligible IDs, offers all/clear and requires at least one.
Save roster before exam; only successful local roster saves may hand their revision
to a dirty exam editor. Do not replace ordinary stale-revision guards with automatic
refresh. Resume: docs/superpowers/specs/RESUME-exam-recipient-selection.md.

Verified: full server4076pass/36skip; Mongo/JWT HTTP11pass; appraisal UI345pass/32files;
focused follow-up39pass/10files; scoped tsc clean; synthetic desktop/mobile selection
and persistence checks passed. Local changes only; no deployment/commit/push.
