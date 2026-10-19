const { gradeAnswers } = require('./exam-rules');
const { assignedQuestions } = require('./exam-assignment');
function startClock(attempt, now = new Date()) {
  if (attempt.startedAt || attempt.submittedAt) return;
  attempt.startedAt = now;
  if (attempt.durationMinutes) attempt.expiresAt = new Date(now.getTime() + attempt.durationMinutes * 60000);
  attempt.revision += 1;
}
function hasExpired(attempt, now = new Date()) {
  return Boolean(!attempt.submittedAt && attempt.expiresAt && new Date(attempt.expiresAt) <= now);
}
function finishAttempt(exam, attempt, { timedOut = false, now = new Date() } = {}) {
  const grade = gradeAnswers(assignedQuestions(exam, attempt), attempt.answers.map(a => ({ question: String(a.question), option: a.option })), { complete: !timedOut, marksPerQuestion: attempt.marksPerQuestion ?? 1 });
  for (const key of ['correctCount', 'questionCount', 'earnedMarks', 'maxMarks']) attempt[key] = grade[key];
  attempt.timedOut = timedOut;
  attempt.submittedAt = timedOut ? new Date(attempt.expiresAt) : now;
  attempt.revision += 1;
}
function attemptView(attempt, now = new Date()) {
  const earned = attempt.earnedMarks ?? attempt.correctCount * (attempt.marksPerQuestion ?? 1);
  const maximum = attempt.maxMarks ?? attempt.questionCount * (attempt.marksPerQuestion ?? 1);
  return { revision: attempt.revision, submittedAt: attempt.submittedAt || null, startedAt: attempt.startedAt || null, expiresAt: attempt.expiresAt || null, durationMinutes: attempt.durationMinutes, serverNow: now.toISOString(), answers: attempt.answers.map(a => ({ question: String(a.question), option: a.option })), ...(attempt.submittedAt ? { correctCount: attempt.correctCount, questionCount: attempt.questionCount, earnedMarks: earned, maxMarks: maximum, timedOut: Boolean(attempt.timedOut), score: earned / maximum * 100 } : {}) };
}
module.exports = { startClock, hasExpired, finishAttempt, attemptView };
