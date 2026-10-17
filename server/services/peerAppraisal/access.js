const { getTenantId } = require('../../utils/tenantContext');
const { ForbiddenError, NotFoundError } = require('../../utils/errors');
const { departmentScopeFor } = require('../appraisalScope.service');
const Participant = require('../../models/PeerAppraisalParticipant');
async function requirePeerHr(req) {
  const tenantId = getTenantId(req);
  if (!['tenant_owner', 'tenant_admin', 'super_admin', 'admin'].includes(req.user?.role) ||
      await departmentScopeFor(req) !== null) {
    throw new ForbiddenError('Business-wide appraisals require unrestricted HR access.');
  }
  return tenantId;
}
async function loadOwnParticipant(req, cycleId, session = null) {
  const row = await Participant.findOne({ tenant: getTenantId(req), cycle: cycleId, employee: req.user._id }).session(session).lean();
  if (!row) throw new NotFoundError('Appraisal not found.');
  return row;
}
module.exports = { requirePeerHr, loadOwnParticipant };
