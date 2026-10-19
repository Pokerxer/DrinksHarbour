---
name: employee-peer-workspace
description: Employee appraisal workspace design and safe rating submission flow.
updated: 2026-10-19
---

/appraisals/peer/[cycleId] uses employee-header/guide and smaller review components.
use-peer-review owns dirty state/revision, locks saves and warns on browser unload.
Filters never remove hidden values from the submitted payload. Submit ratings opens
a final review list; Confirm and submit is the irreversible API call. Keep editing
restores button focus. Failed saves preserve entries; drafts use returned revision.

Keep loaded review on result-refresh failure; closed/cancelled/non-appraiser views
never invite rating edits. hasExamination means the cycle has settings, not that
this employee is assigned. Actual exam access stays server-authoritative through
EmployeeExam. No backend or scoring changes in this session.

Handoff and verification: docs/superpowers/specs/RESUME-employee-peer-workspace.md.

Verified: appraisal UI349pass/33files, full server4085pass/36skip/0fail, scoped
TypeScript clean, synthetic browser desktop/mobile320&390 all workflow checks passed.
No backend changes, real employee data edits or deployment.
