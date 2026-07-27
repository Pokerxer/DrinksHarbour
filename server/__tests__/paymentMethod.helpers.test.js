// server/__tests__/paymentMethod.helpers.test.js
//
// Payment methods were tracked through two disagreeing lists: the create-order
// route validator and the Order schema enum. The gaps were not cosmetic —
//   • 'bank' / 'cod' passed validation and then threw at save (order lost),
//   • 'gift_card' was rejected by both, yet Gift Card is a live, selectable
//     checkout option whose card is debited *before* the order is posted, so a
//     shopper lost their balance and got no order,
//   • 'cash' / 'split' (POS) were rejected by the validator.
// These tests pin the two lists to one source of truth so they cannot drift again.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const {
  PAYMENT_METHODS,
  ACCEPTED_PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  normalizePaymentMethod,
  buildOrderPaymentFields,
} = require('../utils/paymentMethods');

const Order = require('../models/Order');

test('the Order schema enum IS the canonical payment-method list', () => {
  const schemaEnum = Order.schema.path('paymentMethod').enumValues;
  assert.deepStrictEqual(
    [...schemaEnum].sort(),
    [...PAYMENT_METHODS].sort(),
    'Order.paymentMethod enum must come from utils/paymentMethods, not a second literal',
  );
});

test('every method the API accepts normalises into the schema enum', () => {
  for (const accepted of ACCEPTED_PAYMENT_METHODS) {
    const canonical = normalizePaymentMethod(accepted);
    assert.ok(
      canonical && PAYMENT_METHODS.includes(canonical),
      `"${accepted}" is accepted by the API but does not normalise to a storable value (got ${canonical})`,
    );
  }
});

test('the API accepts every canonical method (POS cash/split included)', () => {
  for (const method of PAYMENT_METHODS) {
    assert.ok(
      ACCEPTED_PAYMENT_METHODS.includes(method),
      `"${method}" is storable but the create-order validator would reject it`,
    );
  }
});

test('gift_card is supported end to end', () => {
  // Checkout lists Gift Card as comingSoon:false and debits the card via
  // /api/gift-cards/pay-checkout before POSTing the order — a rejected method
  // here means the shopper is charged for an order that never exists.
  assert.ok(PAYMENT_METHODS.includes('gift_card'), 'gift_card must be storable');
  assert.strictEqual(normalizePaymentMethod('gift_card'), 'gift_card');
  assert.strictEqual(normalizePaymentMethod('giftcard'), 'gift_card');
});

test('legacy shorthand is folded instead of failing at save', () => {
  assert.strictEqual(normalizePaymentMethod('bank'), 'bank_transfer');
  assert.strictEqual(normalizePaymentMethod('cod'), 'cash_on_delivery');
  assert.strictEqual(normalizePaymentMethod('COD'), 'cash_on_delivery');
  assert.strictEqual(normalizePaymentMethod('Bank Transfer'), 'bank_transfer');
  assert.strictEqual(normalizePaymentMethod('pay_with_bank'), 'bank_transfer');
  assert.strictEqual(normalizePaymentMethod('ussd'), 'bank_transfer');
});

test('unrecognised values normalise to null rather than reaching the schema', () => {
  for (const bad of ['', '   ', 'crypto', 'bitcoin', null, undefined, 42, {}]) {
    assert.strictEqual(normalizePaymentMethod(bad), null, `${JSON.stringify(bad)} must not normalise`);
  }
});

test('every canonical method has a display label', () => {
  for (const method of PAYMENT_METHODS) {
    assert.ok(PAYMENT_METHOD_LABELS[method], `"${method}" has no admin/customer-facing label`);
  }
});

test('a gateway order gets a paymentReference the webhooks can find it by', () => {
  // Korapay/Paystack charge.success handlers do Order.findOne({ paymentReference }).
  // The checkout return page sends the gateway reference as `transactionId`, so
  // reading only `reference` left every gateway order unmatchable — the safety
  // net for "customer paid, then closed the tab" was silently dead.
  const fields = buildOrderPaymentFields({
    method: 'korapay',
    transactionId: 'DH-1785091671377-0403f39b',
    paidAt: '2026-07-26T18:48:51.000Z',
  });
  assert.strictEqual(fields.paymentReference, 'DH-1785091671377-0403f39b');
  assert.strictEqual(fields.paymentIntentId, 'DH-1785091671377-0403f39b');
  assert.ok(fields.paidAt instanceof Date);
  assert.strictEqual(fields.stripePaymentIntentId, undefined, 'not a Stripe payment');
});

test('an explicit reference still wins over transactionId', () => {
  const fields = buildOrderPaymentFields({
    method: 'korapay',
    reference: 'DH-ref-1',
    transactionId: 'kpy_tx_987',
  });
  assert.strictEqual(fields.paymentReference, 'DH-ref-1');
  assert.strictEqual(fields.paymentIntentId, 'kpy_tx_987');
});

test('Stripe payments keep their dedicated webhook column', () => {
  const fields = buildOrderPaymentFields({ method: 'stripe', transactionId: 'pi_123' });
  assert.strictEqual(fields.stripePaymentIntentId, 'pi_123');
});

test('buildOrderPaymentFields tolerates missing and malformed payloads', () => {
  assert.deepStrictEqual(buildOrderPaymentFields(null), {});
  assert.deepStrictEqual(buildOrderPaymentFields(undefined), {});
  assert.deepStrictEqual(buildOrderPaymentFields({}), {});
  const bad = buildOrderPaymentFields({ transactionId: 'tx', paidAt: 'not-a-date' });
  assert.strictEqual(bad.paidAt, undefined, 'an unparseable date must not become Invalid Date');
});

test('the create-order route validator has no payment-method list of its own', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'routes', 'order.routes.js'), 'utf8');
  assert.match(
    src,
    /ACCEPTED_PAYMENT_METHODS/,
    'order.routes.js must validate against the shared list',
  );
  assert.doesNotMatch(
    src,
    /body\('paymentMethod'\)[\s\S]{0,120}isIn\(\s*\[/,
    'a literal payment-method array in the route is how the two lists drifted apart',
  );
});
