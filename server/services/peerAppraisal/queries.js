const P = require('../../models/PeerAppraisalParticipant');
const R = require('../../models/PeerAppraisalRating');
const Cycle = require('../../models/AppraisalCycle');
const User = require('../../models/User');
const { TENANT_ROLES } = require('../appraisal.helpers');
const { loadCycle } = require('./store');
const { NotFoundError, ConflictError } = require('../../utils/errors');
function resultView(p) {
  return { averageScore: p.result.averageScore, ratingCount: p.result.ratingCount, bonusMinor: p.result.bonusMinor, allocationMinor: p.allocationMinor, currency: 'NGN' };
}
function participantView(p, closed) {
  return { employee: String(p.employee), displayName: p.displayName, allocationMinor: p.allocationMinor, submittedAt: p.submittedAt || null, ...(closed && p.result ? { result: resultView(p) } : {}) };
}
async function ownParticipant(tenantId, cycleId, employee) {
  const person = await P.findOne({ tenant: tenantId, cycle: cycleId, employee }).lean();
  if (!person) throw new NotFoundError('Appraisal not found.');
  return person;
}
async function myCycles(tenantId, employee) {
  const people = await P.find({ tenant: tenantId, employee }).select('cycle submittedAt').lean();
  const cycles = await Cycle.find({ tenant: tenantId, mode: 'peer_rating', status: { $in: ['collecting', 'closed', 'cancelled'] }, _id: { $in: people.map(p => p.cycle) } }).sort({ createdAt: -1 }).lean();
  return cycles.map(c => ({ _id: c._id, name: c.name, status: c.status, submittedAt: people.find(p => String(p.cycle) === String(c._id))?.submittedAt || null }));
}
async function ownReview(tenantId, cycleId, employee) {
  const me = await ownParticipant(tenantId, cycleId, employee);
  const cycle = await loadCycle(tenantId, cycleId);
  const people = await P.find({ tenant: tenantId, cycle: cycleId, employee: { $ne: employee } }).select('employee displayName').lean();
  const ratings = await R.find({ tenant: tenantId, cycle: cycleId, reviewer: employee }).select('subject rating').lean();
  return { name: cycle.name, status: cycle.status, submittedAt: me.submittedAt || null, revision: me.reviewRevision, colleagues: people.map(p => ({ employee: String(p.employee), displayName: p.displayName })), ratings: ratings.map(r => ({ subject: String(r.subject), rating: r.rating })) };
}
async function ownResult(tenantId, cycleId, employee) {
  const me = await ownParticipant(tenantId, cycleId, employee);
  const cycle = await loadCycle(tenantId, cycleId);
  if (cycle.status !== 'closed' || !me.result) throw new ConflictError('Results are available after HR closes this cycle.');
  return resultView(me);
}
async function hrParticipants(tenantId, cycleId) {
  const cycle = await loadCycle(tenantId, cycleId);
  const people = await P.find({ tenant: tenantId, cycle: cycleId }).lean();
  const users = await User.find({ tenant: tenantId, _id: { $in: people.map(p => p.employee) } }).select('_id status').lean();
  return { status: cycle.status, revision: cycle.revision || 0, total: people.length, submitted: people.filter(p => p.submittedAt).length,
    participants: people.map(p => ({ ...participantView(p, cycle.status === 'closed'), unavailable: !users.some(u => String(u._id) === String(p.employee) && u.status === 'active') })) };
}
async function eligibleEmployees(tenantId) {
  const people = await User.find({ tenant: tenantId, role: { $in: TENANT_ROLES }, status: 'active' }).select('firstName lastName').sort({ firstName: 1, lastName: 1 }).lean();
  return people.map(p => ({ employee: String(p._id), displayName: `${p.firstName || ''} ${p.lastName || ''}`.trim() || 'Employee' }));
}
module.exports = { resultView, participantView, ownReview, ownResult, myCycles, hrParticipants, eligibleEmployees };
