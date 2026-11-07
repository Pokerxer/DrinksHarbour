# Owner reset control and Regina exam exclusion — 2026-10-20

Cycle owner roster now has an Examination column with Reset test for assigned
employees in collecting cycles. Confirmation clears answers, clock/submission/
grade while preserving paper and duration; next explicit Start gets full time.
Endpoint uses unrestricted HR, JWT tenant, cycle/attempt revisions and audit.
Closed results and unassigned employees cannot be reset. Implementation local,
uncommitted and not deployed; no new dependency or migration.

User corrected initial exclusion request: ONLY Regina, leave Goodness unchanged.
Live Wyn City October exclusion applied and verified (15→14 recipients). Other
attempts including Goodness exactly unchanged. Regina remains an appraisal
participant, attendance untouched, non-exam weighting80%appraisal/20%attendance.
Original attempt retained in private audit for recovery; no released results
changed. Do not exclude Goodness in a later continuation.

Verification: server4098 passed36 skipped; disposable Mongo/JWT/HTTP13 passed;
UI355 passed plus final focused6 passed; scoped types clean; real-component
desktop/mobile browser preview passed. Disposable Mongo27030 stopped.
Full handoff: `docs/superpowers/specs/RESUME-owner-exam-reset.md`.
