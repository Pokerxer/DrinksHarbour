// __tests__/posTabTender.test.js
//
// Deciding how much of a sale the customer's account actually covers. Pure, so
// the rules can be checked without a POS, a wallet or a customer.
//
// The rule being encoded: the account is spent down first, and whatever is left
// becomes a tab charge. Both halves matter — spending only part of the balance
// would leave stored value stranded, and tabbing the whole total would overdraw
// a customer who has money available.
const test = require('node:test');
const assert = require('node:assert/strict');

const { splitAccountTender } = require('../services/customerAccount.tender');

test('a fully covered sale spends the balance and tabs nothing', () => {
  const r = splitAccountTender({ payableTotal: 2000, availableBalance: 5000, creditLimit: 0, tabBalance: 0 });
  assert.equal(r.spend, 2000);
  assert.equal(r.shortfall, 0);
  assert.equal(r.charged, false);
  assert.equal(r.withinLimit, true, 'a sale needing no credit cannot breach a limit');
});

test('a sale larger than the balance spends what is there and tabs the rest', () => {
  const r = splitAccountTender({ payableTotal: 2000, availableBalance: 500, creditLimit: 10000, tabBalance: 0 });
  assert.equal(r.spend, 500);
  assert.equal(r.shortfall, 1500);
  assert.equal(r.charged, true);
  assert.equal(r.withinLimit, true);
});

test('an exact-balance sale is not a charge', () => {
  const r = splitAccountTender({ payableTotal: 500, availableBalance: 500, creditLimit: 0, tabBalance: 0 });
  assert.equal(r.spend, 500);
  assert.equal(r.shortfall, 0);
  assert.equal(r.charged, false);
});

test('an empty account tabs the whole total', () => {
  const r = splitAccountTender({ payableTotal: 2000, availableBalance: 0, creditLimit: 10000, tabBalance: 0 });
  assert.equal(r.spend, 0);
  assert.equal(r.shortfall, 2000);
});

test('the limit counts the balance already owed, not just this sale', () => {
  // The customer owes 6,000 and may owe 10,000 in total, so a 3,000 sale lands
  // them at 9,000 — inside the limit. Checking only the 3,000 sale would let the
  // tab reach 13,000, over the limit by the entire existing debt.
  const ok = splitAccountTender({ payableTotal: 3000, availableBalance: 0, creditLimit: 10000, tabBalance: 6000 });
  assert.equal(ok.withinLimit, true);
  assert.equal(ok.requiredLimit, 9000, 'reports the limit the sale actually needs');

  const over = splitAccountTender({ payableTotal: 3000, availableBalance: 0, creditLimit: 10000, tabBalance: 7500 });
  assert.equal(over.withinLimit, false);
  assert.equal(over.requiredLimit, 10500);
});

test('a zero limit means no credit, so any shortfall is refused', () => {
  const r = splitAccountTender({ payableTotal: 500, availableBalance: 0, creditLimit: 0, tabBalance: 0 });
  assert.equal(r.shortfall, 500);
  assert.equal(r.withinLimit, false);
});

test('a customer already over their limit cannot add another tab charge', () => {
  // 12,000 owed against a 10,000 limit. A 500 sale is refused, because allowing
  // it would mean the check is really "is the total under the limit" — and
  // refusing here is what makes the flag trustworthy.
  const r = splitAccountTender({ payableTotal: 500, availableBalance: 0, creditLimit: 10000, tabBalance: 12000 });
  assert.equal(r.withinLimit, false);
});

test('a manager override lifts the limit without changing the amount', () => {
  const r = splitAccountTender({
    payableTotal: 500, availableBalance: 0, creditLimit: 10000, tabBalance: 12000, allowOverride: true,
  });
  assert.equal(r.withinLimit, true, 'the override authorises it, so the guard must let it through');
  assert.equal(r.requiresOverride, true, 'and the UI still needs to know to ask for one');
});

test('no shortfall never needs an override, whatever the standing debt', () => {
  const r = splitAccountTender({ payableTotal: 500, availableBalance: 900, creditLimit: 0, tabBalance: 99000 });
  assert.equal(r.requiresOverride, false);
  assert.equal(r.withinLimit, true);
});

test('kobo rounding never leaves a stray naira behind', () => {
  // 0.1 + 0.2 style drift is the classic way a tender split ends up one kobo
  // short of the total, which the journal then rejects.
  const r = splitAccountTender({ payableTotal: 100.1, availableBalance: 33.33, creditLimit: 1000, tabBalance: 0 });
  assert.equal(r.spend, 33.33);
  assert.equal(r.shortfall, 66.77);
  assert.equal(Math.round((r.spend + r.shortfall) * 100), Math.round(r.payableTotal * 100));
});

test('a negative or non-finite total is rejected rather than tabbed', () => {
  assert.throws(() => splitAccountTender({ payableTotal: -5, availableBalance: 0, creditLimit: 0, tabBalance: 0 }), /positive/);
  assert.throws(() => splitAccountTender({ payableTotal: NaN, availableBalance: 0, creditLimit: 0, tabBalance: 0 }), /finite/);
});

test('a negative stored balance is treated as no balance', () => {
  // Defensive: the wallet guard prevents this, but a corrupted value must not
  // produce a negative `spend` that would credit the wallet.
  const r = splitAccountTender({ payableTotal: 500, availableBalance: -100, creditLimit: 5000, tabBalance: 0 });
  assert.equal(r.spend, 0);
  assert.equal(r.shortfall, 500);
});

test('a non-finite tab balance is refused rather than treated as zero', () => {
  // Zero would let an unreadable balance authorise credit nobody granted.
  assert.throws(
    () => splitAccountTender({ payableTotal: 500, availableBalance: 0, creditLimit: 1000, tabBalance: NaN }),
    /tab balance/,
  );
});

test('a fully credited sale reports the tenders to record on the order', () => {
  const r = splitAccountTender({ payableTotal: 2000, availableBalance: 500, creditLimit: 10000, tabBalance: 0 });
  assert.deepEqual(r.tenders, [
    { method: 'wallet', amount: 500 },
    { method: 'account', amount: 1500 },
  ]);
  assert.deepEqual(
    splitAccountTender({ payableTotal: 2000, availableBalance: 2000, creditLimit: 0, tabBalance: 0 }).tenders,
    [{ method: 'wallet', amount: 2000 }],
    'a covered sale records one tender, exactly as before this feature',
  );
});
