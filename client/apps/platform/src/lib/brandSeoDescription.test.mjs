import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { buildBrandDescription } from './brandSeoDescription.ts';

test('replaces thin imported copy with brand-specific shopping context', () => {
  const text = buildBrandDescription('19 Crimes', '19 Crimes is a distinguished brand known for quality and excellence in their craft.');
  assert.match(text, /19 Crimes/);
  assert.match(text, /Nigeria/);
  assert.ok(text.length >= 120 && text.length <= 160);
});

test('preserves useful editorial descriptions', () => {
  const copy = 'Explore Cloudy Bay Sauvignon Blanc and other New Zealand wines. Compare bottles and order online with delivery across Nigeria from DrinksHarbour.';
  assert.equal(buildBrandDescription('Cloudy Bay', copy), copy);
});

test('trims long descriptions without splitting a word', () => {
  const prefix = 'Discover authentic spirits from this house, explore the range and choose a bottle for your next occasion. ';
  const text = buildBrandDescription('Dalmore', prefix + 'Distinctive '.repeat(15));
  assert.ok(text.length <= 160);
  assert.ok(text.endsWith('Distinctive…'));
});

test('handles missing descriptions and normalizes whitespace', () => {
  assert.match(buildBrandDescription('Agavales'), /Agavales/);
  assert.ok(!/\s{2}/.test(buildBrandDescription('  Cloudy   Bay  ', ' ')));
});
