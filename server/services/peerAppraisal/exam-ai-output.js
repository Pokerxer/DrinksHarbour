const { AppError, ValidationError } = require('../../utils/errors');
const { parseAiJson } = require('../appraisalAi.service');
const { validateQuestions } = require('./exam-rules');
const MARKS = { easy: 1, medium: 2, hard: 3 };
// Only the documented structured-output subset: lengths/counts are checked below.
const schema = {
  type: 'object', additionalProperties: false, required: ['questions'],
  properties: {
    questions: {
      type: 'array', minItems: 1,
      description: 'Exactly the requested number of distinct single-choice questions.',
      items: {
        type: 'object', additionalProperties: false,
        required: ['prompt', 'options', 'correctOption', 'difficulty'],
        properties: {
          prompt: { type: 'string', description: 'Clear question, preferably under 180 characters; maximum 500.' },
          options: { type: 'array', minItems: 1, items: { type: 'string' }, description: '2 to 6 distinct non-empty choices, each at most 300 characters; prefer concise choices.' },
          correctOption: { type: 'integer', enum: [0, 1, 2, 3, 4, 5], description: 'Zero-based index of the one objectively correct option; must be inside the options array.' },
          difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'], description: 'Difficulty determines marks: easy 1, medium 2, hard 3.' },
        },
      },
    },
  },
};
class BankOutputError extends Error {}
function parseQuestionBank(response, count) {
  if (response?.stop_reason === 'refusal') throw new AppError('AI could not generate questions for this topic. Rephrase the topic and try again.', 502, true);
  if (response?.stop_reason === 'max_tokens') throw new BankOutputError('The response was cut off before the bank was complete. Try generating fewer questions.');
  const content = Array.isArray(response?.content) ? response.content : [];
  const parsed = parseAiJson(content.filter(c => c.type === 'text' || c.type === undefined).map(c => c.text || '').join(''));
  if (!Array.isArray(parsed?.questions)) throw new BankOutputError('The response did not contain a readable question bank.');
  if (parsed.questions.length !== count) throw new BankOutputError(`AI returned ${parsed.questions.length} of the ${count} requested questions.`);
  const normalized = parsed.questions.map((q, i) => {
    const difficulty = typeof q?.difficulty === 'string' ? q.difficulty.trim().toLowerCase() : '';
    if (!Object.hasOwn(MARKS, difficulty)) throw new BankOutputError(`Question ${i + 1} needs an easy, medium or hard difficulty.`);
    // Marks are deterministic; a duplicate/missing model mark must not invalidate
    // an otherwise sound question. Never guess or coerce its correct answer.
    return { ...q, difficulty, marks: MARKS[difficulty] };
  });
  try { return validateQuestions(normalized); }
  catch (e) {
    throw new BankOutputError(e instanceof ValidationError ? e.message : 'The response contains an invalid question.');
  }
}
module.exports = { schema, BankOutputError, parseQuestionBank };
