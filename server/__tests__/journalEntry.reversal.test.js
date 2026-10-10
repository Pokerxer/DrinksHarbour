// __tests__/journalEntry.reversal.test.js
//
// Reversing a journal entry must unwind the tax capture that produced it.
// Before this, the journal got a credit back on 2100 while the TaxRecord
// stayed `posted`, so the VAT ledger overstated output tax permanently and
// `tax.reconciled` could never return to true.
const test = require('node:test');
const assert = require('node:assert/strict');
const JournalEntry = require('../models/JournalEntry');
const journal = require('../services/journalEntry.service');
const taxService = require('../services/tax.service');

const SALES_ENTRY = {
  _id: 'je1',
  tenant: 'tenant1',
  refDoc: 'so1',
  refDocType: 'SalesOrder',
  entryType: 'sales_revenue',
  source: 'sales_order',
  status: 'posted',
  lines: [
    { account: '1300', debit: 1075, credit: 0 },
    { account: '4000', debit: 0, credit: 1000 },
    { account: '2100', debit: 0, credit: 75 },
  ],
};

/**
 * reverseEntry chains `.session()` off findOne before awaiting it, so the stub
 * has to be a query-like thenable rather than a bare promise.
 */
const query = (value) => ({
  session: () => query(value),
  lean: () => value,
  then: (onOk, onErr) => Promise.resolve(value).then(onOk, onErr),
});

/** Stub the two reads + the upsert that reverseEntry performs. */
function stubJournal(t, { entry = SALES_ENTRY, existingReversal = null } = {}) {
  // First findOne is the original entry, second is the existing-reversal probe.
  // Must return synchronously: reverseEntry chains .session() off the result.
  let call = 0;
  t.mock.method(JournalEntry, 'findOne', () => (call++ === 0 ? query(entry) : query(existingReversal)));
  t.mock.method(JournalEntry, 'findOneAndUpdate', async (_filter, update) => ({
    ...(update.$setOnInsert || {}),
    _id: 'rev1',
  }));
  return SALES_ENTRY;
}

test('reversing a VAT-bearing entry reverses its tax capture', async (t) => {
  stubJournal(t);
  const reverseTax = t.mock.method(taxService, 'reverseDocumentTax', async () => {});

  await journal.reverseEntry({ tenantId: 'tenant1', entryId: 'je1', userId: 'u1' });

  assert.equal(reverseTax.mock.callCount(), 1);
  const arg = reverseTax.mock.calls[0].arguments[0];
  assert.equal(arg.sourceType, 'sales_order');
  assert.equal(String(arg.doc._id), 'so1');
  assert.equal(arg.userId, 'u1');
});

test('reversing a POS receipt reverses the POS output VAT', async (t) => {
  stubJournal(t, { entry: { ...SALES_ENTRY, refDocType: 'Order', refDoc: 'o1', source: 'pos' } });
  const reverseTax = t.mock.method(taxService, 'reverseDocumentTax', async () => {});

  await journal.reverseEntry({ tenantId: 'tenant1', entryId: 'je1', userId: 'u1' });

  assert.equal(reverseTax.mock.calls[0].arguments[0].sourceType, 'pos');
});

test('reversing an entry that never captured tax does not touch the tax ledger', async (t) => {
  stubJournal(t, { entry: { ...SALES_ENTRY, refDocType: 'Manual', refDoc: null, source: 'manual', entryType: 'manual' } });
  const reverseTax = t.mock.method(taxService, 'reverseDocumentTax', async () => {});

  await journal.reverseEntry({ tenantId: 'tenant1', entryId: 'je1', userId: 'u1' });

  assert.equal(reverseTax.mock.callCount(), 0);
});

test('a tax reversal failure never blocks the financial reversal', async (t) => {
  // The journal is the record of what happened; a tax-ledger write failing is
  // repairable by the backfill script, but losing the journal reversal is not.
  stubJournal(t);
  t.mock.method(taxService, 'reverseDocumentTax', async () => { throw new Error('tax db down'); });
  t.mock.method(console, 'error', () => {});

  const reversal = await journal.reverseEntry({ tenantId: 'tenant1', entryId: 'je1', userId: 'u1' });

  assert.equal(reversal._id, 'rev1');
});

test('an already-reversed entry is not re-reversed on either ledger', async (t) => {
  stubJournal(t, { existingReversal: { _id: 'rev1', entryType: 'reversal' } });
  t.mock.method(JournalEntry, 'findOneAndUpdate', async () => { throw new Error('must not upsert'); });
  const reverseTax = t.mock.method(taxService, 'reverseDocumentTax', async () => {});

  const reversal = await journal.reverseEntry({ tenantId: 'tenant1', entryId: 'je1', userId: 'u1' });

  assert.equal(reversal._id, 'rev1');
  assert.equal(reverseTax.mock.callCount(), 0);
});

test('the reversal is a pure swap that exactly cancels the original', async (t) => {
  let payload;
  stubJournal(t);
  t.mock.restoreAll();
  let call = 0;
  t.mock.method(JournalEntry, 'findOne', () => (call++ === 0 ? query(SALES_ENTRY) : query(null)));
  t.mock.method(JournalEntry, 'findOneAndUpdate', async (_f, update) => { payload = update.$setOnInsert; return payload; });

  await journal.reverseEntry({ tenantId: 'tenant1', entryId: 'je1', userId: 'u1' });
  assert.ok(payload, 'reversal was not written');

  const dr = payload.lines.reduce((s, l) => s + l.debit, 0);
  const cr = payload.lines.reduce((s, l) => s + l.credit, 0);
  assert.equal(dr, SALES_ENTRY.lines.reduce((s, l) => s + l.credit, 0));
  assert.equal(cr, SALES_ENTRY.lines.reduce((s, l) => s + l.debit, 0));
  // Original + reversal sums to zero on every account.
  for (const l of SALES_ENTRY.lines) {
    const mirror = payload.lines.find((m) => m.account === l.account);
    assert.equal(mirror.debit, l.credit);
    assert.equal(mirror.credit, l.debit);
  }
});
