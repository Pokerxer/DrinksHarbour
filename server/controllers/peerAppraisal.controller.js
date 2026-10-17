const mongoose = require('mongoose');
const Cycle = require('../models/AppraisalCycle');
const { getTenantId } = require('../utils/tenantContext');
const { ValidationError } = require('../utils/errors');
const { requirePeerHr } = require('../services/peerAppraisal/access');
const life = require('../services/peerAppraisal/lifecycle');
const reviews = require('../services/peerAppraisal/reviews');
const queries = require('../services/peerAppraisal/queries');
const validId = id => typeof id === 'string' && /^[a-f\d]{24}$/i.test(id) && mongoose.isValidObjectId(id);
const handle = fn => async (req, res, next) => {
  try {
    if (req.body == null) req.body = {};
    if (typeof req.body !== 'object' || Array.isArray(req.body)) throw new ValidationError('Request body must be an object.');
    if (req.params.cycleId && !validId(req.params.cycleId)) throw new ValidationError('Invalid cycle ID.');
    res.json({ success: true, data: await fn(req) });
  } catch (err) { next(err); }
};
exports.create = handle(async req => {
  const tenant = await requirePeerHr(req);
  if (typeof req.body.name !== 'string' || !req.body.name.trim() || req.body.name.trim().length > 200) throw new ValidationError('Cycle name must contain 1–200 characters.');
  return Cycle.create({ tenant, name: req.body.name.trim(), mode: 'peer_rating', createdBy: req.user._id, peerReviewEnabled: true });
});
exports.my = handle(req => queries.myCycles(getTenantId(req), req.user._id));
exports.eligible = handle(async req => queries.eligibleEmployees(await requirePeerHr(req)));
exports.review = handle(req => queries.ownReview(getTenantId(req), req.params.cycleId, req.user._id));
exports.result = handle(req => queries.ownResult(getTenantId(req), req.params.cycleId, req.user._id));
exports.participants = handle(async req => queries.hrParticipants(await requirePeerHr(req), req.params.cycleId));
exports.replace = handle(async req => {
  const tenantId = await requirePeerHr(req);
  if (!Array.isArray(req.body.participants) || req.body.participants.some(p => !validId(p?.employee))) throw new ValidationError('Select valid employees.');
  return life.replaceRoster({ tenantId, cycleId: req.params.cycleId, participants: req.body.participants, expectedRevision: req.body.expectedRevision });
});
for (const [name, operation] of [['launch', life.launchPeerCycle], ['close', life.closePeerCycle], ['cancel', life.cancelPeerCycle]]) {
  exports[name] = handle(async req => operation({ tenantId: await requirePeerHr(req), cycleId: req.params.cycleId }));
}
for (const [name, operation] of [['save', reviews.savePeerDraft], ['submit', reviews.submitPeerReview]]) {
  exports[name] = handle(req => operation({ tenantId: getTenantId(req), cycleId: req.params.cycleId, reviewerId: req.user._id, ratings: req.body.ratings, expectedRevision: req.body.expectedRevision }));
}
