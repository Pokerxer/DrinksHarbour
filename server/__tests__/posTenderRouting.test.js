// __tests__/posTenderRouting.test.js
//
// Which tender names the POS will accept, and what each one actually means.
//
// This exists because the list of accepted tenders was declared and then never
// used: `paymentMethod` was read straight from the request body and dispatched on
// a chain of `=== 'cash'` / `=== 'wallet'` comparisons. An unrecognised name
// therefore posted an order successfully — no cash counted, no wallet debited,
// no tab charged, nothing in the drawer. The sale looked normal in every
// report. For a till that is a straight revenue hole, and it was reachable by
// any client that sent a tender name the server did not happen to special-case.
//
// 'account' is the case that bit: it reads as "charge their tab" but had no
// branch, so it took the same silent path. It is now a real tender that runs the
// same wallet-then-tab split as 'wallet', which is what a caller sending it
// means.
const test = require('node:test');
const assert = require('node:assert/strict');

const { TENDER_METHODS, isAccountTender, normaliseTender } = require('../services/posTender');

test('the ordinary tenders are accepted', () => {
  for (const m of ['cash', 'card', 'bank_transfer', 'mobile_money', 'split', 'wallet']) {
    assert.equal(normaliseTender(m), m, `${m} must pass through unchanged`);
  }
});

test("'wallet' is an accepted tender even though it was missing from the old list", () => {
  // The pre-existing list omitted it while the createOrder handler dispatched on
  // it, so the list and the behaviour disagreed. Asserting it keeps them together.
  assert.ok(TENDER_METHODS.includes('wallet'));
});

test("'account' is a first-class tender, not an unknown one", () => {
  assert.equal(normaliseTender('account'), 'account');
  assert.equal(isAccountTender('account'), true);
});

test("'wallet' and 'account' are both account tenders, because they are the same thing", () => {
  // One is what the cashier taps, the other is what the split math reports. They
  // must route through the same branch or one of them silently stops collecting.
  assert.equal(isAccountTender('wallet'), true);
  assert.equal(isAccountTender('account'), true);
  assert.equal(isAccountTender('cash'), false);
  assert.equal(isAccountTender('split'), false);
});

test('an unknown tender is refused rather than posted as an uncollected sale', () => {
  assert.throws(() => normaliseTender('bitcoin'), /Unknown payment method/);
  assert.throws(() => normaliseTender(''), /Unknown payment method/);
  assert.throws(() => normaliseTender(undefined), /Unknown payment method/);
  assert.throws(() => normaliseTender(null), /Unknown payment method/);
  // Prototype keys are not tenders, however plausible they look in a JSON body.
  assert.throws(() => normaliseTender('toString'), /Unknown payment method/);
  assert.throws(() => normaliseTender('constructor'), /Unknown payment method/);
});

test('the accepted list contains nothing that is not a tender', () => {
  for (const m of TENDER_METHODS) {
    assert.equal(typeof m, 'string');
    assert.doesNotThrow(() => normaliseTender(m));
  }
});