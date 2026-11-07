'use strict';
// Task 1 (S2) — controlled units module, pure (spec §3). No mongo, no model imports.
const test = require('node:test');
const assert = require('node:assert/strict');
const { convert, assertRecipeQuantities, DIMENSIONS } = require('../services/venue/units');

const failCode = async (promise, code) => { try { await promise(); } catch (error) { return assert.equal(error.code, code); } throw new Error(`expected ${code}`); };

test('mass conversions require the item gramsPerMl factor', async () => {
  await failCode(() => convert(50, 'ml', 'g'), 'UNIT_CONVERSION');
  await failCode(() => convert(50, 'g', 'ml'), 'UNIT_CONVERSION');
  await failCode(() => convert(50, 'ml', 'g', {}), 'UNIT_CONVERSION');
  await failCode(() => convert(50, 'ml', 'g', { gramsPerMl: -1 }), 'UNIT_CONVERSION');
  await failCode(() => convert(50, 'ml', 'g', { gramsPerMl: 0 }), 'UNIT_CONVERSION');
  await failCode(() => convert(50, 'ml', 'g', { gramsPerMl: Number.NaN }), 'UNIT_CONVERSION');
});

test('convert uses exact factor direction: g = ml x gramsPerMl, ml = g / gramsPerMl', () => {
  assert.deepEqual(convert(50, 'ml', 'g', { gramsPerMl: 0.995 }), { quantity: 49.75, unit: 'g' });
  assert.deepEqual(convert(49.75, 'g', 'ml', { gramsPerMl: 0.995 }), { quantity: 50, unit: 'ml' });
  assert.deepEqual(convert(40, 'ml', 'g', { gramsPerMl: 1.25 }), { quantity: 50, unit: 'g' });
});

// Results are normalized to the target dimension's base unit (volume -> ml, mass -> g): l collapses to ml.
test('same-dimension conversions are exact (l <-> ml via 1000 ml = 1 l)', () => {
  assert.deepEqual(convert(1.5, 'l', 'ml'), { quantity: 1500, unit: 'ml' });
  assert.deepEqual(convert(1500, 'ml', 'l'), { quantity: 1500, unit: 'ml' });
  assert.deepEqual(convert(0.5, 'l', 'ml'), { quantity: 500, unit: 'ml' });
  assert.deepEqual(convert(333.55, 'ml', 'l'), { quantity: 333.55, unit: 'ml' });
  assert.deepEqual(convert(50, 'ml', 'ml'), { quantity: 50, unit: 'ml' });
});

test('count stays integer; cross-dimension and unknown units are domain errors', async () => {
  assert.deepEqual(convert(3, 'count', 'count'), { quantity: 3, unit: 'count' });
  await failCode(() => convert(1.5, 'count', 'count'), 'UNIT_CONVERSION');
  await failCode(() => convert(3, 'count', 'ml'), 'UNIT_CONVERSION');
  await failCode(() => convert(3, 'ml', 'count'), 'UNIT_CONVERSION');
  await failCode(() => convert(3, 'bottles', 'ml'), 'INVALID_INPUT');
  await failCode(() => convert(Number.NaN, 'ml', 'l'), 'INVALID_INPUT');
});

test('assertRecipeQuantities accepts fractional ml and rejects zero/negative/NaN and fractional counts', async () => {
  assert.equal(assertRecipeQuantities([{ profile: '6501023a0000000000000011', quantity: 0.5, unit: 'ml' }]), undefined);
  await failCode(() => assertRecipeQuantities([{ profile: '6501023a0000000000000011', quantity: 0, unit: 'ml' }]), 'INVALID_INPUT');
  await failCode(() => assertRecipeQuantities([{ profile: '6501023a0000000000000011', quantity: -1, unit: 'g' }]), 'INVALID_INPUT');
  await failCode(() => assertRecipeQuantities([{ profile: '6501023a0000000000000011', quantity: Number.NaN, unit: 'ml' }]), 'INVALID_INPUT');
  await failCode(() => assertRecipeQuantities([{ profile: '6501023a0000000000000011', quantity: 1.5, unit: 'count' }]), 'UNIT_CONVERSION');
  await failCode(() => assertRecipeQuantities([{ profile: '6501023a0000000000000011', quantity: 2, unit: 'litres' }]), 'INVALID_INPUT');
});

test('mixed-dimension component list with duplicate (profile, unit) fails INVALID_INPUT', async () => {
  const profile = '6501023a0000000000000022';
  await failCode(() => assertRecipeQuantities([
    { profile: '6501023a0000000000000011', quantity: 50, unit: 'ml' },
    { profile: '6501023a0000000000000033', quantity: 1, unit: 'count' },
    { profile, quantity: 10, unit: 'g' },
    { profile, quantity: 20, unit: 'g' },
  ]), 'INVALID_INPUT');
  assert.equal(assertRecipeQuantities([
    { profile, quantity: 10, unit: 'g' },
    { profile: '6501023a0000000000000033', quantity: 1, unit: 'count' },
  ]), undefined);
});

test('DIMENSIONS exposes the three controlled dimensions', () => {
  assert.deepEqual(DIMENSIONS, { count: 'count', volume: 'volume', mass: 'mass' });
});

test('recipe base units reject precision beyond hundredths instead of silently rounding', () => {
  assert.throws(() => require('../services/venue/units').assertRecipeQuantities([{profile:'ingredient',quantity:0.001,unit:'g'}]), error => error.code === 'INVALID_QUANTITY');
  assert.throws(() => require('../services/venue/units').convert(0.001,'ml','ml'), error => error.code === 'INVALID_QUANTITY');
});
