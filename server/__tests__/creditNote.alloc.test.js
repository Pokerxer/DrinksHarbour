// __tests__/creditNote.alloc.test.js
//
// The arithmetic behind unapplied customer credit, with no database and no
// mongoose. Everything that decides where a credit lands lives here, because
// these rules are the ones that were wrong in the first place:
//
//   - a standalone credit had no way to reach a customer balance
//   - a paid invoice could not be credited at all
//
// so the logic is pure and tested here first.
const test = require('node:test');
const assert = require('node:assert/strict');
const alloc = require('../services/creditNote.alloc');

test('a note total is VAT-inclusive', () => {
  assert.equal(alloc.noteTotal({ amount: 100000, taxAmount: 7500 }), 107500);
  assert.equal(alloc.noteTotal({ amount: 100000 }), 100000);
  assert.equal(alloc.noteTotal({}), 0);
});

test('outstanding nets off payments and existing credit', () => {
  assert.equal(alloc.invoiceOutstanding({ total: 107500, amountPaid: 0 }), 107500);
  assert.equal(alloc.invoiceOutstanding({ total: 107500, amountPaid: 53750 }), 53750);
  assert.equal(
    alloc.invoiceOutstanding({ total: 107500, amountPaid: 0, creditedAmount: 20000 }),
    87500,
  );
});

test('outstanding never reports negative, so a over-credited invoice reads zero', () => {
  // This clamp is why a broken allocation would be invisible rather than loud.
  assert.equal(alloc.invoiceOutstanding({ total: 100, amountPaid: 100, creditedAmount: 50 }), 0);
});

test('a note splits into the part the invoice absorbs and the rest as credit', () => {
  assert.deepEqual(alloc.planAllocation({ total: 107500, outstanding: 107500 }), {
    appliedNow: 107500,
    unapplied: 0,
  });
  assert.deepEqual(alloc.planAllocation({ total: 50000, outstanding: 107500 }), {
    appliedNow: 50000,
    unapplied: 0,
  });
});

test('credit exceeding the invoice becomes unapplied customer credit', () => {
  assert.deepEqual(alloc.planAllocation({ total: 50000, outstanding: 20000 }), {
    appliedNow: 20000,
    unapplied: 30000,
  });
});

test('a fully paid invoice absorbs nothing, so the whole note is unapplied', () => {
  // The case that was impossible before: total 0 outstanding meant every
  // credit, even a one-naira note, was rejected.
  assert.deepEqual(alloc.planAllocation({ total: 50000, outstanding: 0 }), {
    appliedNow: 0,
    unapplied: 50000,
  });
});

test('with no invoice at all the note is entirely unapplied credit', () => {
  assert.deepEqual(alloc.planAllocation({ total: 75000, outstanding: null }), {
    appliedNow: 0,
    unapplied: 75000,
  });
});

// ── applying credit ─────────────────────────────────────────────────────────

const note = (id, unappliedAmount) => ({ _id: id, unappliedAmount });

test('applying credit takes from the oldest note first', () => {
  const out = alloc.planApplication({
    notes: [note('old', 30000), note('new', 40000)],
    outstanding: 50000,
    want: 50000,
  });
  assert.deepEqual(out.takes.map((t) => [t.note._id, t.amount]), [
    ['old', 30000],
    ['new', 20000],
  ]);
  assert.equal(out.total, 50000);
});

test('applying credit splits across several notes and rounds exactly', () => {
  // 33.33 x 3 does not land on 100 in floating point; the total must.
  const out = alloc.planApplication({
    notes: [note('a', 33.33), note('b', 33.33), note('c', 33.34)],
    outstanding: 100,
    want: 100,
  });
  assert.equal(out.takes.length, 3);
  assert.equal(out.total, 100);
  assert.equal(out.takes.reduce((s, t) => s + t.amount, 0), 100);
});

test('applying credit skips notes that are already fully consumed', () => {
  const out = alloc.planApplication({
    notes: [note('empty', 0), note('live', 10000)],
    outstanding: 10000,
    want: 10000,
  });
  assert.deepEqual(out.takes.map((t) => t.note._id), ['live']);
});

test('an unrequested amount defaults to min(pool, outstanding)', () => {
  const out = alloc.planApplication({
    notes: [note('a', 90000)],
    outstanding: 40000,
  });
  assert.equal(out.total, 40000);
});

test('applying credit refuses when the account holds no credit', () => {
  assert.match(
    alloc.planApplication({ notes: [], outstanding: 10000 }).error,
    /No unapplied credit/,
  );
  assert.match(
    alloc.planApplication({ notes: [note('a', 0)], outstanding: 10000 }).error,
    /No unapplied credit/,
  );
});

test('applying credit refuses a settled invoice', () => {
  assert.match(
    alloc.planApplication({ notes: [note('a', 50000)], outstanding: 0 }).error,
    /no outstanding balance/,
  );
});

test('applying credit refuses a non-positive amount', () => {
  assert.match(
    alloc.planApplication({ notes: [note('a', 50000)], outstanding: 10000, want: 0 }).error,
    /must be positive/,
  );
});

test('applying credit refuses more than the account holds', () => {
  assert.match(
    alloc.planApplication({ notes: [note('a', 5000)], outstanding: 10000, want: 6000 }).error,
    /Exceeds available credit/,
  );
});

test('applying credit refuses more than the invoice owes', () => {
  assert.match(
    alloc.planApplication({ notes: [note('a', 50000)], outstanding: 10000, want: 20000 }).error,
    /exceeds the invoice outstanding/,
  );
});

// ── cancelling ──────────────────────────────────────────────────────────────

test('deallocating onto a partly-paid invoice is allowed', () => {
  // Invoice 107500, paid 50000, credited 20000 -> outstanding 37500. Removing
  // 20000 of credit re-opens 20000, which is legitimate: the credit is going
  // away and the invoice genuinely owes that much again.
  const out = alloc.deallocationCheck({
    so: { total: 107500, amountPaid: 50000, creditedAmount: 20000 },
    allocationAmount: 20000,
  });
  assert.equal(out.ok, true);
});

test('deallocating from a settled invoice is refused', () => {
  // Settled *because* of this credit: ₦57,500 cash + ₦50,000 credit = the
  // ₦107,500 total, so outstanding is 0. Reversing the credit would re-open an
  // invoice the customer has already paid in full by cash.
  const out = alloc.deallocationCheck({
    so: { total: 107500, amountPaid: 57500, creditedAmount: 50000 },
    allocationAmount: 50000,
  });
  assert.equal(out.ok, false);
  assert.equal(out.reason, 'was-settled');
});

test('deallocation that would leave the invoice over-credited is refused', () => {
  // Defensive: this state should be unreachable through post/apply, since
  // allocation is capped at the invoice's outstanding at the time. It guards
  // pre-existing inconsistent data instead of letting it flow on.
  const out = alloc.deallocationCheck({
    so: { total: 1000, amountPaid: 0, creditedAmount: 1600 },
    allocationAmount: 500,
  });
  assert.equal(out.ok, false);
  assert.equal(out.reason, 'over-credited');
});
