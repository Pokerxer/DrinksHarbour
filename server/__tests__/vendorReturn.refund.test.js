const test = require('node:test');
const assert = require('node:assert/strict');
const controller = require('../controllers/vendorReturn.controller');
const VendorReturn = require('../models/VendorReturn');

test('refund API rejects negative amounts before writing any balance', async t => {
  t.mock.method(VendorReturn, 'findOne', async () => ({ status: 'confirmed', totalAmount: 100, refundAmount: 0 }));
  let written = false;
  t.mock.method(VendorReturn, 'findOneAndUpdate', async () => { written = true; return {}; });
  const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
  let failure;
  await controller.recordRefund({ user: { tenant: 't1' }, params: { id: 'r1' }, body: { amount: -10, method: 'cash' } }, res, e => { failure = e; });
  assert.equal(written, false);
  assert.ok(failure || res.code === 400);
});

const { validateRefund, refundLines, recordVendorRefund } = require('../services/vendorReturn.refund');
function fixture(overrides = {}) {
  const doc = { _id: 'r1', tenant: 't1', returnNumber: 'RET-1', status: 'confirmed',
    totalAmount: 107.5, subtotal: 100, taxAmount: 7.5, refundAmount: 0, currency: 'NGN', refunds: [], ...overrides };
  const entries = [];
  const session = {};
  let saves = 0;
  doc.save = async options => { assert.equal(options.session, session); saves++; };
  const deps = { VendorReturn: { findOne(q) {
    assert.deepEqual(q, { _id: 'r1', tenant: 't1' });
    return { session: async supplied => { assert.equal(supplied, session); return doc; } };
  } }, transaction: run => run(session), ensureDefaultCOA: async () => {},
    postJournalEntry: async data => { assert.equal(data.session, session); entries.push(data); } };
  const record = data => recordVendorRefund({ id: 'r1', tenantId: 't1', userId: 'u1', data }, deps);
  return { doc, entries, record, saves: () => saves };
}
test('partial and final refunds preserve each payment and mark full settlement refunded', async () => {
  const f = fixture();
  await f.record({ amount: 50, method: 'cash', notes: 'first', reference: 'one', requestId: 'a' });
  assert.equal(f.doc.refundAmount, 50);
  assert.equal(f.doc.status, 'confirmed');
  await f.record({ amount: 57.5, method: 'bank_transfer', reference: 'two', requestId: 'b' });
  assert.equal(f.doc.status, 'refunded');
  assert.equal(f.doc.refundStatus, 'completed');
  assert.equal(f.doc.refunds.length, 2);
  assert.equal(f.doc.refunds[0].notes, 'first');
  assert.equal(f.doc.refunds[1].recordedBy, 'u1');
  assert.equal(f.entries.reduce((s, e) => s + e.lines[1].credit, 0), 100);
  assert.equal(f.entries.reduce((s, e) => s + e.lines[2].credit, 0), 7.5);
});
test('retrying a request after final settlement cannot record the money twice', async () => {
  const f = fixture();
  const data = { amount: 107.5, method: 'credit_note', requestId: 'same' };
  await f.record(data); await f.record(data);
  assert.equal(f.doc.refunds.length, 1);
  assert.equal(f.saves(), 1);
  assert.equal(f.entries.length, 1);
  assert.equal(f.entries[0].lines[0].account, '2000');
  await assert.rejects(f.record({ ...data, amount: 100 }), /different details/);
});
test('over-refunds and wrong statuses leave the balance unchanged', async () => {
  for (const overrides of [{ refundAmount: 100 }, { status: 'draft' }, { status: 'cancelled' }]) {
    const f = fixture(overrides);
    await assert.rejects(f.record({ amount: 10, method: 'cash' }), /remaining|confirmed/);
    assert.equal(f.saves(), 0); assert.equal(f.entries.length, 0);
  }
});
test('invalid amounts and methods are rejected', () => {
  for (const amount of [-1, 0, NaN, Infinity, '50', 0.001, 1.111]) {
    assert.throws(() => validateRefund({ amount, method: 'cash' }), /amount/);
  }
  assert.throws(() => validateRefund({ amount: 1, method: 'bogus' }), /method/);
});
test('legacy partial totals allocate only the remaining share and balanced money', () => {
  const lines = refundLines({ subtotal: 100, totalAmount: 107.5 }, { amount: 57.5, method: 'cash' }, 50);
  assert.equal(lines[0].debit, 57.5);
  assert.equal(Math.round(lines.reduce((s, l) => s + l.credit, 0) * 100), 5750);
});

test('new refund histories are excluded from legacy full-document journal posting', () => {
  const { linesForVendorReturn } = require('../services/accounting.posting');
  assert.deepEqual(linesForVendorReturn({ subtotal: 100, taxAmount: 7.5, refunds: [{ amount: 50 }] }), []);
});

test('invalid saved totals cannot create an unbalanced refund', async () => {
  for (const overrides of [{ totalAmount: NaN }, { subtotal: 200 }, { totalAmount: -1 }]) {
    const f = fixture(overrides);
    await assert.rejects(f.record({ amount: 1, method: 'cash' }), /totals/);
    assert.equal(f.saves(), 0);
  }
});
