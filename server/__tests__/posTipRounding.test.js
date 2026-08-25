// server/__tests__/posTipRounding.test.js
//
// The arithmetic behind a tip and a rounded cash total.
//
// Both are money added to a sale AFTER every discount, pricelist rule and
// commission split has been computed — and that is the whole reason they are
// held apart from `subtotal`. A tip folded into the subtotal would be split
// with the platform as though the customer had bought more gin; a rounding
// delta folded in would do the same for a few naira the till invented.
//
// The failure mode for all of this is a plausible wrong NUMBER, never an
// error: the sale completes, the receipt prints, and the tenant is quietly
// paid commission on a gratuity. So these tests assert the arithmetic
// directly rather than that a handler returned 200.
//
// The rules under test, all mirrored on the client so the amount displayed
// and the amount charged cannot disagree:
//   – A tip only applies when the tenant has tips switched on.
//   – Rounding only applies to a lone CASH tender; card and transfer settle
//     the exact figure, so rounding them would leave the books off by the delta.
//   – Rounding is computed on total + tip, not on total, because the rounded
//     figure is what the customer is actually asked to hand over.

const test = require('node:test');
const assert = require('node:assert/strict');

/**
 * The server's tip rule, extracted from createPOSOrder.
 * A tip that arrives while the feature is off is not an error — it is ignored.
 */
function resolveTip(rawTipAmount, tipsEnabled) {
  return tipsEnabled
    ? Math.max(0, parseFloat((Number(rawTipAmount) || 0).toFixed(2)))
    : 0;
}

/**
 * The server's cash-rounding rule, extracted from createPOSOrder.
 * Returns the delta to apply, which may be negative (rounded in the
 * customer's favour) or zero.
 */
function resolveRounding({
  total,
  tipAmount,
  paymentMethod,
  cashRoundingEnabled,
  roundingIncrement,
}) {
  const payableBeforeRounding = total + tipAmount;
  if (!cashRoundingEnabled || paymentMethod !== 'cash' || roundingIncrement <= 1) {
    return 0;
  }
  const rounded =
    Math.round(payableBeforeRounding / roundingIncrement) * roundingIncrement;
  return parseFloat((rounded - payableBeforeRounding).toFixed(2));
}

const ON = { cashRoundingEnabled: true, roundingIncrement: 10 };

// ── Tips ─────────────────────────────────────────────────────────────────────

test('a tip is ignored when the tenant has tips switched off', () => {
  // A stale till still showing the tip pad must not be able to add one.
  assert.equal(resolveTip(500, false), 0);
});

test('a tip is taken when the tenant has tips switched on', () => {
  assert.equal(resolveTip(500, true), 500);
});

test('a negative tip is clamped to zero', () => {
  // Otherwise a negative "tip" is a discount with no permission check on it.
  assert.equal(resolveTip(-500, true), 0);
});

test('a non-numeric tip is treated as no tip', () => {
  assert.equal(resolveTip('abc', true), 0);
  assert.equal(resolveTip(null, true), 0);
  assert.equal(resolveTip(undefined, true), 0);
});

// ── Rounding ─────────────────────────────────────────────────────────────────

test('a cash total rounds up to the nearest increment', () => {
  // ₦4,997 → ₦5,000: the customer hands over 3 naira more.
  const delta = resolveRounding({
    total: 4997, tipAmount: 0, paymentMethod: 'cash', ...ON,
  });
  assert.equal(delta, 3);
  assert.equal(4997 + delta, 5000);
});

test('a cash total rounds down when that is nearer', () => {
  // ₦5,002 → ₦5,000: the delta is negative, in the customer's favour.
  const delta = resolveRounding({
    total: 5002, tipAmount: 0, paymentMethod: 'cash', ...ON,
  });
  assert.equal(delta, -2);
  assert.equal(5002 + delta, 5000);
});

test('a total already on the increment is not moved', () => {
  const delta = resolveRounding({
    total: 5000, tipAmount: 0, paymentMethod: 'cash', ...ON,
  });
  assert.equal(delta, 0);
});

test('card and transfer settle the exact figure', () => {
  // Rounding an electronic tender would leave the settlement short or over by
  // the delta, with nothing in the books to explain it.
  for (const method of ['card', 'bank_transfer', 'mobile_money', 'wallet', 'split']) {
    assert.equal(
      resolveRounding({ total: 4997, tipAmount: 0, paymentMethod: method, ...ON }),
      0,
      `${method} must not round`
    );
  }
});

test('rounding does nothing when the tenant has it switched off', () => {
  const delta = resolveRounding({
    total: 4997, tipAmount: 0, paymentMethod: 'cash',
    cashRoundingEnabled: false, roundingIncrement: 10,
  });
  assert.equal(delta, 0);
});

test('an increment of 1 rounds nothing', () => {
  // ₦1 is the default and means "no rounding" — every naira figure is already
  // on it, so the branch must be skipped rather than compute a zero the long way.
  const delta = resolveRounding({
    total: 4997, tipAmount: 0, paymentMethod: 'cash',
    cashRoundingEnabled: true, roundingIncrement: 1,
  });
  assert.equal(delta, 0);
});

// ── Tips and rounding together ───────────────────────────────────────────────

test('rounding is computed on the total PLUS the tip', () => {
  // ₦4,000 goods + ₦497 tip = ₦4,497 → ₦4,500. Rounding the goods alone
  // would round ₦4,000 to ₦4,000 and ask the customer for ₦4,497 — a figure
  // the rounding setting exists specifically to avoid.
  const tipAmount = resolveTip(497, true);
  const delta = resolveRounding({
    total: 4000, tipAmount, paymentMethod: 'cash', ...ON,
  });
  assert.equal(delta, 3);
  assert.equal(4000 + tipAmount + delta, 4500);
});

test('the payable total is goods + tip + rounding', () => {
  const total = 12345;
  const tipAmount = resolveTip(1000, true);
  const roundingAmount = resolveRounding({
    total, tipAmount, paymentMethod: 'cash', ...ON,
  });
  const payableTotal = parseFloat(
    (total + tipAmount + roundingAmount).toFixed(2)
  );

  assert.equal(payableTotal, 13350);
  // And the goods figure is recoverable from the stored fields — which is what
  // lets the receipt compute VAT on the goods alone.
  assert.equal(payableTotal - tipAmount - roundingAmount, total);
});

test('a sale with neither tip nor rounding is unchanged', () => {
  // The common case must not drift by a rounding artefact.
  const total = 7500;
  const tipAmount = resolveTip(0, true);
  const roundingAmount = resolveRounding({
    total, tipAmount, paymentMethod: 'card', ...ON,
  });
  assert.equal(tipAmount, 0);
  assert.equal(roundingAmount, 0);
  assert.equal(total + tipAmount + roundingAmount, 7500);
});
