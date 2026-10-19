const mongoose = require('mongoose');
const Exam = require('../../models/PeerAppraisalExam');
const Attempt = require('../../models/PeerAppraisalExamAttempt');
const Department = require('../../models/Department');
const { ValidationError, ConflictError } = require('../../utils/errors');
const { selectedRecipients, validateRecipients } = require('./exam-recipients');
const { validateExam } = require('./exam-rules');
const { mutate, requireState } = require('./store');
const { attendancePeriod } = require('./monthly-attendance');
const { selectQuestionIds } = require('./exam-assignment');
async function validDepartments(tenantId, departments, session) {
  if (departments.some(d => !/^[a-f\d]{24}$/i.test(String(d)) || !mongoose.isValidObjectId(d))) throw new ValidationError('Select valid departments.');
  const count = await Department.countDocuments({ tenant: tenantId, _id: { $in: departments }, isActive: true }).session(session);
  if (count !== departments.length) throw new ValidationError('Select active departments from this business.');
}
async function saveConfiguration({ tenantId, cycleId, expectedRevision, configuration }) {
  return mutate(tenantId, cycleId, async (cycle, session) => {
    requireState(cycle, 'draft');
    if (!Number.isInteger(expectedRevision) || expectedRevision !== (cycle.revision || 0)) throw new ConflictError('Cycle changed in another session. Reload before saving examination settings.');
    if (configuration === null) await Exam.deleteMany({ tenant: tenantId, cycle: cycleId }).session(session);
    else {
      const data = validateExam(configuration);
      await validDepartments(tenantId, data.departments, session);
      await validateRecipients(tenantId, cycleId, data, session);
      const unset = { ...(!data.attendanceMonth ? { attendanceMonth: '' } : {}), ...(data.recipientIds === undefined ? { recipientIds: '' } : {}) };
      await Exam.findOneAndUpdate({ tenant: tenantId, cycle: cycleId }, { $set: data, ...(Object.keys(unset).length ? { $unset: unset } : {}) }, { upsert: true, new: true, session, runValidators: true });
    }
    return { revision: (cycle.revision || 0) + 1 };
  });
}
async function launchExamination(tenantId, cycleId, people, session) {
  const exam = await Exam.findOne({ tenant: tenantId, cycle: cycleId }).session(session).lean();
  if (!exam) return;
  await validDepartments(tenantId, exam.departments, session);
  const assigned = selectedRecipients(exam, people);
  if (!assigned.length) throw new ValidationError('The selected examination departments have no employees in this cycle.');
  await Attempt.insertMany(assigned.map(p => ({ tenant: tenantId, cycle: cycleId, employee: p.employee, durationMinutes: exam.durationMinutes, questionIds: selectQuestionIds(exam.questions, exam.questionsPerEmployee ?? exam.questions.length), marksPerQuestion: exam.marksPerQuestion ?? 1 })), { session });
}
async function hrExamination(tenantId, cycleId) {
  const exam = await Exam.findOne({ tenant: tenantId, cycle: cycleId }).lean();
  if (!exam) return null;
  const attempts = await Attempt.find({ tenant: tenantId, cycle: cycleId }).select('employee submittedAt').lean();
  const range = await attendancePeriod(tenantId, exam);
  return { ...(exam.recipientIds !== undefined ? { recipientIds: exam.recipientIds.map(String) } : {}), durationMinutes: exam.durationMinutes, attendanceMonth: exam.attendanceMonth, attendanceFrom: range.attendanceFrom, attendanceTo: range.attendanceTo, questionsPerEmployee: exam.questionsPerEmployee ?? exam.questions.length, marksPerQuestion: exam.marksPerQuestion ?? 1, departments: exam.departments.map(String), questions: exam.questions.map(q => ({ question: String(q._id), prompt: q.prompt, options: q.options, correctOption: q.correctOption, marks: q.marks ?? exam.marksPerQuestion ?? 1, difficulty: q.difficulty })), assigned: attempts.length, submitted: attempts.filter(a => a.submittedAt).length, periodComplete: range.end <= new Date(), monthComplete: range.end <= new Date() };
}
module.exports = { saveConfiguration, launchExamination, hrExamination };
