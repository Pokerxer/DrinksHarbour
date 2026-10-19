const test = require('node:test');
const assert = require('node:assert/strict');
const { validateExam } = require('../services/peerAppraisal/exam-rules');
const { attendanceWindow } = require('../services/peerAppraisal/attendance-window');
const { selectQuestionIds, assignedQuestions } = require('../services/peerAppraisal/exam-assignment');
test('inclusive date ranges follow tenant time and validate bounds', () => {
  const range = attendanceWindow({ attendanceFrom: '2026-09-10', attendanceTo: '2026-09-20' }, 60);
  assert.equal(range.start.toISOString(), '2026-09-09T23:00:00.000Z');
  assert.equal(range.end.toISOString(), '2026-09-20T23:00:00.000Z');
  for (const input of [{ attendanceFrom: '2026-02-30', attendanceTo: '2026-03-05' }, { attendanceFrom: '2026-09-10', attendanceTo: '2026-09-01' }, { attendanceFrom: '2026-09-01' }, { attendanceFrom: '2020-01-01', attendanceTo: '2026-01-01' }]) assert.throws(() => attendanceWindow(input, 60));
  assert.equal(attendanceWindow({ attendanceMonth: '2026-09' }, 60).end.toISOString(), '2026-09-30T23:00:00.000Z');
});
test('every employee gets 10 unique shuffled IDs and a fixed order after launch', () => {
  const questions = Array.from({ length: 30 }, (_, i) => ({ _id: String(i) }));
  const ids = selectQuestionIds(questions, 10, () => 0);
  assert.equal(ids.length, 10);
  assert.equal(new Set(ids).size, 10);
  assert.notDeepEqual(ids, questions.slice(0, 10).map(q => q._id));
  assert.deepEqual(assignedQuestions({ questions }, { questionIds: ids }).map(q => q._id), ids);
  assert.equal(assignedQuestions({ questions }, {}).length, 30);
  assert.throws(() => selectQuestionIds(questions.slice(0, 9), 10));
});
test('source bank has all 30 supplied correct answers and the updated Champagne question', () => {
  const bank = require('../data/examinations/wyn-city-drinks-30.json');
  assert.equal(bank.questions.length, 30);
  const key = ['B','C','B','C','B','A','C','A','C','B','B','B','A','C','A','B','A','B','B','B','A','B','A','A','A','A','B','B','A','B'];
  assert.deepEqual(bank.questions.map(q => 'ABCD'[q.correctOption]), key);
  assert.match(bank.questions[26].prompt, /sparkling wine and Champagne/);
  assert.equal(bank.marksPerQuestion, 2);
  const result = validateExam({ attendanceFrom: '2026-09-01', attendanceTo: '2026-09-30', departments: ['d'], ...bank });
  assert.equal(result.questionsPerEmployee, 10);
  assert.throws(() => validateExam({ ...result, questionsPerEmployee: 31 }));
});
