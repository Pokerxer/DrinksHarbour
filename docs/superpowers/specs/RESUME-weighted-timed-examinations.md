# Weighted and timed examinations — 2026-10-19

Status: implemented and verified locally; uncommitted. User requested per-question editable marks, AI difficulty
marks and time to answer. Plan: ../plans/2026-10-19-weighted-timed-examinations.md.
Continue existing exam feature; previous handoff RESUME-examination-bank-and-range.md.

Defaults chosen: new edited exams30minutes, configurable1–240; marks1–20 integers;
AI easy1/medium2/hard3 editable; no timed migration for already-launched exams.
Explicit employee start, server deadline, autosave answers, expiry uses saved-only
answers with unanswered zero. Weighted earned/max drives exact combined bonus.


## Implementation

Draft settings include durationMinutes1–240 (new editor default30); question editor
has marks1–20 integer and optional easy/medium/hard. AI must return easy1/medium2/
hard3; preview exposes values, owner can edit after acceptance. Supplied PDF bank
keeps2 unless changed. Date-range, departments,10-question random immutable papers,
private bank/keys and equal combined weighting remain intact.

At launch, duration freezes on attempts. POST own examination/start stores server
startedAt/expiresAt exactly once; until then timed question IDs/prompts are hidden.
Timer uses returned server clock anchored to monotonic performance time. Timed
answers autosave, newer local edits survive an in-flight save; manual submit locks
editing. Deadline checks happen before accepting new answers; timed-out papers use
only saved answers, unanswered zero. Server expiry finalizes on own read/write,
owner progress and close within cycle serialization. Owner can close expired papers
even with employee page closed; unstarted assigned papers still block readiness.
Cancelled exams do not run countdown finalization. Reload saved examination resolves
stale-revision errors; it intentionally reloads persisted answers and original timer.

Weighted grading returns correctCount/questionCount plus earnedMarks/maxMarks;
combineResult uses exact earned/max fraction for exam and bonus, legacy snapshots
use correct/count. Final snapshots freeze marks and timedOut. No production edits,
schema migration, dependencies, subagents, commit, push or deployment.

Files: exam-attempt.js (clock, finish and safe view), exam-expiry.js (transactional
settlement), exam-reviews.js (own/start/deadline), exam-rules.js (validation/weighted
math), exam-ai.js (difficulty rubric), examination.js/settings/schema/routes.
Frontend: question-editor, question-bank-editor/sources, setup, use-exam-setup;
use-exam-clock and use-employee-exam separated from employee-exam.tsx. The employee
paper keys by cycle ID so old async responses cannot replace another cycle’s paper.
Domain/API: server/services/peerAppraisal/EXAMINATION.md.

## Verification and limits

- Full server:4,065 pass,36skip,0fail. Log /tmp/exam-timed-server.log.
- Real disposable Mongo/JWT/HTTP:10pass,0skip,0fail. Includes unequal weights,
  concurrent idempotent start, hidden-before-start papers, preserved deadline,
  forbidden foreign start, late-answer exclusion, unanswered zero, own-read and
  HR-progress expiry, expiry on close, exact weighted bonuses and legacy flows.
  Final log /tmp/exam-timed-http-final2.log. Earlier duplicate department fixture
  failure was fixed by making the test scenario name unique; no product change.
- Appraisal UI:331pass across27files. Log /tmp/exam-timed-ui-final2.log. Includes
  marks/duration save, AI marks applied, countdown/reload, autosave races, connection
  failure retry and cancelled-clock regression.
- Scoped tsc --noEmit -p tsconfig.appraisals-check.json clean; formatting passed.
- RED evidence: /tmp/exam-weights-red.log, /tmp/exam-difficulty-red.log,
  /tmp/exam-timing-red.log, /tmp/exam-timed-ui-red.log,
  /tmp/exam-cancel-clock-red.log. New timing module initially absent; subsequent
  exact clock/expiry tests ran against actual implementation and passed.
- Self-review with security/verification skills. CodeRabbit CLI unavailable.
  No live browser walkthrough or real paid AI invocation. Provider integration
  tested with injected official-SDK transport. Full production build not run;
  scoped types and relevant UI plus full server regression verified.
- Disposable Mongo on27029 stopped at finish. Changes remain local/uncommitted.

User flow: draft cycle → question editor marks + duration → save → launch.
Employee clicks Start examination, sees assigned marks/count/time, answers/autosaves,
then submits early or server finalizes saved answers at deadline. Owner closes
when appraisal/exam/attendance readiness is met. Existing launched exams retain
original settings; new duration applies to newly launched configurations only.


2026-10-19 design/usability follow-up: responsive setup/readiness, stronger client
validation, bank search/difficulty filters and employee navigation/submission review.
Latest handoff: docs/superpowers/specs/RESUME-examination-usability.md.


AI generation reliability follow-up: constrained JSON; server derives difficulty
marks, one bounded repair, specific safe errors. Supersedes strict rejection of
inconsistent model marks above. Latest handoff:
docs/superpowers/specs/RESUME-examination-ai-reliability.md.
