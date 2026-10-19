const test = require('node:test');
const assert = require('node:assert/strict');
const { validateExam, gradeAnswers, combineResult, publicQuestions } = require('../services/peerAppraisal/exam-rules');
const questions = [
  { _id: 'easy', prompt: 'Easy', options: ['A', 'B'], correctOption: 0, marks: 1, difficulty: 'easy' },
  { _id: 'hard', prompt: 'Hard', options: ['A', 'B'], correctOption: 1, marks: 3, difficulty: 'hard' },
];
test('unequal question marks determine exam percentage and the exact combined bonus', () => {
  const grade = gradeAnswers(questions, [{ question: 'easy', option: 0 }, { question: 'hard', option: 0 }]);
  assert.equal(grade.earnedMarks, 1);
  assert.equal(grade.maxMarks, 4);
  assert.equal(grade.score, 25); // One of two correct, but only one of four marks.
  const result = combineResult({ ratings: [4, 4], attendanceScore: 100, allocationMinor: 1000000, exam: { ...grade } });
  assert.equal(result.examScore, 25);
  assert.equal(result.combinedScore, 68.33);
  assert.equal(result.bonusMinor, 683333);
});
test('partial expired papers count unanswered questions as zero and retain full maximum', () => {
  const grade = gradeAnswers(questions, [{ question: 'hard', option: 1 }], { complete: false });
  assert.equal(grade.earnedMarks, 3);
  assert.equal(grade.maxMarks, 4);
  assert.equal(grade.score, 75);
  assert.equal(gradeAnswers(questions, [], { complete: false }).score, 0);
});
test('legacy question marks and submitted results keep their historical scores', () => {
  const legacy = questions.map(({ marks, difficulty, ...q }) => q);
  const grade = gradeAnswers(legacy, [{ question: 'easy', option: 0 }, { question: 'hard', option: 0 }], { marksPerQuestion: 2 });
  assert.equal(grade.earnedMarks, 2);
  assert.equal(grade.maxMarks, 4);
  assert.equal(grade.score, 50);
  const result = combineResult({ ratings: [4, 4], attendanceScore: 100, allocationMinor: 1000000, exam: { correctCount: 1, questionCount: 2 } });
  assert.equal(result.examScore, 50);
});
test('configuration validates editable question marks, difficulty and exam duration', () => {
  const config = { attendanceFrom: '2026-09-01', attendanceTo: '2026-09-30', departments: ['d'], questions, durationMinutes: 25 };
  const clean = validateExam(config);
  assert.equal(clean.durationMinutes, 25);
  assert.equal(clean.questions[1].marks, 3);
  assert.equal(clean.questions[1].difficulty, 'hard');
  for (const marks of [0, -1, 1.5, 21, '3', null]) assert.throws(() => validateExam({ ...config, questions: [{ ...questions[0], marks }] }));
  for (const durationMinutes of [0, -1, 1.5, 241, '30', null]) assert.throws(() => validateExam({ ...config, durationMinutes }));
  assert.throws(() => validateExam({ ...config, questions: [{ ...questions[0], difficulty: 'impossible' }] }));
  assert.equal(validateExam({ ...config, durationMinutes: undefined }).durationMinutes, undefined);
  const visible = publicQuestions(questions);
  assert.equal(visible[1].marks, 3);
  assert.equal(JSON.stringify(visible).includes('correctOption'), false);
});
