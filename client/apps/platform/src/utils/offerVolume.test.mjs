import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveOfferVolume } from './offerVolume.ts';

test('selected bottle label overrides contradictory catalogue and offer volumes', () => {
  assert.equal(resolveOfferVolume({size: '70cl', volumeMl: 750}, 750), 700);
  assert.equal(resolveOfferVolume({size: '75CL'}, 700), 750);
  assert.equal(resolveOfferVolume({size: '1.5 L'}, 700), 1500);
  assert.equal(resolveOfferVolume({size: 'Bottle 600ml'}, 750), 600);
});
test('unmeasured selected packs and accessories do not inherit catalogue bottle volume', () => {
  assert.equal(resolveOfferVolume({size: 'unit-single'}, 750), undefined);
  assert.equal(resolveOfferVolume({size: '6 x 70cl'}, 750), undefined);
  assert.equal(resolveOfferVolume({size: '500g'}, 750), undefined);
  assert.equal(resolveOfferVolume({size: 'case', displayName: 'Case of 6 x 70cl'}, 750), undefined);
});
test('uses measured offer volume or a simple display label when the code has no unit', () => {
  assert.equal(resolveOfferVolume({size: 'large', volumeMl: 1500}, 750), 1500);
  assert.equal(resolveOfferVolume({size: 'bottle', displayName: '70cl'}, 750), 700);
  assert.equal(resolveOfferVolume(undefined, 750), 750);
});
test('invalid and non-finite measurements are suppressed', () => {
  for (const volumeMl of [0, -1, NaN, Infinity]) {
    assert.equal(resolveOfferVolume({size: 'bottle', volumeMl}, 750), undefined);
    assert.equal(resolveOfferVolume(null, volumeMl), undefined);
  }
});
