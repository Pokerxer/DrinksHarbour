const P = require('../../models/PeerAppraisalParticipant');
const R = require('../../models/PeerAppraisalRating');
const { NotFoundError, ConflictError, ValidationError, ForbiddenError } = require('../../utils/errors');
const { validateRatings } = require('./rules');
const { mutate, requireState } = require('./store');
async function save({ tenantId, cycleId, reviewerId, ratings, expectedRevision }, submit) {
  return mutate(tenantId, cycleId, async (cycle, session) => {
    if (!['collecting', 'closed'].includes(cycle.status)) requireState(cycle, 'collecting');
    const people = await P.find({ tenant: tenantId, cycle: cycleId }).session(session).lean();
    const me = people.find(p => String(p.employee) === String(reviewerId));
    if (!me) throw new NotFoundError('Appraisal not found.');
    if (me.isAppraiser === false) throw new ForbiddenError('You are not selected to appraise in this cycle.');
    const normalized = validateRatings(people.filter(p => String(p.employee) !== String(reviewerId)).map(p => p.employee), ratings, { complete: submit });
    if (me.submittedAt) {
      const existing = await R.find({ tenant: tenantId, cycle: cycleId, reviewer: reviewerId }).session(session).lean();
      const identical = submit && existing.length === normalized.length && normalized.every(r => existing.some(e => String(e.subject) === r.subject && e.rating === r.rating));
      if (identical) return { submittedAt: me.submittedAt, revision: me.reviewRevision };
      throw new ConflictError('Submitted ratings cannot be changed.');
    }
    requireState(cycle, 'collecting');
    if (!Number.isInteger(expectedRevision) || expectedRevision < 0) throw new ValidationError('A valid review revision is required.');
    if (expectedRevision !== me.reviewRevision) throw new ConflictError('This form has changed. Reload before saving again.');
    // Replace the author’s full draft snapshot; transaction and revision prevent stale overwrites.
    await R.deleteMany({ tenant: tenantId, cycle: cycleId, reviewer: reviewerId }).session(session);
    if (normalized.length) await R.insertMany(normalized.map(r => ({ ...r, tenant: tenantId, cycle: cycleId, reviewer: reviewerId })), { session });
    const submittedAt = submit ? new Date() : null;
    await P.updateOne({ _id: me._id, tenant: tenantId, cycle: cycleId }, { $inc: { reviewRevision: 1 }, $set: { submittedAt } }, { session });
    return { submittedAt, revision: me.reviewRevision + 1 };
  });
}
module.exports = { savePeerDraft: args => save(args, false), submitPeerReview: args => save(args, true) };
