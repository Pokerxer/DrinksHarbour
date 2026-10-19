---
name: examination-combined-appraisal
description: Implemented department-targeted auto-marked exams and equal-weight monthly combined bonuses.
updated: 2026-10-19
---

Implemented, uncommitted. User chose auto-marked single-choice questions, equal
weights, combined-score bonuses. Explicit outside-department clarification:
appraisal AND attendance equally. Selected exam departments use all three equally.
Optional configuration in draft peer cycles: enable examination/monthly score,
choose month/departments, author answers, save, launch. No config preserves old bonus.

Answer keys stay HR-only; grading is server-side, one final attempt with drafts,
revision guards and exact retries. Month and published overnight shifts must end;
unrated attendance blocks closure, actual zero is valid. Bonuses use exact rational
arithmetic and round once. Snapshots freeze final components and bonuses; subsequent
attendance corrections do not rewrite released results. Owner sees everyone,
employees their own. Existing selected-appraiser/no-self-rating rules remain.

Verified: full server 4,051 passed / 36 skipped; real Mongo/JWT/HTTP lifecycle 7
passed; appraisal UI 322 tests / 25 files passed; scoped types, formatting and
whitespace passed. Self-review; CodeRabbit unavailable. No live browser walkthrough,
new dependencies, subagents, commit or push. Disposable Mongo stopped at finish.

Handoff: docs/superpowers/specs/RESUME-examination-combined-appraisal.md.
Domain/API rules: server/services/peerAppraisal/EXAMINATION.md.


2026-10-19 follow-up: owner now selects inclusive attendance dates rather than
only a month; supplied Wyn City private bank30,10 shuffled fixed questions/person,
2marks each; AI topic-based reviewed drafts. Legacy behavior remains readable.
Latest verification/handoff supersedes counts above:
docs/superpowers/specs/RESUME-examination-bank-and-range.md.


2026-10-19 follow-up: per-question editable marks, AI difficulty/marks, weighted
earned/max scoring and configurable server-enforced exam duration implemented.
Latest handoff supersedes equal-mark/new-exam instructions above:
docs/superpowers/specs/RESUME-weighted-timed-examinations.md.
