'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

test('generateCategory guard: missing topic returns 400', async () => {
  const { generateCategory } = require('../controllers/category.controller');
  const res = { status: (c) => ({ json: (p) => ({ code: c, payload: p }) }) };
  const out = await generateCategory({ body: { topic: '' } }, res, () => {});
  assert.strictEqual(out.code, 400);
  assert.match(out.payload.message, /topic is required/i);
});

test('generateCategory guard: missing ANTHROPIC_API_KEY returns 500', async () => {
  const prev = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  const { generateCategory } = require('../controllers/category.controller');
  const res = { status: (c) => ({ json: (p) => ({ code: c, payload: p }) }) };
  const out = await generateCategory({ body: { topic: 'Whisky' } }, res, () => {});
  assert.strictEqual(out.code, 500);
  process.env.ANTHROPIC_API_KEY = prev;
});