import { expect, test } from 'vitest';
import { venueCartLines } from './cart-lines';
test('canonical_save_normalizes_the_same_lines_for_navigation_fire_and_payment', () => {
  expect(venueCartLines([{ subProductId: 'sub', sizeId: 'size', quantity: 2, price: 1, discount: 0 }])).toEqual([{ subProductId: 'sub', sizeId: 'size', quantity: 2 }]);
});
test('unsupported_rules_cannot_disappear_when_cart_is_saved', () => {
  for (const line of [{ discount: 5 }, { comboRef: { instanceId: 'combo' } }, { bxgyRef: { rewardId: 'gift' } }]) expect(() => venueCartLines([{ subProductId: 'sub', sizeId: 'size', quantity: 1, ...line }])).toThrow(/unsupported/i);
  expect(() => venueCartLines([], 5)).toThrow(/unsupported/i);
  expect(() => venueCartLines([], 0, [{ reward: true }])).toThrow(/unsupported/i);
});
