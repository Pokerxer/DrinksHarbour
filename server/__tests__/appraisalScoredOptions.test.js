const test = require('node:test');
const assert = require('node:assert/strict');
const { validateTemplateShape } = require('../controllers/appraisalTemplate.controller');

// A scored-anchor question: the rater picks a described option and the score
// it carries is stored out of sight. `options` and `optionScores` are two
// halves of one thing, so every rule here is about them agreeing.
const scored = (over = {}) => ({
  title: 'Cleaning',
  questions: [
    {
      type: 'likert',
      label: 'Punctuality',
      scaleMax: 5,
      askOf: ['self', 'manager'],
      options: ['Always ready on time', 'On time almost always', 'Late enough to notice', 'Late regularly', 'Frequently late'],
      optionScores: [5, 4, 3, 2, 1],
      ...over,
    },
  ],
});

test('validateTemplateShape accepts options and optionScores of equal length', () => {
  assert.deepEqual(validateTemplateShape([scored()]), []);
});

test('validateTemplateShape rejects optionScores shorter than options', () => {
  // The failure this prevents is silent: the renderer maps the last option to
  // `undefined` and stores an answer with no rating at all.
  const errors = validateTemplateShape([scored({ optionScores: [5, 4, 3, 2] })]);

  assert.equal(errors.length, 1);
  assert.match(errors[0], /score/i);
});

test('validateTemplateShape rejects a score above the question scaleMax', () => {
  const errors = validateTemplateShape([scored({ optionScores: [9, 4, 3, 2, 1] })]);

  assert.equal(errors.length, 1);
  assert.match(errors[0], /scaleMax|maximum/i);
});

test('validateTemplateShape rejects a negative score', () => {
  const errors = validateTemplateShape([scored({ optionScores: [5, 4, 3, 2, -1] })]);

  assert.equal(errors.length, 1);
});

test('validateTemplateShape rejects optionScores on a question with no options', () => {
  const errors = validateTemplateShape([scored({ options: [] })]);

  assert.equal(errors.length, 1);
});

test('validateTemplateShape rejects two options sharing the same score', () => {
  // The stored answer is a bare number, so the score is what identifies WHICH
  // anchor was picked when the answer is read back. Two anchors worth 3 make
  // that lookup ambiguous, and the read-back would show whichever came first
  // — attributing words to a rater they did not choose.
  const errors = validateTemplateShape([scored({ optionScores: [5, 4, 3, 3, 1] })]);

  assert.equal(errors.length, 1);
  assert.match(errors[0], /same score|duplicate/i);
});

test('validateTemplateShape leaves an ordinary question with no optionScores alone', () => {
  const plain = {
    title: 'Cleaning',
    questions: [{ type: 'rating', label: 'Quality', scaleMax: 5, askOf: ['manager'] }],
  };

  assert.deepEqual(validateTemplateShape([plain]), []);
});

test('validateTemplateShape still requires every section to have a question', () => {
  const errors = validateTemplateShape([{ title: 'Empty', questions: [] }]);

  assert.equal(errors.length, 1);
  assert.match(errors[0], /at least one question/i);
});
