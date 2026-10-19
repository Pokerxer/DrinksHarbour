const { ValidationError, ConflictError } = require('../../utils/errors');
const { calculateResult } = require('./rules');
const { attendanceDates } = require('./attendance-window');
const fail = message => { throw new ValidationError(message); };
function monthRange(month, offsetMinutes = 60) {
  if (typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || Number(month.slice(0, 4)) < 2000) fail('Choose a valid attendance month.');
  const [year, m] = month.split('-').map(Number);
  const offset = offsetMinutes * 60000;
  return { start: new Date(Date.UTC(year, m - 1, 1) - offset), end: new Date(Date.UTC(year, m, 1) - offset) };
}
function requireCompletedAttendance(range, shifts, now = new Date()) {
  if (range.end > now) throw new ConflictError('The selected attendance period must end before bonuses can be finalized.');
  if (shifts.some(s => s.status === 'published' && new Date(s.end) > now)) throw new ConflictError('A shift in the selected attendance period is still in progress. Wait for it to end before finalizing.');
}
function validateQuestions(inputQuestions) {
  if (!Array.isArray(inputQuestions) || !inputQuestions.length || inputQuestions.length > 100) fail('Provide between 1 and 100 questions.');
  const questions = inputQuestions.map(q => {
    if (!q || typeof q.prompt !== 'string' || !q.prompt.trim() || q.prompt.trim().length > 500) fail('Each question needs a prompt of at most 500 characters.');
    if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 6 || q.options.some(o => typeof o !== 'string' || !o.trim() || o.trim().length > 300)) fail('Each question needs 2–6 answer options.');
    const options = q.options.map(o => o.trim());
    if (new Set(options.map(o => o.toLowerCase())).size !== options.length) fail('Answer options must be distinct.');
    if (!Number.isInteger(q.correctOption) || q.correctOption < 0 || q.correctOption >= options.length) fail('Select one correct answer for each question.');
    if (q.marks !== undefined && (!Number.isInteger(q.marks) || q.marks < 1 || q.marks > 20)) fail('Question marks must be a whole number from 1 to 20.');
    if (q.difficulty !== undefined && !['easy', 'medium', 'hard'].includes(q.difficulty)) fail('Choose easy, medium or hard difficulty.');
    return { prompt: q.prompt.trim(), options, correctOption: q.correctOption, ...(q.marks !== undefined ? { marks: q.marks } : {}), ...(q.difficulty !== undefined ? { difficulty: q.difficulty } : {}) };
  });
  if (new Set(questions.map(q => q.prompt.toLowerCase())).size !== questions.length) fail('Questions must be distinct.');
  return questions;
}
function validateExam(input) {
  if (!input || typeof input !== 'object') fail('Provide examination settings.');
  if (input.durationMinutes !== undefined && (!Number.isInteger(input.durationMinutes) || input.durationMinutes < 1 || input.durationMinutes > 240)) fail('Examination duration must be a whole number from 1 to 240 minutes.');
  const dates = attendanceDates(input);
  if (!Array.isArray(input.departments) || !input.departments.length || input.departments.length > 100 || input.departments.some(d => typeof d !== 'string' || !d) || new Set(input.departments).size !== input.departments.length) fail('Select distinct examination departments.');
  if (input.recipientIds !== undefined && (!Array.isArray(input.recipientIds) || !input.recipientIds.length || input.recipientIds.length > 10000 || input.recipientIds.some(id => typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id)) || new Set(input.recipientIds.map(id => id.toLowerCase())).size !== input.recipientIds.length)) fail('Select distinct valid examination recipients.');
  const questions = validateQuestions(input.questions);
  const count = input.questionsPerEmployee ?? questions.length;
  if (!Number.isInteger(count) || count < 1 || count > questions.length) fail('Add enough questions for the number assigned to each employee.');
  const marks = input.marksPerQuestion ?? 1;
  if (!Number.isInteger(marks) || marks < 1 || marks > 10) fail('Marks per question must be a whole number from 1 to 10.');
  return { ...dates, ...(input.recipientIds !== undefined ? { recipientIds: input.recipientIds.map(id => id.toLowerCase()) } : {}), ...(input.durationMinutes !== undefined ? { durationMinutes: input.durationMinutes } : {}), departments: input.departments, questions, questionsPerEmployee: count, marksPerQuestion: marks };
}
function publicQuestions(questions, marksPerQuestion = 1) {
  return questions.map(q => ({ question: String(q._id), prompt: q.prompt, options: [...q.options], marks: q.marks ?? marksPerQuestion }));
}
function normalizeAnswers(questions, answers, { complete = true } = {}) {
  if (!Array.isArray(answers)) fail('Answers must be a list.');
  const seen = new Set();
  const normalized = answers.map(a => {
    const q = questions.find(q => String(q._id) === a?.question);
    if (!q || seen.has(a.question) || !Number.isInteger(a.option) || a.option < 0 || a.option >= q.options.length) fail('Answer each assigned question once using a valid option.');
    seen.add(a.question);
    return { question: a.question, option: a.option };
  });
  if (complete && seen.size !== questions.length) fail('Answer every question before submitting.');
  return normalized;
}
function gradeAnswers(questions, answers, { complete = true, marksPerQuestion = 1 } = {}) {
  const normalized = normalizeAnswers(questions, answers, { complete });
  const correctCount = normalized.filter(a => questions.find(q => String(q._id) === a.question).correctOption === a.option).length;
  const maxMarks = questions.reduce((sum, q) => sum + (q.marks ?? marksPerQuestion), 0);
  const earnedMarks = normalized.reduce((sum, a) => {
    const q = questions.find(q => String(q._id) === a.question);
    return sum + (q.correctOption === a.option ? (q.marks ?? marksPerQuestion) : 0);
  }, 0);
  return { correctCount, questionCount: questions.length, earnedMarks, maxMarks, score: earnedMarks / maxMarks * 100 };
}
function combineResult({ ratings, attendanceScore, exam, allocationMinor }) {
  const base = calculateResult(ratings, allocationMinor);
  if (!Number.isInteger(attendanceScore) || attendanceScore < 0 || attendanceScore > 100) fail('A numeric attendance score is required before finalizing.');
  if (exam && (!Number.isInteger(exam.questionCount) || exam.questionCount < 1 || !Number.isInteger(exam.correctCount) || exam.correctCount < 0 || exam.correctCount > exam.questionCount)) fail('A complete examination result is required.');
  if (exam && (exam.earnedMarks !== undefined || exam.maxMarks !== undefined) && (!Number.isInteger(exam.earnedMarks) || !Number.isInteger(exam.maxMarks) || exam.maxMarks < 1 || exam.maxMarks > 2000 || exam.earnedMarks < 0 || exam.earnedMarks > exam.maxMarks)) fail('A valid weighted examination result is required.');
  const n = BigInt(5 * ratings.length);
  const sum = BigInt(ratings.reduce((a, b) => a + b, 0));
  const q = BigInt(exam?.maxMarks ?? exam?.questionCount ?? 1);
  const numerator = sum * q * 100n + BigInt(attendanceScore) * n * q + (exam ? BigInt(exam.earnedMarks ?? exam.correctCount) * n * 100n : 0n);
  const denominator = BigInt(exam ? 3 : 2) * n * q * 100n;
  const bonusMinor = Number((2n * numerator * BigInt(allocationMinor) + denominator) / (2n * denominator));
  const combinedScore = Math.round(Number(numerator) / Number(denominator) * 10000) / 100;
  return { ...base, bonusMinor, appraisalScore: base.averageScore / 5 * 100, attendanceScore, ...(exam ? { examScore: (exam.earnedMarks ?? exam.correctCount) / (exam.maxMarks ?? exam.questionCount) * 100 } : {}), combinedScore };
}
module.exports = { validateQuestions, requireCompletedAttendance, validateExam, publicQuestions, normalizeAnswers, gradeAnswers, monthRange, combineResult };
