---
name: employee-score-breakdown
description: Owner per-employee exam/appraisal/attendance details and20% attendance weighting.
updated: 2026-10-20
---

Owner participant names open employee-scores dialog. GET cycle participants employee
scores is unrestricted-HR/JWT-tenant scoped; aggregate only,no drafts,keys,answers
or reviewer identities. Pending/null differs from actual0; partial appraisal is
provisional,with self excluded from eligible count. Current attendance window stays
provisional until it and shifts finish. Closed details use frozen result snapshots.

New weights: exam40%,appraisal40%,attendance20%; without exam80%appraisal+20%attendance.
Weights are saved in new composite results; historical snapshots without weights
retain equal-weight explanation and stored bonus. No live record recalculation.
Bonus arithmetic uses exact unrounded rational fraction. Rating-only cycles keep
appraisal-only bonuses. Resume: docs/superpowers/specs/RESUME-employee-score-breakdown.md.

Verified: server4096pass/36skip,UI353pass/34files,disposable HTTP12pass,scoped tsc
and whitespace clean. Actual-component synthetic desktop/mobile320&390 passed
weighted values,zero/pending,error retry,Escape/focus return and overflow checks.
Our temporary27030 Mongo and preview servers stopped. No production data changes,
commit,push,deployment or dependency changes.
