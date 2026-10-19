const mongoose = require('mongoose');
const { getTenantId } = require('../utils/tenantContext');
const { requirePeerHr } = require('../services/peerAppraisal/access');
const { ValidationError } = require('../utils/errors');
const { loadCycle, requireState } = require('../services/peerAppraisal/store');
const { loadQuestionBank } = require('../services/peerAppraisal/question-bank');
const { generateQuestions } = require('../services/peerAppraisal/exam-ai');
const { saveConfiguration } = require('../services/peerAppraisal/examination');
const { ownExam, startExam, saveExamDraft, submitExam } = require('../services/peerAppraisal/exam-reviews');
const handle = fn => async (req, res, next) => {
  try {
    if (typeof req.params.cycleId !== 'string' || !/^[a-f\d]{24}$/i.test(req.params.cycleId) || !mongoose.isValidObjectId(req.params.cycleId)) throw new ValidationError('Invalid cycle ID.');
    if (req.body != null && (typeof req.body !== 'object' || Array.isArray(req.body))) throw new ValidationError('Request body must be an object.');
    res.json({ success: true, data: await fn(req) });
  } catch (e) { next(e); }
};
exports.configure = handle(async req => saveConfiguration({ tenantId: await requirePeerHr(req), cycleId: req.params.cycleId, expectedRevision: req.body?.expectedRevision, configuration: req.body?.enabled === false ? null : req.body }));
exports.start = handle(req => startExam({ tenantId: getTenantId(req), cycleId: req.params.cycleId, employee: req.user._id }));
exports.own = handle(req => ownExam(getTenantId(req), req.params.cycleId, req.user._id));
for (const [key, operation] of [['draft', saveExamDraft], ['submit', submitExam]]) exports[key] = handle(req => operation({ tenantId: getTenantId(req), cycleId: req.params.cycleId, employee: req.user._id, answers: req.body?.answers, expectedRevision: req.body?.expectedRevision }));

exports.bank = handle(async req => {
  const tenantId = await requirePeerHr(req);
  requireState(await loadCycle(tenantId, req.params.cycleId), 'draft');
  return loadQuestionBank(tenantId, req.params.bankId);
});
exports.generate = handle(async req => {
  const tenantId = await requirePeerHr(req);
  requireState(await loadCycle(tenantId, req.params.cycleId), 'draft');
  return generateQuestions(req.body);
});
