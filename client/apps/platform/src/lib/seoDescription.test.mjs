import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { normalizeDescription } from './seoDescription.ts';

test('extends short factual copy with shopping context', () => {
  const result = normalizeDescription('Single malt Scotch whisky aged 18 years.', 'Buy Tomintoul 18 Years online in Nigeria.');
  assert.ok(result.startsWith('Single malt Scotch whisky aged 18 years.'));
  assert.ok(result.length >= 120 && result.length <= 160);
  assert.match(result, /online/);
});
test('cleans markup before measuring and preserves useful copy', () => {
  const copy = 'Explore Cloudy Bay Sauvignon Blanc and other New Zealand wines. Compare bottles and order online with delivery across Nigeria from DrinksHarbour.';
  assert.equal(normalizeDescription(`<p>${copy}</p>`, 'unused'), copy);
});
test('uses a specific fallback when copy is missing', () => {
  const result = normalizeDescription('', 'Browse drinks from Wyncity on DrinksHarbour.');
  assert.match(result, /Wyncity/);
  assert.ok(result.length >= 120 && result.length <= 160);
});
test('caps at a whole word and decodes common entities', () => {
  const result = normalizeDescription('Wine &amp; spirits. ' + 'Selection '.repeat(30), 'unused');
  assert.match(result, /^Wine & spirits/);
  assert.ok(result.length <= 160);
  assert.ok(result.endsWith('Selection…'));
});
