const mongoose = require('mongoose');
const Cycle = require('../../models/AppraisalCycle');
const { NotFoundError, ConflictError } = require('../../utils/errors');
async function loadCycle(tenantId, cycleId, session = null) {
  const cycle = await Cycle.findOne({ _id: cycleId, tenant: tenantId, mode: 'peer_rating' }).session(session);
  if (!cycle) throw new NotFoundError('Appraisal cycle not found.');
  return cycle;
}
async function mutate(tenantId, cycleId, action) {
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(async () => {
      const cycle = await loadCycle(tenantId, cycleId, session);
      const result = await action(cycle, session);
      // All mutations write this same document, preventing transaction write skew.
      cycle.revision = (cycle.revision || 0) + 1;
      await cycle.save({ session });
      return result;
    });
  } finally { await session.endSession(); }
}
function requireState(cycle, status) {
  if (cycle.status !== status) throw new ConflictError(`This cycle must be ${status} for that action.`);
}
module.exports = { loadCycle, mutate, requireState };
