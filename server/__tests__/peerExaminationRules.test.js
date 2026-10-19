const test = require('node:test');
const assert = require('node:assert/strict');
const { validateExam, gradeAnswers, publicQuestions, combineResult, monthRange } = require('../services/peerAppraisal/exam-rules');
const questions = [{ _id: 'q1', prompt: 'First?', options: ['A', 'B'], correctOption: 1 }, { _id: 'q2', prompt: 'Second?', options: ['Yes', 'No'], correctOption: 0 }];
test('exam configuration requires a month, departments and unambiguous single-choice questions', () => {
  const input = { attendanceMonth: '2026-09', departments: ['a'], questions };
  assert.equal(validateExam(input).questions.length, 2);
  for (const change of [{ attendanceMonth: '2026-13' }, { departments: [] }, { departments: ['a', 'a'] }, { questions: [] }, { questions: [{ ...questions[0], correctOption: '1' }] }, { questions: [{ ...questions[0], options: ['same', 'same'] }] }]) {
    assert.throws(() => validateExam({ ...input, ...change }));
  }
});
test('employees never receive the answer key', () => {
  assert.deepEqual(publicQuestions(questions), questions.map(q => ({ question: q._id, prompt: q.prompt, options: q.options, marks: 1 })));
  assert.equal(JSON.stringify(publicQuestions(questions)).includes('correctOption'), false);
});
test('marking uses server keys, requires exact question membership and rejects duplicate answers', () => {
  assert.deepEqual(gradeAnswers(questions, [{ question: 'q1', option: 1 }, { question: 'q2', option: 1 }]), { correctCount: 1, questionCount: 2, earnedMarks: 1, maxMarks: 2, score: 50 });
  for (const answers of [[], [{ question: 'q1', option: 1 }], [{ question: 'other', option: 0 }], [{ question: 'q1', option: 0 }, { question: 'q1', option: 1 }], [{ question: 'q1', option: '1' }, { question: 'q2', option: 0 }], [{ question: 'q1', option: 2 }, { question: 'q2', option: 0 }]]) assert.throws(() => gradeAnswers(questions, answers));
  assert.equal(gradeAnswers(questions, [], { complete: false }).score, 0);
});
test('monthly boundaries follow the tenant calendar and reject invalid months', () => {
  const range = monthRange('2026-09', 60);
  assert.equal(range.start.toISOString(), '2026-08-31T23:00:00.000Z');
  assert.equal(range.end.toISOString(), '2026-09-30T23:00:00.000Z');
  assert.equal(monthRange('2028-02', 0).end.toISOString(), '2028-03-01T00:00:00.000Z');
  for (const value of ['bad', '2026-00', '2026-13', null]) assert.throws(() => monthRange(value, 60));
});
test('three components have equal weight and determine the bonus', () => {
  const result = combineResult({ ratings: [4, 4], attendanceScore: 90, exam: { correctCount: 1, questionCount: 2 }, allocationMinor: 5000000 });
  assert.equal(result.appraisalScore, 80);
  assert.equal(result.examScore, 50);
  assert.equal(result.combinedScore, 73.33);
  assert.equal(result.bonusMinor, 3666667);
});
test('non-exam departments use appraisal and attendance equally, not a zero exam', () => {
  const result = combineResult({ ratings: [4, 4], attendanceScore: 90, allocationMinor: 5000000 });
  assert.equal(result.examScore, undefined);
  assert.equal(result.combinedScore, 85);
  assert.equal(result.bonusMinor, 4250000);
});
test('unrated attendance blocks calculation while an actual zero is valid', () => {
  for (const attendanceScore of [null, undefined, -1, 101, NaN]) assert.throws(() => combineResult({ ratings: [5], attendanceScore, allocationMinor: 10000 }));
  assert.equal(combineResult({ ratings: [5], attendanceScore: 0, allocationMinor: 10000 }).combinedScore, 50);
});
test('bonus rounds exact component fractions once, including large allocations', () => {
  const input = { ratings: [1, 1, 2], attendanceScore: 77, exam: { correctCount: 2, questionCount: 3 }, allocationMinor: Number.MAX_SAFE_INTEGER };
  const result = combineResult(input);
  const num = 4n * 3n * 100n + 2n * 15n * 100n + 77n * 15n * 3n;
  const den = 3n * 15n * 3n * 100n;
  assert.equal(result.bonusMinor, Number((2n * num * BigInt(input.allocationMinor) + den) / (2n * den)));
});

test('monthly finalization waits for the month and any published overnight shift to finish', () => {
  const { requireCompletedAttendance } = require('../services/peerAppraisal/exam-rules');
  const range = monthRange('2026-09', 60);
  assert.throws(() => requireCompletedAttendance(range, [], new Date('2026-09-30T20:00:00Z')), /period/i);
  const overnight = [{ status: 'published', end: new Date('2026-10-01T06:00:00Z') }];
  assert.throws(() => requireCompletedAttendance(range, overnight, new Date('2026-10-01T01:00:00Z')), /shift/i);
  assert.doesNotThrow(() => requireCompletedAttendance(range, overnight, new Date('2026-10-01T07:00:00Z')));
});

test('explicit exam recipients must be a non-empty distinct list of employee IDs', () => {
  const recipientIds = ['0123456789abcdef01234567'];
  const input = { attendanceMonth: '2020-01', departments: ['a'], questions };
  assert.deepEqual(validateExam({ ...input, recipientIds }).recipientIds, recipientIds);
  assert.equal(validateExam(input).recipientIds, undefined);
  for (const value of [[], null, 'all', [recipientIds[0], recipientIds[0]], ['bad'], [12]]) {
    assert.throws(() => validateExam({ ...input, recipientIds: value }), /recipient/i);
  }
});
