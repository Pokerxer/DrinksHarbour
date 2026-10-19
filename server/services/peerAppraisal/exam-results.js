const { selectedRecipients } = require('./exam-recipients');
const Exam = require('../../models/PeerAppraisalExam');
const Attempt = require('../../models/PeerAppraisalExamAttempt');
const { ConflictError } = require('../../utils/errors');
const { monthlyScores } = require('./monthly-attendance');
const { finalizeExpired } = require('./exam-expiry');
const { combineResult } = require('./exam-rules');
async function prepareCombined(tenantId, cycleId, people, session) {
  const exam = await Exam.findOne({ tenant: tenantId, cycle: cycleId }).session(session).lean();
  if (!exam) return null;
  await finalizeExpired(tenantId, cycleId, exam, session);
  const attempts = await Attempt.find({ tenant: tenantId, cycle: cycleId }).session(session).lean();
  const assigned = selectedRecipients(exam, people);
  if (!assigned.length || assigned.some(p => !attempts.find(a => String(a.employee) === String(p.employee))?.submittedAt)) throw new ConflictError('Every assigned employee must submit their examination before this cycle can close.');
  const attendance = await monthlyScores(tenantId, people, exam, session);
  return { exam, attempts, ...attendance };
}
function combinedFor(context, person, ratings) {
  const attempt = context.attempts.find(a => String(a.employee) === String(person.employee));
  const calculated = combineResult({ ratings, allocationMinor: person.allocationMinor, attendanceScore: context.scores.get(String(person.employee)), ...(attempt ? { exam: attempt } : {}) });
  const { bonusMinor, averageScore, ratingCount, ...scores } = calculated;
  return { averageScore, ratingCount, bonusMinor, composite: { ...scores, attendanceMonth: context.exam.attendanceMonth, attendanceFrom: context.attendanceFrom, attendanceTo: context.attendanceTo, calculatedAt: context.calculatedAt } };
}
module.exports = { prepareCombined, combinedFor };
