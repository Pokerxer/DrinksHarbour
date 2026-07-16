'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

test('generateSubCategory guard: missing topic returns 400', async () => {
  const { generateSubCategory } = require('../controllers/subcategory.controller');
  const res = { status: (c) => ({ json: (p) => ({ code: c, payload: p }) }) };
  const out = await generateSubCategory({ body: { topic: '', parentName: 'Whisky' } }, res, () => {});
  assert.strictEqual(out.code, 400);
  assert.match(out.payload.message, /topic is required/i);
});

test('generateSubCategory guard: missing parentName returns 400', async () => {
  const { generateSubCategory } = require('../controllers/subcategory.controller');
  const res = { status: (c) => ({ json: (p) => ({ code: c, payload: p }) }) };
  const out = await generateSubCategory({ body: { topic: 'Single Malt' } }, res, () => {});
  assert.strictEqual(out.code, 400);
  assert.match(out.payload.message, /parentName is required/i);
});

test('generateSubCategory guard: missing ANTHROPIC_API_KEY returns 500', async () => {
  const prev = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  const { generateSubCategory } = require('../controllers/subcategory.controller');
  const res = { status: (c) => ({ json: (p) => ({ code: c, payload: p }) }) };
  const out = await generateSubCategory({ body: { topic: 'Single Malt', parentName: 'Whisky' } }, res, () => {});
  assert.strictEqual(out.code, 500);
  process.env.ANTHROPIC_API_KEY = prev;
});