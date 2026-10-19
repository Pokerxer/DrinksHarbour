# Progress / October examination reset — completed

User clarified one-time reset for Progress in Wyn City's October cycle. The first
preserve-answer write was declined, then user explicitly requested "do not preserve
the saved answer, reset everything" and approved the full-reset database command.

Applied2026-10-19 and verified after commit. Exact target attempt revision2→3,
saved answers1→0, cleared startedAt/expiresAt/submittedAt/timedOut and all grade
snapshots. Assigned a newly sampled/shuffled10-question paper from the configured
bank; retained frozen8minute duration and configured marks. The employee should
refresh /appraisals/peer/[cycleId] and Start examination again for the full8minutes.

Transaction checked exact tenant/user/cycle/attempt identity, collecting cycle and
absence of published results. Attempt/cycle revisions and audit entry
PEER_EXAM_ATTEMPT_RESET committed atomically. Assertions verified empty answers,
10unique valid assignedIDs, clear timing/submission/grade and configured duration;
a fresh post-commit read verified the final state. Script exited0 and disconnected.
No other employees, peer ratings, attendance, allocation, question bank or released
results edited. No app code changes/deploy/commit. Do not rerun: reset complete.

Operational script: /tmp/reset-progress-october-exam-full.cjs.
Plan: docs/superpowers/plans/2026-10-19-exam-timer-reset.md.
