const P = require('../../models/PeerAppraisalParticipant');
const Exam = require('../../models/PeerAppraisalExam');
const Attempt = require('../../models/PeerAppraisalExamAttempt');
const { NotFoundError, ForbiddenError, ConflictError } = require('../../utils/errors');
const { publicQuestions, normalizeAnswers } = require('./exam-rules');
const { loadCycle, mutate, requireState } = require('./store');
const { assignedQuestions } = require('./exam-assignment');
const { attendanceDates } = require('./attendance-window');
const { startClock, hasExpired, finishAttempt, attemptView } = require('./exam-attempt');
const { settleExpired } = require('./exam-expiry');
async function ownMember(tenantId, cycleId, employee, session = null) {
  const me = await P.findOne({ tenant: tenantId, cycle: cycleId, employee }).session(session).lean();
  if (!me) throw new NotFoundError('Appraisal not found.');
}
async function ownExam(tenantId, cycleId, employee) {
  await ownMember(tenantId, cycleId, employee);
  await settleExpired(tenantId, cycleId);
  const cycle = await loadCycle(tenantId, cycleId);
  const exam = await Exam.findOne({ tenant: tenantId, cycle: cycleId }).lean();
  const attempt = await Attempt.findOne({ tenant: tenantId, cycle: cycleId, employee }).lean();
  if (!exam || !attempt) return { assigned: false, status: cycle.status };
  const assigned = assignedQuestions(exam, attempt);
  const needsStart = Boolean(attempt.durationMinutes && !attempt.startedAt && !attempt.submittedAt);
  return { assigned: true, status: cycle.status, ...attendanceDates(exam), marksPerQuestion: attempt.marksPerQuestion ?? 1, questionCount: assigned.length, maxMarks: assigned.reduce((n, q) => n + (q.marks ?? attempt.marksPerQuestion ?? 1), 0), questions: needsStart ? [] : publicQuestions(assigned, attempt.marksPerQuestion ?? 1), ...attemptView(attempt) };
}
async function startExam({ tenantId, cycleId, employee }) {
  await mutate(tenantId, cycleId, async (cycle, session) => {
    requireState(cycle, 'collecting');
    await ownMember(tenantId, cycleId, employee, session);
    const attempt = await Attempt.findOne({ tenant: tenantId, cycle: cycleId, employee }).session(session);
    if (!attempt) throw new ForbiddenError('You are not assigned this examination.');
    if (hasExpired(attempt)) {
      const exam = await Exam.findOne({ tenant: tenantId, cycle: cycleId }).session(session).lean();
      finishAttempt(exam, attempt, { timedOut: true });
    } else startClock(attempt);
    await attempt.save({ session });
  });
  return ownExam(tenantId, cycleId, employee);
}
async function persist({ tenantId, cycleId, employee, answers, expectedRevision }, submit) {
  return mutate(tenantId, cycleId, async (cycle, session) => {
    if (!['collecting', 'closed'].includes(cycle.status)) requireState(cycle, 'collecting');
    await ownMember(tenantId, cycleId, employee, session);
    const exam = await Exam.findOne({ tenant: tenantId, cycle: cycleId }).session(session).lean();
    const attempt = await Attempt.findOne({ tenant: tenantId, cycle: cycleId, employee }).session(session);
    if (!exam || !attempt) throw new ForbiddenError('You are not assigned this examination.');
    // Deadline is checked before accepting any new answers, including late retries.
    if (hasExpired(attempt)) {
      requireState(cycle, 'collecting');
      finishAttempt(exam, attempt, { timedOut: true });
      await attempt.save({ session });
      return attemptView(attempt);
    }
    if (attempt.timedOut && attempt.submittedAt) return attemptView(attempt);
    if (attempt.durationMinutes && !attempt.startedAt) throw new ConflictError('Start the examination before answering.');
    const normalized = normalizeAnswers(assignedQuestions(exam, attempt), answers, { complete: submit });
    if (attempt.submittedAt) {
      const same = submit && normalized.length === attempt.answers.length && normalized.every(a => attempt.answers.some(b => String(b.question) === a.question && b.option === a.option));
      if (same) return attemptView(attempt);
      throw new ConflictError('Submitted examination answers cannot be changed.');
    }
    requireState(cycle, 'collecting');
    if (!Number.isInteger(expectedRevision) || expectedRevision !== attempt.revision) throw new ConflictError('Examination changed in another session. Reload before saving again.');
    attempt.answers = normalized;
    if (submit) finishAttempt(exam, attempt);
    else attempt.revision += 1;
    await attempt.save({ session });
    return attemptView(attempt);
  });
}
module.exports = { ownExam, startExam, saveExamDraft: args => persist(args, false), submitExam: args => persist(args, true) };
