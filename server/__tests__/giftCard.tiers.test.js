const { giftCardTierForAmount, GIFT_CARD_TIERS } = require('../services/giftCard.helpers');

describe('giftCardTierForAmount', () => {
  test('band boundaries map to the right tier', () => {
    expect(giftCardTierForAmount(1000).id).toBe('classic');
    expect(giftCardTierForAmount(49999).id).toBe('classic');
    expect(giftCardTierForAmount(50000).id).toBe('silver');
    expect(giftCardTierForAmount(199999).id).toBe('silver');
    expect(giftCardTierForAmount(200000).id).toBe('gold');
    expect(giftCardTierForAmount(499999).id).toBe('gold');
    expect(giftCardTierForAmount(500000).id).toBe('platinum');
    expect(giftCardTierForAmount(999999).id).toBe('platinum');
    expect(giftCardTierForAmount(1000000).id).toBe('premium');
    expect(giftCardTierForAmount(4999999).id).toBe('premium');
    expect(giftCardTierForAmount(5000000).id).toBe('black');
    expect(giftCardTierForAmount(20000000).id).toBe('black');
  });

  test('sub-minimum amounts clamp to classic', () => {
    expect(giftCardTierForAmount(0).id).toBe('classic');
    expect(giftCardTierForAmount(-5).id).toBe('classic');
  });

  test('GIFT_CARD_TIERS is ordered ascending and every tier has art fields', () => {
    for (let i = 1; i < GIFT_CARD_TIERS.length; i++) {
      expect(GIFT_CARD_TIERS[i].minAmount).toBeGreaterThan(GIFT_CARD_TIERS[i - 1].minAmount);
    }
    for (const t of GIFT_CARD_TIERS) {
      expect(typeof t.gradient).toBe('string');
      expect(t.gradient.length).toBeGreaterThan(0);
    }
  });
});
