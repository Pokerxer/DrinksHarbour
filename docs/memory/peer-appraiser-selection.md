---
name: peer-appraiser-selection
description: Select which cycle participants may appraise all other participants.
updated: 2026-10-19
---

Implemented, uncommitted. User confirmed appraisers are selected from employees
being appraised. In draft setup, each included employee has a “Can appraise
colleagues” checkbox. Require two appraisers, freeze on launch, count only their
submissions. Non-appraisers still receive their private score/bonus after closure
and cannot save/submit ratings. Legacy missing flags mean true; no backfill.

Bonus formula unchanged. Atomic roster/revision guard saves appraiser selection
and allocations together. Appraiser flag returned in /my and /review; separate
HR appraiserTotal prevents subject-count closure deadlocks. UI shows waiting for
results to non-appraisers.

Verified 312 appraisal frontend tests, scoped types, formatting and 6 real
Mongo/HTTP integration tests. Full server suite: 4,041 passed, 36 skipped, zero
failures, using local networking after sandbox listener failures. Final setup
rerun: 7 passed. Self-review; CodeRabbit unavailable.
No live HR mutation, subagents, commit or push. Disposable test Mongo stopped.

Handoff: `docs/superpowers/specs/RESUME-peer-appraiser-selection.md`.

Follow-up: user wants owner to see all final scores (already in the closed-cycle
HR table) and scores based on total appraisers. User confirmed excluding themselves from the denominator: N−1 for appraisers,
N for others, respecting no self-rating. Existing calculation is preserved.
Final score cells now show the stored eligible appraiser count; closed-cycle copy
explains the rule. New table regression failed first, then passed. Follow-up
checks: 315 appraisal UI tests, 15 peer server tests, scoped types and whitespace
passed. No backend product changes or recalculation of existing results.

2026-10-19 examination extension: optional draft examination/monthly configuration
now combines appraisal and attendance equally, plus auto-marked MCQ score in
selected departments. Combined fraction determines bonus; original cycles with
no configuration retain old behavior. See
`docs/superpowers/specs/RESUME-examination-combined-appraisal.md` for rules and tests.
