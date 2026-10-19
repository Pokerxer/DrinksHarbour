const test = require('node:test');
const assert = require('node:assert/strict');
const { startClock, hasExpired, finishAttempt, attemptView } = require('../services/peerAppraisal/exam-attempt');
const now = new Date('2026-10-19T10:00:00Z');
const exam = { questions: [{ _id: 'q1', prompt: 'Easy', options: ['A', 'B'], correctOption: 0, marks: 1 }, { _id: 'q2', prompt: 'Hard', options: ['A', 'B'], correctOption: 1, marks: 3 }] };
test('starting freezes one server deadline and retries never extend it', () => {
  const attempt = { durationMinutes: 25, answers: [], revision: 0 };
  startClock(attempt, now);
  assert.equal(attempt.startedAt.toISOString(), '2026-10-19T10:00:00.000Z');
  assert.equal(attempt.expiresAt.toISOString(), '2026-10-19T10:25:00.000Z');
  startClock(attempt, new Date('2026-10-19T10:10:00Z'));
  assert.equal(attempt.expiresAt.toISOString(), '2026-10-19T10:25:00.000Z');
  assert.equal(hasExpired(attempt, new Date('2026-10-19T10:24:59.999Z')), false);
  assert.equal(hasExpired(attempt, new Date('2026-10-19T10:25:00Z')), true);
  assert.equal(hasExpired({ durationMinutes: 25 }), false);
  assert.equal(hasExpired({}), false);
});
test('timeout grades saved weighted answers, unanswered zero, and publishes no keys', () => {
  const attempt = { durationMinutes: 1, startedAt: now, expiresAt: new Date(now.getTime() + 60000), answers: [{ question: 'q2', option: 1 }], revision: 2 };
  finishAttempt(exam, attempt, { timedOut: true, now: new Date(now.getTime() + 120000) });
  assert.equal(attempt.earnedMarks, 3);
  assert.equal(attempt.maxMarks, 4);
  assert.equal(attempt.questionCount, 2);
  assert.equal(attempt.correctCount, 1);
  assert.equal(attempt.submittedAt.toISOString(), '2026-10-19T10:01:00.000Z');
  const visible = attemptView(attempt);
  assert.equal(visible.score, 75);
  assert.equal(visible.timedOut, true);
  assert.equal(JSON.stringify(visible).includes('correctOption'), false);
});
test('draft view reveals no grade and historical submissions retain equal-mark totals', () => {
  const draft = attemptView({ answers: [], revision: 0 });
  assert.equal(draft.score, undefined);
  assert.equal(draft.earnedMarks, undefined);
  const legacy = attemptView({ answers: [], revision: 1, submittedAt: now, correctCount: 9, questionCount: 10, marksPerQuestion: 2 });
  assert.equal(legacy.score, 90);
  assert.equal(legacy.earnedMarks, 18);
  assert.equal(legacy.maxMarks, 20);
});
