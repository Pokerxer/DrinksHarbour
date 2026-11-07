import { expect, test } from 'vitest';
import { assertLegacyCheckout } from './legacy-guard';
test('canonical_visit_cannot_enter_retail_or_offline_checkout', () => {
  expect(() => assertLegacyCheckout({ serviceSessionId: 'visit' })).toThrow(/venue/i);
  expect(() => assertLegacyCheckout({ venueIdentityVersion: 1 })).toThrow(/venue/i);
  expect(() => assertLegacyCheckout({ canonicalVenueLocation: true })).toThrow(/venue/i);
  expect(() => assertLegacyCheckout({})).not.toThrow();
});
