const Exam = require('../../models/PeerAppraisalExam');
const Attempt = require('../../models/PeerAppraisalExamAttempt');
const { mutate } = require('./store');
const { hasExpired, finishAttempt } = require('./exam-attempt');
async function finalizeExpired(tenantId, cycleId, exam, session) {
  const now = new Date();
  const attempts = await Attempt.find({ tenant: tenantId, cycle: cycleId, submittedAt: null, expiresAt: { $lte: now } }).session(session);
  for (const attempt of attempts) {
    if (!hasExpired(attempt, now)) continue;
    finishAttempt(exam, attempt, { timedOut: true, now });
    await attempt.save({ session });
  }
}
async function settleExpired(tenantId, cycleId) {
  if (!await Attempt.exists({ tenant: tenantId, cycle: cycleId, submittedAt: null, expiresAt: { $lte: new Date() } })) return;
  await mutate(tenantId, cycleId, async (cycle, session) => {
    if (cycle.status !== 'collecting') return;
    const exam = await Exam.findOne({ tenant: tenantId, cycle: cycleId }).session(session).lean();
    if (exam) await finalizeExpired(tenantId, cycleId, exam, session);
  });
}
module.exports = { finalizeExpired, settleExpired };
