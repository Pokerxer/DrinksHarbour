// server/__tests__/firstOrderPerk.test.js
const test = require('node:test');
const assert = require('node:assert');
const {
  FIRST_ORDER_PERK,
  isPerkState,
  evaluateFirstOrderPerk,
} = require('../services/firstOrderPerk.helpers');

// A baseline set of inputs that qualifies, so each test can flip one thing.
const OK = {
  signedIn: true,
  enabled: true,
  hasPriorOrder: false,
  subtotal: 50_000,
  state: 'FCT - Abuja',
  baseFee: 3_000,
};

const evaluate = (overrides = {}) => evaluateFirstOrderPerk({ ...OK, ...overrides });

test('constants match the agreed offer', () => {
  assert.strictEqual(FIRST_ORDER_PERK.minSubtotal, 50_000);
  assert.strictEqual(FIRST_ORDER_PERK.maxWaiver, 5_000);
  assert.strictEqual(FIRST_ORDER_PERK.couponCode, 'FIRSTDELIVERY');
  assert.deepStrictEqual(FIRST_ORDER_PERK.states, ['FCT - Abuja']);
});

// ── isPerkState ─────────────────────────────────────────────────────────────
// The checkout form, Google's geocoder and the LGA package each spell the
// capital differently, so every spelling has to land on the same answer.
test('isPerkState accepts every FCT spelling the app produces', () => {
  for (const s of [
    'FCT - Abuja', 'fct - abuja', 'FCT', 'fct', 'Abuja', 'abuja',
    'Federal Capital Territory', 'federal capital territory  ',
  ]) {
    assert.strictEqual(isPerkState(s), true, `expected ${JSON.stringify(s)} to qualify`);
  }
});

test('isPerkState rejects other states and blanks', () => {
  for (const s of ['Lagos', 'Nasarawa', 'Niger', '', null, undefined]) {
    assert.strictEqual(isPerkState(s), false, `expected ${JSON.stringify(s)} to be rejected`);
  }
});

// ── The happy path ──────────────────────────────────────────────────────────
test('waives the whole fee for an eligible first order', () => {
  const r = evaluate();
  assert.strictEqual(r.eligible, true);
  assert.strictEqual(r.reason, 'ok');
  assert.strictEqual(r.waivedAmount, 3_000);
  assert.strictEqual(r.payableFee, 0);
});

// ── Each disqualifying reason ───────────────────────────────────────────────
test('a signed-out shopper is not eligible', () => {
  const r = evaluate({ signedIn: false });
  assert.strictEqual(r.eligible, false);
  assert.strictEqual(r.reason, 'not_signed_in');
  assert.strictEqual(r.waivedAmount, 0);
  assert.strictEqual(r.payableFee, 3_000);
});

test('a disabled perk is not eligible', () => {
  const r = evaluate({ enabled: false });
  assert.strictEqual(r.eligible, false);
  assert.strictEqual(r.reason, 'disabled');
  assert.strictEqual(r.payableFee, 3_000);
});

test('a returning customer is not eligible', () => {
  const r = evaluate({ hasPriorOrder: true });
  assert.strictEqual(r.eligible, false);
  assert.strictEqual(r.reason, 'already_purchased');
  assert.strictEqual(r.payableFee, 3_000);
});

test('a subtotal under the minimum is not eligible', () => {
  const r = evaluate({ subtotal: 49_999 });
  assert.strictEqual(r.eligible, false);
  assert.strictEqual(r.reason, 'below_minimum');
  assert.strictEqual(r.payableFee, 3_000);
});

test('delivery outside FCT is not eligible', () => {
  const r = evaluate({ state: 'Lagos' });
  assert.strictEqual(r.eligible, false);
  assert.strictEqual(r.reason, 'outside_zone');
  assert.strictEqual(r.payableFee, 3_000);
});

test('there is nothing to waive when delivery is already free', () => {
  const r = evaluate({ baseFee: 0 });
  assert.strictEqual(r.eligible, false);
  assert.strictEqual(r.reason, 'no_fee');
  assert.strictEqual(r.waivedAmount, 0);
  assert.strictEqual(r.payableFee, 0);
});

// Disqualifiers are checked in a fixed order so the UI can show the single most
// actionable message. "Sign in" outranks "spend more" — signing in is free.
test('reasons are reported in priority order when several apply', () => {
  assert.strictEqual(
    evaluate({ signedIn: false, subtotal: 10, state: 'Lagos' }).reason,
    'not_signed_in',
  );
  assert.strictEqual(
    evaluate({ hasPriorOrder: true, subtotal: 10 }).reason,
    'already_purchased',
  );
  assert.strictEqual(
    evaluate({ subtotal: 10, state: 'Lagos' }).reason,
    'outside_zone',
  );
});

// ── The cap ─────────────────────────────────────────────────────────────────
test('a fee above the cap is only partly waived', () => {
  const r = evaluate({ baseFee: 8_000 });
  assert.strictEqual(r.eligible, true);
  assert.strictEqual(r.waivedAmount, 5_000);
  assert.strictEqual(r.payableFee, 3_000);
});

test('a fee exactly at the cap is fully waived', () => {
  const r = evaluate({ baseFee: 5_000 });
  assert.strictEqual(r.eligible, true);
  assert.strictEqual(r.waivedAmount, 5_000);
  assert.strictEqual(r.payableFee, 0);
});

test('the minimum subtotal is inclusive', () => {
  assert.strictEqual(evaluate({ subtotal: 50_000 }).eligible, true);
});

// ── Hostile / sloppy inputs ─────────────────────────────────────────────────
// baseFee arrives from a query string and from request bodies, so it reaches
// this function as a string or as junk more often than as a clean number.
test('numeric strings are coerced', () => {
  const r = evaluateFirstOrderPerk({ ...OK, subtotal: '50000', baseFee: '3000' });
  assert.strictEqual(r.eligible, true);
  assert.strictEqual(r.waivedAmount, 3_000);
  assert.strictEqual(r.payableFee, 0);
});

test('unparseable amounts are treated as zero, never as NaN', () => {
  const r = evaluateFirstOrderPerk({ ...OK, baseFee: 'free' });
  assert.strictEqual(r.reason, 'no_fee');
  assert.strictEqual(r.waivedAmount, 0);
  assert.strictEqual(r.payableFee, 0);
});

test('a negative fee cannot mint a negative waiver', () => {
  const r = evaluate({ baseFee: -500 });
  assert.strictEqual(r.waivedAmount, 0);
  assert.strictEqual(r.payableFee, 0);
});

test('a missing argument object does not throw', () => {
  const r = evaluateFirstOrderPerk();
  assert.strictEqual(r.eligible, false);
  assert.strictEqual(r.payableFee, 0);
});

// Fractional kobo would desync the client total from the server total, so the
// payable fee is rounded to whole naira.
test('fractional fees round to whole naira', () => {
  const r = evaluate({ baseFee: 5_000.4 });
  assert.strictEqual(r.waivedAmount, 5_000);
  assert.strictEqual(r.payableFee, 0);
  const partial = evaluate({ baseFee: 7_500.6 });
  assert.strictEqual(partial.waivedAmount, 5_000);
  assert.strictEqual(partial.payableFee, 2_501);
});
