---
name: weighted-timed-examinations
description: Editable per-question marks, AI difficulty marks and server-enforced per-employee exam timers.
updated: 2026-10-19
---

Implemented locally, uncommitted. New/edited draft duration1–240minutes (default30).
Marks1–20 each, AI easy1/medium2/hard3 editable after review. Exam and bonus use
weighted earned/max marks; legacy result snapshots retain correct/count fraction.
Preset PDF marks2 unchanged until owner edits;10 random fixed questions each stay.

Explicit own start hides paper until server startedAt/expiresAt frozen. Idempotent
start/reload cannot extend deadline; UI countdown/autosave/errors preserve edits.
Expiry grades only saved answers, unanswered zero; late updates cannot improve it.
Settlement on employee read/write, owner progress or close; no scheduler. Cancelled
exam countdown disabled. Launched legacy exams remain untimed; no migration.

Verified full server4065pass/36skip; appraisal UI331pass/27files; realMongo HTTP10pass;
scoped tsc clean. No live AI/browser/deployment/commit/subagents/new dependencies.
Handoff: docs/superpowers/specs/RESUME-weighted-timed-examinations.md.
Rules: server/services/peerAppraisal/EXAMINATION.md.


2026-10-19 design/usability follow-up: responsive setup/readiness, stronger client
validation, bank search/difficulty filters and employee navigation/submission review.
Latest handoff: docs/superpowers/specs/RESUME-examination-usability.md.


AI generation reliability follow-up: constrained JSON; server derives difficulty
marks, one bounded repair, specific safe errors. Supersedes strict rejection of
inconsistent model marks above. Latest handoff:
docs/superpowers/specs/RESUME-examination-ai-reliability.md.
