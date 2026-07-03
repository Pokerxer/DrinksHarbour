const test = require('node:test');
const assert = require('node:assert');
const { giftCardTierForAmount, GIFT_CARD_TIERS } = require('../services/giftCard.helpers');

test('band boundaries map to the right tier', () => {
  assert.strictEqual(giftCardTierForAmount(1000).id, 'classic');
  assert.strictEqual(giftCardTierForAmount(49999).id, 'classic');
  assert.strictEqual(giftCardTierForAmount(50000).id, 'silver');
  assert.strictEqual(giftCardTierForAmount(199999).id, 'silver');
  assert.strictEqual(giftCardTierForAmount(200000).id, 'gold');
  assert.strictEqual(giftCardTierForAmount(499999).id, 'gold');
  assert.strictEqual(giftCardTierForAmount(500000).id, 'platinum');
  assert.strictEqual(giftCardTierForAmount(999999).id, 'platinum');
  assert.strictEqual(giftCardTierForAmount(1000000).id, 'premium');
  assert.strictEqual(giftCardTierForAmount(4999999).id, 'premium');
  assert.strictEqual(giftCardTierForAmount(5000000).id, 'black');
  assert.strictEqual(giftCardTierForAmount(20000000).id, 'black');
});

test('sub-minimum amounts clamp to classic', () => {
  assert.strictEqual(giftCardTierForAmount(0).id, 'classic');
  assert.strictEqual(giftCardTierForAmount(-5).id, 'classic');
});

test('GIFT_CARD_TIERS is ordered ascending and every tier has art fields', () => {
  for (let i = 1; i < GIFT_CARD_TIERS.length; i++) {
    assert.ok(GIFT_CARD_TIERS[i].minAmount > GIFT_CARD_TIERS[i - 1].minAmount);
  }
  for (const t of GIFT_CARD_TIERS) {
    assert.strictEqual(typeof t.gradient, 'string');
    assert.ok(t.gradient.length > 0);
  }
});
