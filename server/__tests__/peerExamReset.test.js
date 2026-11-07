const test = require('node:test');
const assert = require('node:assert/strict');
const { resetAttempt } = require('../services/peerAppraisal/exam-administration');
test('reset clears all answer, clock and grade state while preserving paper and duration', () => {
  const attempt = { revision: 7, answers: [{ question: 'q', option: 1 }], questionIds: ['q'], durationMinutes: 8, marksPerQuestion: 2,
    startedAt: new Date(), expiresAt: new Date(), submittedAt: new Date(), timedOut: true, earnedMarks: 2, maxMarks: 2, correctCount: 1, questionCount: 1, score: 100 };
  resetAttempt(attempt, 7);
  assert.deepEqual(attempt.answers, []);
  assert.equal(attempt.revision, 8);
  assert.deepEqual(attempt.questionIds, ['q']);
  assert.equal(attempt.durationMinutes, 8);
  assert.equal(attempt.marksPerQuestion, 2);
  for (const key of ['startedAt', 'expiresAt', 'submittedAt', 'timedOut', 'earnedMarks', 'maxMarks', 'correctCount', 'questionCount', 'score']) assert.equal(attempt[key], undefined);
});
test('stale and invalid revisions cannot clear a newer attempt', () => {
  for (const revision of [0, undefined, '1', null]) {
    const attempt = { revision: 1, answers: ['preserved'] };
    assert.throws(() => resetAttempt(attempt, revision), { statusCode: 409 });
    assert.deepEqual(attempt.answers, ['preserved']);
    assert.equal(attempt.revision, 1);
  }
});
