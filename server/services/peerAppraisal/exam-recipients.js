const P = require('../../models/PeerAppraisalParticipant');
const User = require('../../models/User');
const { TENANT_ROLES } = require('../appraisal.helpers');
const { ValidationError } = require('../../utils/errors');
function selectedRecipients(exam, people) {
  const eligible = people.filter(p => exam.departments.some(d => String(d) === String(p.department)));
  if (exam.recipientIds === undefined) return eligible;
  const ids = new Set(exam.recipientIds.map(String));
  const selected = eligible.filter(p => ids.has(String(p.employee)));
  if (!ids.size || selected.length !== ids.size) throw new ValidationError('Selected examination recipients must belong to the saved cycle roster and selected departments. Review the recipient selection.');
  return selected;
}
async function validateRecipients(tenantId, cycleId, exam, session) {
  if (exam.recipientIds === undefined) return;
  const roster = await P.find({ tenant: tenantId, cycle: cycleId, employee: { $in: exam.recipientIds } }).session(session).lean();
  const users = await User.find({ tenant: tenantId, _id: { $in: exam.recipientIds }, status: 'active', role: { $in: TENANT_ROLES } }).select('_id employeeProfile.work.department').session(session).lean();
  const current = new Map(users.map(u => [String(u._id), u.employeeProfile?.work?.department]));
  selectedRecipients(exam, roster.filter(p => current.has(String(p.employee))).map(p => ({ ...p, department: current.get(String(p.employee)) })));
}
module.exports = { selectedRecipients, validateRecipients };
