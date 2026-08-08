// Run with:  node --experimental-strip-types --test src/lib/first-order-perk.test.mjs
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  describeFirstOrderPerk,
  describeDeliveryLine,
  formatNaira,
} from './first-order-perk.ts';

/** A server verdict, defaulted to the eligible case. */
const perk = (over = {}) => ({
  eligible: true,
  waivedAmount: 3000,
  payableFee: 0,
  reason: 'ok',
  minSubtotal: 50000,
  maxWaiver: 5000,
  ...over,
});

test('formatNaira renders whole naira with separators', () => {
  assert.equal(formatNaira(50000), '₦50,000');
  assert.equal(formatNaira(2499.6), '₦2,500');
  assert.equal(formatNaira(0), '₦0');
});

// ── What gets advertised ────────────────────────────────────────────────────

test('an eligible shopper is told delivery is free', () => {
  const promo = describeFirstOrderPerk(perk());
  assert.equal(promo.show, true);
  assert.equal(promo.tone, 'success');
  assert.match(promo.detail, /free/i);
  assert.equal(promo.cta, null);
});

// The shared probe has no cart and no address, so it reports `ok` with nothing
// waived. The site-wide bar renders that, and must not talk about "this order".
test('an eligible verdict with no fee quoted states the terms instead', () => {
  const promo = describeFirstOrderPerk(perk({ waivedAmount: 0, payableFee: 0 }));
  assert.equal(promo.show, true);
  assert.equal(promo.tone, 'success');
  assert.match(promo.detail, /over ₦50,000/);
  assert.doesNotMatch(promo.detail, /this order/);
});

// Otherwise a first-time buyer holding a ₦5,000 basket is promised free delivery
// that checkout then withdraws.
test('an eligible verdict is downgraded when the known subtotal is short', () => {
  const promo = describeFirstOrderPerk(perk(), { subtotal: 5000 });
  assert.equal(promo.tone, 'info');
  assert.match(promo.detail, /Add ₦45,000 more/);
});

test('an eligible verdict survives a subtotal that clears the minimum', () => {
  const promo = describeFirstOrderPerk(perk(), { subtotal: 50000 });
  assert.equal(promo.tone, 'success');
});

// The downgrade may withdraw a claim, never grant one: a shopper who has already
// bought stays hidden no matter how large the basket.
test('the subtotal check cannot promote an ineligible verdict', () => {
  const promo = describeFirstOrderPerk(
    perk({ eligible: false, reason: 'already_purchased' }),
    { subtotal: 500000 },
  );
  assert.equal(promo.show, false);
});

test('a partly waived fee names both numbers', () => {
  const promo = describeFirstOrderPerk(perk({ waivedAmount: 5000, payableFee: 3000 }));
  assert.match(promo.detail, /₦5,000 off/);
  assert.match(promo.detail, /₦3,000 to pay/);
});

test('a signed-out shopper gets a sign-in CTA that returns them', () => {
  const promo = describeFirstOrderPerk(
    perk({ eligible: false, reason: 'not_signed_in', waivedAmount: 0 }),
    { returnTo: '/cart' },
  );
  assert.equal(promo.show, true);
  assert.equal(promo.cta.href, '/login?redirect=%2Fcart');
  assert.match(promo.detail, /₦50,000/);
});

test('the sign-in CTA defaults to returning to checkout', () => {
  const promo = describeFirstOrderPerk(perk({ eligible: false, reason: 'not_signed_in' }));
  assert.equal(promo.cta.href, '/login?redirect=%2Fcheckout');
});

test('a shopper below the minimum is told the exact shortfall', () => {
  const promo = describeFirstOrderPerk(
    perk({ eligible: false, reason: 'below_minimum' }),
    { subtotal: 38000 },
  );
  assert.equal(promo.show, true);
  assert.match(promo.detail, /Add ₦12,000 more/);
});

test('below the minimum with no subtotal known, the threshold is stated instead', () => {
  const promo = describeFirstOrderPerk(perk({ eligible: false, reason: 'below_minimum' }));
  assert.equal(promo.show, true);
  assert.match(promo.detail, /over ₦50,000/);
  assert.doesNotMatch(promo.detail, /NaN/);
});

// ── What stays hidden ───────────────────────────────────────────────────────
// Announcing an offer and then withdrawing it at checkout is worse than never
// mentioning it, so anything the shopper cannot actually have is suppressed.

test('reasons the shopper cannot act on are hidden', () => {
  for (const reason of ['already_purchased', 'disabled', 'outside_zone', 'no_fee']) {
    assert.equal(
      describeFirstOrderPerk(perk({ eligible: false, reason })).show,
      false,
      `expected ${reason} to be hidden`,
    );
  }
});

test('a missing verdict is hidden rather than throwing', () => {
  assert.equal(describeFirstOrderPerk(null).show, false);
  assert.equal(describeFirstOrderPerk(undefined).show, false);
});

// ── The checkout summary line ───────────────────────────────────────────────

test('the delivery line reads Free when nothing is payable', () => {
  assert.equal(describeDeliveryLine(perk()), 'Free — first order');
});

test('the delivery line names the discount when a balance remains', () => {
  assert.equal(
    describeDeliveryLine(perk({ waivedAmount: 5000, payableFee: 1200 })),
    '₦5,000 first-order discount applied',
  );
});

test('the delivery line is absent for an ineligible order', () => {
  assert.equal(describeDeliveryLine(perk({ eligible: false, reason: 'below_minimum' })), null);
  assert.equal(describeDeliveryLine(null), null);
});
