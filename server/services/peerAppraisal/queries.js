const P = require('../../models/PeerAppraisalParticipant');
const R = require('../../models/PeerAppraisalRating');
const Cycle = require('../../models/AppraisalCycle');
const Exam = require('../../models/PeerAppraisalExam');
const Attempt = require('../../models/PeerAppraisalExamAttempt');
const User = require('../../models/User');
const { TENANT_ROLES } = require('../appraisal.helpers');
const { loadCycle } = require('./store');
const { settleExpired } = require('./exam-expiry');
const { hrExamination } = require('./examination');
const { availableQuestionBanks } = require('./question-bank');
const { NotFoundError, ConflictError } = require('../../utils/errors');
function resultView(p) {
  return { averageScore: p.result.averageScore, ratingCount: p.result.ratingCount, bonusMinor: p.result.bonusMinor, allocationMinor: p.allocationMinor, currency: 'NGN', ...(p.result.composite ? { composite: { appraisalScore: p.result.composite.appraisalScore, examScore: p.result.composite.examScore, attendanceScore: p.result.composite.attendanceScore, combinedScore: p.result.composite.combinedScore, attendanceMonth: p.result.composite.attendanceMonth, attendanceFrom: p.result.composite.attendanceFrom, attendanceTo: p.result.composite.attendanceTo, calculatedAt: p.result.composite.calculatedAt } } : {}) };
}
function participantView(p, closed) {
  return { employee: String(p.employee), displayName: p.displayName, allocationMinor: p.allocationMinor, submittedAt: p.submittedAt || null, isAppraiser: p.isAppraiser !== false, ...(closed && p.result ? { result: resultView(p) } : {}) };
}
async function ownParticipant(tenantId, cycleId, employee) {
  const person = await P.findOne({ tenant: tenantId, cycle: cycleId, employee }).lean();
  if (!person) throw new NotFoundError('Appraisal not found.');
  return person;
}
async function myCycles(tenantId, employee) {
  const people = await P.find({ tenant: tenantId, employee }).select('cycle submittedAt isAppraiser').lean();
  const cycles = await Cycle.find({ tenant: tenantId, mode: 'peer_rating', status: { $in: ['collecting', 'closed', 'cancelled'] }, _id: { $in: people.map(p => p.cycle) } }).sort({ createdAt: -1 }).lean();
  const exams = await Attempt.find({ tenant: tenantId, employee }).select('cycle submittedAt').lean();
  return cycles.map(c => {
    const person = people.find(p => String(p.cycle) === String(c._id));
    const exam = exams.find(a => String(a.cycle) === String(c._id));
    return { ...(exam ? { examAssigned: true, examSubmittedAt: exam.submittedAt || null } : {}), _id: c._id, name: c.name, status: c.status, isAppraiser: person.isAppraiser !== false, submittedAt: person.submittedAt || null };
  });
}
async function ownReview(tenantId, cycleId, employee) {
  const me = await ownParticipant(tenantId, cycleId, employee);
  const cycle = await loadCycle(tenantId, cycleId);
  const hasExamination = Boolean(await Exam.exists({ tenant: tenantId, cycle: cycleId }));
  if (me.isAppraiser === false) return { hasExamination, name: cycle.name, status: cycle.status, isAppraiser: false, submittedAt: null, revision: me.reviewRevision, colleagues: [], ratings: [] };
  const people = await P.find({ tenant: tenantId, cycle: cycleId, employee: { $ne: employee } }).select('employee displayName').lean();
  const ratings = await R.find({ tenant: tenantId, cycle: cycleId, reviewer: employee }).select('subject rating').lean();
  return { hasExamination, name: cycle.name, status: cycle.status, isAppraiser: true, submittedAt: me.submittedAt || null, revision: me.reviewRevision, colleagues: people.map(p => ({ employee: String(p.employee), displayName: p.displayName })), ratings: ratings.map(r => ({ subject: String(r.subject), rating: r.rating })) };
}
async function ownResult(tenantId, cycleId, employee) {
  const me = await ownParticipant(tenantId, cycleId, employee);
  const cycle = await loadCycle(tenantId, cycleId);
  if (cycle.status !== 'closed' || !me.result) throw new ConflictError('Results are available after HR closes this cycle.');
  return resultView(me);
}
async function hrParticipants(tenantId, cycleId) {
  await settleExpired(tenantId, cycleId);
  const cycle = await loadCycle(tenantId, cycleId);
  const people = await P.find({ tenant: tenantId, cycle: cycleId }).lean();
  const users = await User.find({ tenant: tenantId, _id: { $in: people.map(p => p.employee) } }).select('_id status').lean();
  return { availableQuestionBanks: await availableQuestionBanks(tenantId), examination: await hrExamination(tenantId, cycleId), status: cycle.status, revision: cycle.revision || 0, total: people.length, appraiserTotal: people.filter(p => p.isAppraiser !== false).length, submitted: people.filter(p => p.isAppraiser !== false && p.submittedAt).length,
    participants: people.map(p => ({ ...participantView(p, cycle.status === 'closed'), unavailable: !users.some(u => String(u._id) === String(p.employee) && u.status === 'active') })) };
}
async function eligibleEmployees(tenantId) {
  const people = await User.find({ tenant: tenantId, role: { $in: TENANT_ROLES }, status: 'active' }).select('firstName lastName employeeProfile.work.department').sort({ firstName: 1, lastName: 1 }).lean();
  return people.map(p => ({ employee: String(p._id), displayName: `${p.firstName || ''} ${p.lastName || ''}`.trim() || 'Employee', department: p.employeeProfile?.work?.department ? String(p.employeeProfile.work.department) : null }));
}
module.exports = { resultView, participantView, ownReview, ownResult, myCycles, hrParticipants, eligibleEmployees };
