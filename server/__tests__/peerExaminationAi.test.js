const test = require('node:test');
const assert = require('node:assert/strict');
const { generateQuestions } = require('../services/peerAppraisal/exam-ai');
const { bankForTenant } = require('../services/peerAppraisal/question-bank');
test('private PDF bank is restricted to its owning tenant and returned as an editable copy', () => {
  assert.throws(() => bankForTenant({ slug: 'another-tenant' }), { statusCode: 404 });
  const bank = bankForTenant({ slug: 'wyncity' });
  assert.equal(bank.questions.length, 30);
  bank.questions[0].prompt = 'changed';
  assert.notEqual(bankForTenant({ slug: 'wyncity' }).questions[0].prompt, 'changed');
});
test('AI validates its brief before making any model call', async () => {
  const client = { messages: { create: () => { throw new Error('must not be called'); } } };
  for (const input of [{ topic: '', count: 30 }, { topic: 'Drinks', count: 1 }, { topic: 'x'.repeat(1501), count: 30 }, { topic: 'Drinks', count: '30' }]) await assert.rejects(generateQuestions(input, client), { statusCode: 400 });
});
test('AI returns validated questions and model information without saving or receiving HR records', async () => {
  let request;
  const questions = Array.from({ length: 10 }, (_, i) => ({ prompt: `Question ${i + 1}?`, options: ['Correct', 'Wrong'], correctOption: 0, difficulty: 'hard', marks: 3 }));
  const client = { messages: { create: async input => { request = input; return { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({ questions }) }] }; } } };
  const result = await generateQuestions({ topic: 'Drinks knowledge', count: 10 }, client);
  assert.equal(result.questions.length, 10);
  assert.equal(result.questions[0].marks, 3);
  assert.equal(result.questions[0].difficulty, 'hard');
  assert.match(request.system, /easy.*1.*medium.*2.*hard.*3/i);
  assert.equal(result.model, request.model);
  assert.match(request.messages[0].content, /Drinks knowledge/);
  assert.equal(JSON.stringify(request).includes('employee'), false);
});
test('AI rejects truncated, malformed, duplicate or incorrectly keyed drafts', async () => {
  const good = Array.from({ length: 10 }, (_, i) => ({ prompt: `Q${i}?`, options: ['A', 'B'], correctOption: 0, difficulty: 'hard', marks: 3 }));
  for (const payload of ['bad json', { questions: [] }, { questions: good.map(q => ({ ...q, difficulty: undefined })) }, { questions: good.map(q => ({ ...q, correctOption: 3 })) }, { questions: Array(10).fill(good[0]) }]) {
    const client = { messages: { create: async () => ({ content: [{ text: typeof payload === 'string' ? payload : JSON.stringify(payload) }] }) } };
    await assert.rejects(generateQuestions({ topic: 'Drinks', count: 10 }, client), { statusCode: 502 });
  }
});
