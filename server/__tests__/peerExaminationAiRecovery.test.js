const test = require('node:test');
const assert = require('node:assert/strict');
const { generateQuestions } = require('../services/peerAppraisal/exam-ai');
function bank(count = 10) { return Array.from({ length: count }, (_, i) => ({ prompt: `Beverage ${i}?`, options: ['A', 'B'], correctOption: 0, difficulty: i % 2 ? ' Medium ' : 'HARD', marks: 10 })); }
function response(questions) { return { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({ questions }) }] }; }
test('uses constrained JSON and derives consistent marks without rejecting harmless difficulty casing', async () => {
  let request;
  const client = { messages: { create: async input => { request = input; return response(bank()); } } };
  const result = await generateQuestions({ topic: 'Beverage service', count: 10 }, client);
  assert.equal(request.output_config.format.type, 'json_schema');
  assert.equal(request.output_config.format.schema.additionalProperties, false);
  assert.equal(result.questions[0].difficulty, 'hard');
  assert.equal(result.questions[0].marks, 3);
  assert.equal(result.questions[1].marks, 2);
  assert.equal(result.questions[0].correctOption, 0);
});
test('repairs an incomplete bank once and returns the full requested count', async () => {
  const requests = [];
  const client = { messages: { create: async input => { requests.push(input); return response(bank(requests.length === 1 ? 9 : 10)); } } };
  const result = await generateQuestions({ topic: 'Wine service', count: 10 }, client);
  assert.equal(requests.length, 2);
  assert.equal(result.questions.length, 10);
  assert.match(requests[1].messages[0].content, /9.*10/);
  assert.match(requests[1].messages[0].content, /Wine service/);
  assert.equal(JSON.stringify(requests[1]).includes('Beverage 0?'), false); // No rejected answer key echoed back.
});
test('two incomplete outputs return an actionable count error without unbounded retries', async () => {
  let calls = 0;
  const client = { messages: { create: async () => { calls++; return response(bank(8)); } } };
  await assert.rejects(generateQuestions({ topic: 'Drinks', count: 10 }, client), e => e.statusCode === 502 && /8.*10/.test(e.message));
  assert.equal(calls, 2);
});
test('never guesses malformed answer indexes and reports semantic validation after bounded repair', async () => {
  let calls = 0;
  const client = { messages: { create: async () => { calls++; return response(bank().map(q => ({ ...q, correctOption: 'A' }))); } } };
  await assert.rejects(generateQuestions({ topic: 'Drinks', count: 10 }, client), e => e.statusCode === 502 && /correct answer/i.test(e.message));
  assert.equal(calls, 2);
});
test('refusals do not retry or accept an otherwise parsable question bank', async () => {
  let calls = 0;
  const client = { messages: { create: async () => { calls++; return { ...response(bank()), stop_reason: 'refusal' }; } } };
  await assert.rejects(generateQuestions({ topic: 'Drinks', count: 10 }, client), e => e.statusCode === 502 && /could not generate.*topic/i.test(e.message));
  assert.equal(calls, 1);
});
test('truncated responses are not accepted as complete even if their JSON parses', async () => {
  let calls = 0;
  const client = { messages: { create: async () => { calls++; return { ...response(bank()), stop_reason: 'max_tokens' }; } } };
  await assert.rejects(generateQuestions({ topic: 'Drinks', count: 10 }, client), e => e.statusCode === 502 && /cut off|truncated/i.test(e.message));
  assert.equal(calls, 2);
});
test('provider limits and authentication errors are sanitized and do not retry', async () => {
  for (const status of [401, 429, 500]) {
    let calls = 0;
    const client = { messages: { create: async () => { calls++; throw Object.assign(new Error('PRIVATE PROVIDER DETAIL'), { status }); } } };
    await assert.rejects(generateQuestions({ topic: 'Drinks', count: 10 }, client), e => [502, 503].includes(e.statusCode) && !e.message.includes('PRIVATE'));
    assert.equal(calls, 1);
  }
});
test('official SDK sends the structured schema and parses the response through an injected HTTP transport', async () => {
  const Anthropic = require('@anthropic-ai/sdk');
  let wire;
  const client = new Anthropic({ apiKey: 'disposable-test-key', maxRetries: 0, fetch: async (url, init) => {
    wire = JSON.parse(init.body);
    return new Response(JSON.stringify({ id: 'msg_test', type: 'message', role: 'assistant', model: wire.model, usage: { input_tokens: 10, output_tokens: 20 }, ...response(bank().map(({ marks, ...q }) => q)) }), { status: 200, headers: { 'content-type': 'application/json' } });
  } });
  const result = await generateQuestions({ topic: 'Beverage service', count: 10 }, client);
  assert.equal(wire.output_config.format.type, 'json_schema');
  assert.equal(wire.output_config.format.schema.properties.questions.items.required.includes('difficulty'), true);
  assert.equal(result.questions.length, 10);
  assert.equal(result.questions[0].marks, 3);
});
test('caps per-call timeout and uses only the remaining total budget for repair', async t => {
  let now = 0;
  t.mock.method(Date, 'now', () => now);
  const timeouts = [];
  const client = { messages: { create: async (request, options) => { timeouts.push(options.timeout); now = 40000; return response(bank(timeouts.length === 1 ? 8 : 10)); } } };
  await generateQuestions({ topic: 'Drinks', count: 10 }, client);
  assert.deepEqual(timeouts, [45000, 20000]);
});
test('does not launch another repair after the total budget has expired', async t => {
  let now = 0, calls = 0;
  t.mock.method(Date, 'now', () => now);
  const client = { messages: { create: async () => { calls++; now = 60001; return response(bank(8)); } } };
  await assert.rejects(generateQuestions({ topic: 'Drinks', count: 10 }, client), e => e.statusCode === 504 && /timed out/i.test(e.message));
  assert.equal(calls, 1);
});
