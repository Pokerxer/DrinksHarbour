const Participant = require('../../models/PeerAppraisalParticipant');
const Attempt = require('../../models/PeerAppraisalExamAttempt');
const Audit = require('../../models/AuditLog');
const { ConflictError, NotFoundError } = require('../../utils/errors');
const { mutate, requireState } = require('./store');
const cleared = ['startedAt', 'expiresAt', 'submittedAt', 'timedOut', 'earnedMarks', 'maxMarks', 'correctCount', 'questionCount', 'score'];
function resetAttempt(attempt, expectedRevision) {
  if (!Number.isInteger(expectedRevision) || expectedRevision !== attempt.revision) throw new ConflictError('This examination changed. Refresh progress before resetting it.');
  attempt.answers = [];
  for (const key of cleared) attempt[key] = undefined;
  attempt.revision += 1;
}
function summary(attempt) {
  return { revision: attempt.revision, savedAnswers: attempt.answers?.length || 0, startedAt: attempt.startedAt || null, expiresAt: attempt.expiresAt || null, submittedAt: attempt.submittedAt || null, durationMinutes: attempt.durationMinutes };
}
async function resetEmployeeExam({ tenantId, cycleId, employee, expectedRevision, expectedCycleRevision, actor }) {
  return mutate(tenantId, cycleId, async (cycle, session) => {
    requireState(cycle, 'collecting');
    if (!Number.isInteger(expectedCycleRevision) || expectedCycleRevision !== cycle.revision) throw new ConflictError('Cycle changed. Refresh progress before resetting an examination.');
    const scope = { tenant: tenantId, cycle: cycleId, employee };
    const person = await Participant.findOne(scope).session(session).lean();
    if (!person) throw new NotFoundError('Employee is not in this appraisal cycle.');
    if (person.result) throw new ConflictError('Released results cannot be reset.');
    const attempt = await Attempt.findOne(scope).session(session);
    if (!attempt) throw new NotFoundError('Employee is not assigned this examination.');
    const before = summary(attempt);
    resetAttempt(attempt, expectedRevision);
    await attempt.save({ session });
    await Audit.create([{ actorUserId: actor._id, actorRole: actor.role, action: 'PEER_EXAM_ATTEMPT_RESET', actionCategory: 'update', targetType: 'PeerAppraisalExamAttempt', targetId: attempt._id, targetTenantId: tenantId, justification: 'Owner reset examination answers, timer and grade from appraisal cycle.', changes: { before, after: summary(attempt) }, result: 'success' }], { session });
    return { revision: cycle.revision + 1, attemptRevision: attempt.revision };
  });
}
module.exports = { resetAttempt, resetEmployeeExam };
