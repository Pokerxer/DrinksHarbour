const P = require('../../models/PeerAppraisalParticipant');
const R = require('../../models/PeerAppraisalRating');
const User = require('../../models/User');
const { ValidationError, ConflictError } = require('../../utils/errors');
const { TENANT_ROLES } = require('../appraisal.helpers');
const { validateRoster, validateRatings, calculateResult } = require('./rules');
const { mutate, requireState } = require('./store');
const { launchExamination } = require('./examination');
const { prepareCombined, combinedFor } = require('./exam-results');
async function eligible(tenantId, entries, session) {
  const people = await User.find({ tenant: tenantId, _id: { $in: entries.map(e => e.employee) }, status: 'active', role: { $in: TENANT_ROLES } }).session(session).lean();
  if (people.length !== entries.length) throw new ValidationError('Select active employees from this business.');
  return new Map(people.map(u => [String(u._id), u]));
}
async function replaceRoster({ tenantId, cycleId, participants, expectedRevision }) {
  return mutate(tenantId, cycleId, async (cycle, session) => {
    requireState(cycle, 'draft');
    if (!Number.isInteger(expectedRevision) || expectedRevision < 0) throw new ValidationError('A valid roster revision is required.');
    if (expectedRevision !== (cycle.revision || 0)) throw new ConflictError('Roster changed in another session. Reload the saved roster before editing again.');
    const entries = validateRoster(participants);
    const users = await eligible(tenantId, entries, session);
    await P.deleteMany({ tenant: tenantId, cycle: cycleId }).session(session);
    await P.insertMany(entries.map(e => {
      const user = users.get(e.employee);
      return { ...e, tenant: tenantId, cycle: cycleId, displayName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Employee', department: user.employeeProfile?.work?.department };
    }), { session });
    return { saved: entries.length, revision: (cycle.revision || 0) + 1 };
  });
}
async function launchPeerCycle({ tenantId, cycleId }) {
  return mutate(tenantId, cycleId, async (cycle, session) => {
    if (cycle.status === 'collecting') return cycle;
    requireState(cycle, 'draft');
    const people = await P.find({ tenant: tenantId, cycle: cycleId }).session(session).lean();
    if (people.length < 2) throw new ValidationError('Select and save at least two employees before launch.');
    if (people.filter(p => p.isAppraiser !== false).length < 2) throw new ValidationError('Select at least two appraisers before launch.');
    const users = await eligible(tenantId, people, session);
    for (const person of people) {
      person.department = users.get(String(person.employee)).employeeProfile?.work?.department;
      await P.updateOne({ _id: person._id, tenant: tenantId, cycle: cycleId }, person.department ? { $set: { department: person.department } } : { $unset: { department: '' } }, { session });
    }
    await launchExamination(tenantId, cycleId, people, session);
    cycle.status = 'collecting'; cycle.launchedAt = new Date();
    return cycle;
  });
}
async function closePeerCycle({ tenantId, cycleId }) {
  return mutate(tenantId, cycleId, async (cycle, session) => {
    if (cycle.status === 'closed') return cycle;
    requireState(cycle, 'collecting');
    const people = await P.find({ tenant: tenantId, cycle: cycleId }).session(session).lean();
    const appraisers = people.filter(p => p.isAppraiser !== false);
    if (appraisers.length < 2 || appraisers.some(p => !p.submittedAt)) throw new ConflictError('Every selected appraiser must submit before this cycle can close.');
    const rows = await R.find({ tenant: tenantId, cycle: cycleId }).session(session).lean();
    for (const person of appraisers) {
      const subjects = people.filter(p => String(p.employee) !== String(person.employee)).map(p => String(p.employee));
      validateRatings(subjects, rows.filter(r => String(r.reviewer) === String(person.employee)).map(r => ({ subject: String(r.subject), rating: r.rating })), { complete: true });
    }
    if (rows.length !== appraisers.length * (people.length - 1)) throw new ConflictError('The rating roster is incomplete.');
    const combined = await prepareCombined(tenantId, cycleId, people, session);
    for (const person of people) {
      const ratings = rows.filter(r => String(r.subject) === String(person.employee)).map(r => r.rating);
      const result = combined ? combinedFor(combined, person, ratings) : calculateResult(ratings, person.allocationMinor);
      await P.updateOne({ _id: person._id, tenant: tenantId, cycle: cycleId }, { $set: { result } }, { session, runValidators: true });
    }
    cycle.status = 'closed'; cycle.closedAt = new Date();
    return cycle;
  });
}
async function cancelPeerCycle({ tenantId, cycleId }) {
  return mutate(tenantId, cycleId, async cycle => {
    if (cycle.status === 'closed') throw new ConflictError('A closed cycle cannot be cancelled.');
    cycle.status = 'cancelled'; return cycle;
  });
}
module.exports = { replaceRoster, launchPeerCycle, closePeerCycle, cancelPeerCycle };
