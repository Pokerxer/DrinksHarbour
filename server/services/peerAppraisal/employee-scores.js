const P = require('../../models/PeerAppraisalParticipant');
const R = require('../../models/PeerAppraisalRating');
const Exam = require('../../models/PeerAppraisalExam');
const Attempt = require('../../models/PeerAppraisalExamAttempt');
const { loadCycle } = require('./store');
const { settleExpired } = require('./exam-expiry');
const { attendancePreview } = require('./attendance-preview');
const { combineResult, scoreWeights } = require('./exam-rules');
const { calculateResult } = require('./rules');
const { resultView } = require('./queries');
const { NotFoundError } = require('../../utils/errors');
function examinationScore(attempt, exam, person) {
  if (!attempt) {
    const assigned = exam && (exam.recipientIds !== undefined ? exam.recipientIds.some(id => String(id) === String(person.employee)) : exam.departments.some(id => String(id) === String(person.department)));
    return { score: null, status: assigned ? 'not_started' : 'not_assigned' };
  }
  if (!attempt.submittedAt) return { score: null, status: attempt.startedAt || attempt.answers?.length ? 'in_progress' : 'not_started' };
  const earnedMarks = attempt.earnedMarks ?? attempt.correctCount * (attempt.marksPerQuestion ?? 1);
  const maxMarks = attempt.maxMarks ?? attempt.questionCount * (attempt.marksPerQuestion ?? 1);
  return { score: earnedMarks / maxMarks * 100, earnedMarks, maxMarks, status: attempt.timedOut ? 'timed_out' : 'submitted' };
}
function frozenScores(person, cycle, attempt, eligible) {
  const stored = resultView(person), composite = stored.composite;
  const hasExam = composite?.examScore !== undefined;
  const weights = composite ? composite.weights ?? { appraisal: hasExam ? 100 / 3 : 50, exam: hasExam ? 100 / 3 : 0, attendance: hasExam ? 100 / 3 : 50 } : { appraisal: 100, exam: 0, attendance: 0 };
  const exam = { score: composite?.examScore ?? null, status: hasExam ? attempt?.timedOut ? 'timed_out' : 'submitted' : 'not_assigned', ...(hasExam && attempt?.earnedMarks !== undefined ? { earnedMarks: attempt.earnedMarks, maxMarks: attempt.maxMarks } : {}) };
  return {
    employee: String(person.employee), displayName: person.displayName, cycleStatus: cycle.status, final: true, allocationMinor: person.allocationMinor, weights,
    appraisal: { score: composite?.appraisalScore ?? stored.averageScore * 20, averageScore: stored.averageScore, received: stored.ratingCount, eligible, status: 'complete' },
    exam,
    attendance: composite ? { score: composite.attendanceScore, status: 'complete', attendanceFrom: composite.attendanceFrom, attendanceTo: composite.attendanceTo } : { score: null, status: 'not_configured' },
    combined: { score: composite?.combinedScore ?? stored.averageScore * 20, bonusMinor: stored.bonusMinor },
  };
}
async function employeeScores(tenantId, cycleId, employeeId) {
  await settleExpired(tenantId, cycleId);
  const cycle = await loadCycle(tenantId, cycleId);
  const people = await P.find({ tenant: tenantId, cycle: cycleId }).lean();
  const person = people.find(p => String(p.employee) === String(employeeId));
  if (!person) throw new NotFoundError('Employee is not in this appraisal cycle.');
  const appraisers = people.filter(p => p.isAppraiser !== false && String(p.employee) !== String(person.employee));
  const [exam, attempt] = await Promise.all([
    Exam.findOne({ tenant: tenantId, cycle: cycleId }).lean(),
    Attempt.findOne({ tenant: tenantId, cycle: cycleId, employee: employeeId }).lean(),
  ]);
  if (cycle.status === 'closed' && person.result) return frozenScores(person, cycle, attempt, appraisers.length);
  const submittedIds = appraisers.filter(p => p.submittedAt).map(p => p.employee);
  const rows = await R.find({ tenant: tenantId, cycle: cycleId, subject: employeeId, reviewer: { $in: submittedIds } }).select('rating').lean();
  const ratings = rows.map(row => row.rating);
  const average = ratings.length ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length : null;
  const complete = appraisers.length > 0 && ratings.length === appraisers.length;
  const appraisal = { score: average === null ? null : average * 20, averageScore: average, received: ratings.length, eligible: appraisers.length, status: complete ? 'complete' : ratings.length ? 'provisional' : 'pending' };
  const examination = examinationScore(attempt, exam, person);
  const attendance = await attendancePreview(tenantId, employeeId, exam);
  const hasExam = examination.status !== 'not_assigned';
  const weights = exam ? scoreWeights(hasExam) : { appraisal: 100, exam: 0, attendance: 0 };
  let combined = null;
  if (cycle.status === 'collecting' && complete && (!exam || attendance.status === 'complete' && (!hasExam || attempt?.submittedAt))) {
    const result = exam ? combineResult({ ratings, allocationMinor: person.allocationMinor, attendanceScore: attendance.score, ...(hasExam ? { exam: attempt } : {}) }) : calculateResult(ratings, person.allocationMinor);
    combined = { score: result.combinedScore ?? result.averageScore * 20, bonusMinor: result.bonusMinor };
  }
  return { employee: String(person.employee), displayName: person.displayName, cycleStatus: cycle.status, final: false, allocationMinor: person.allocationMinor, weights, appraisal, exam: examination, attendance, combined };
}
module.exports = { employeeScores };
