const { randomInt } = require('node:crypto');
const { ValidationError, ConflictError } = require('../../utils/errors');
function selectQuestionIds(questions, count, random = randomInt) {
  if (!Number.isInteger(count) || count < 1 || count > questions.length) throw new ValidationError('The question bank must contain enough questions for each employee.');
  const ids = questions.map(q => String(q._id));
  for (let i = ids.length - 1; i > 0; i--) {
    const j = random(i + 1);
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids.slice(0, count);
}
function assignedQuestions(exam, attempt) {
  if (!attempt.questionIds?.length) return exam.questions; // Launched legacy attempts keep their complete paper.
  const questions = attempt.questionIds.map(id => exam.questions.find(q => String(q._id) === String(id)));
  if (questions.some(q => !q)) throw new ConflictError('The assigned examination questions could not be found. Contact HR.');
  return questions;
}
module.exports = { selectQuestionIds, assignedQuestions };
