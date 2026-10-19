# Weighted and timed examinations implementation plan

Execute inline, one agent, no commits/deployment/live data changes. User requested
editable marks for each question, AI marks based on difficulty, and exam time.
Extend existing models/services/UI rather than create a parallel exam system.

## Decisions

- Question marks: positive integers1–20, editable independently. Optional difficulty
  easy/medium/hard; AI must supply matching marks1/2/3 respectively, editable after
  acceptance. Supplied PDF retains2 unless owner changes it. Score uses earned
  marks / maximum assigned marks, normalized to100; combined bonus remains exact.
- New draft editor duration: configurable1–240minutes, default30 (implementation
  choice); legacy saved definitions without duration remain untimed until edited.
- Explicit Start examination freezes server startedAt/expiresAt. Questions hidden
  until start; page reload never resets time. Start is idempotent. Timer enforced
  by server, not client clock. No live question IDs/keys exposed before start.
- At deadline, server finalizes only already saved answers, unanswered zero.
  Expiry checked on own read/write and owner close; no scheduler necessary.
  UI autosaves while answering and requests finalization at expiry. Late answers
  cannot improve a score. Manual early submission still requires all answers.
- Each person still receives10 unique frozen randomized questions. Different
  subsets can have different max marks; always display actual assigned total.
- Legacy equal-mark results/attempts preserve original percentages; new weighted
  attempt earnedMarks/maxMarks snapshots used in combined exact fraction.

## Files and tests

Server: extend exam/attempt schemas, exam-rules weights/validation, exam-ai rubric;
new exam-timing.js focused pure helpers, exam-attempt.js views/finalization;
exam-reviews start/deadline access, examination settings/launch, exam-results expiry
before readiness and weighted bonus. Add start route/controller.
Frontend: services types/start API; question editor marks/difficulty; setup duration
and summary; separate use-employee-exam hook plus timer/start UI to keep files small.

- [x] RED tests weighted unequal grading/bonus and legacy results, invalid marks/
  duration, AI difficulty/marks validation. Implement and rerun.
- [x] RED tests explicit start/idempotency, time immutability, deadline enforcement,
  saved-only expiry grading/closure, unstarted papers hidden and tenant isolation.
- [x] RED UI marks/duration save, AI preview weights, start/timer/autosave/expiry and
  weighted totals/results; implement and verify scoped types.
- [x] Full server/appraisal UI and disposable Mongo HTTP workflow; self-review keys,
  concurrent saves/expiry and exact arithmetic. Update domain/resume/memory docs.

Design: keep existing red (#b20202) actions, white/gray cards, existing typography.
Marks/difficulty sit beside answer controls; duration alongside attendance settings.
Employee start card clearly states question count, marks, duration and saved-only
expiry rule. Countdown is a sticky text status, amber near expiry; no ticking
screen-reader live announcement. No animation needed.
