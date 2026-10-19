# Examination timer reset: scope discovery

User request: "reset the exam timer for progress".
User clarified a one-time reset for employee Progress in the October cycle.
Located exactly one match in Wyn City. No real exam records changed: the apply
command was rejected by the user at database-write approval.

Current facts:
- Timer is server-authoritative: attempt.startedAt/expiresAt, frozen duration,
  revision and saved answers. Start is idempotent; refresh cannot restart a timer.
- No timer-reset endpoint or progress control exists.
- HR examination progress currently returns totals, not individual attempt states.
- Expired attempts auto-finalize on reads/progress/close. Submitted results are locked.
- Any reset feature must preserve saved answers and frozen question IDs, require
  unrestricted tenant HR, serialize via cycle transaction, reject stale revisions,
  and specify whether finished/timed-out attempts may reopen. Never alter closed
  cycle scores/bonuses as an incidental timer change.
- Active employee pages do not currently poll the clock from the server. A reset
  needs a deliberate synchronization path that preserves unsaved local answers
  and does not accept old-deadline responses after a reset.

For a one-time reset, exact tenant/cycle/employee are required first. Do not infer
or reset every employee from this brief. For a feature, default scope should be
in-progress timed attempts only, with clear status and reviewable per-person action.

## 2026-10-19 operational outcome

Read-only preflight verified Wyn City/Progress/October, collecting cycle revision5,
attempt revision2, duration8minutes,10 assigned question IDs and1 saved answer.
No submittedAt was present. Proposed reset clears start/deadline so the employee
can Start examination again with full duration; preserves questions/answers/marks,
increments attempt/cycle revisions and atomically records an audit event.

The write command `node /tmp/reset-progress-october-exam.cjs --apply` was rejected
by the user. Do not retry or bypass that denial without renewed authorization.
Read-only inspection/preflight succeeded; no mutation or audit insert ran.
If authorized again, reread exact current revisions/status before applying. The
/tmp script pins the observed IDs/revisions and rejects changed state. A manually
submitted examination and released bonus results must not be incidentally reopened.

## Renewed instruction: full attempt reset

User subsequently authorized: "do not preserve the saved answer, reset everything".
This replaces the earlier preserve-answer proposal. Scope is Progress's examination
attempt in Wyn City's October cycle: clear all answers, start/deadline/submission,
timeout/grade snapshots; assign a fresh shuffled10-question paper from the same
configured bank; retain configured8minute duration/marks. Full time starts on next
Start examination. No other employee, colleague appraisal ratings, attendance,
question bank, allocations or cycle results belong to this operation.

Prepared /tmp/reset-progress-october-exam-full.cjs, syntax checked and reviewed.
It revalidates exact tenant/user/cycle/attempt identities and collecting state,
rejects published results, and atomically updates attempt+cycle revisions and audit
log. Assertions check empty answers,10unique valid questionIDs,clear grades/timing,
and unchanged configured duration/marks before commit, then reread after commit.
Applied successfully and verified after commit on2026-10-19. Progress's attempt
revision2→3; saved answers1→0; startedAt/expiresAt/submittedAt absent; grade/timeout
fields cleared;10unique fresh sampled/shuffled IDs verified against configured
bank; duration8minutes retained. Cycle revision incremented atomically and audit
PEER_EXAM_ATTEMPT_RESET recorded. User should refresh employee page, then Start
examination. No additional live data edits needed.
