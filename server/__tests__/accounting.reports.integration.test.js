// services/accounting.service.js report assembly against mocked models.
const test = require('node:test');
const assert = require('node:assert/strict');
const Account = require('../models/Account');
const JournalEntry = require('../models/JournalEntry');

const svc = require('../services/accounting.service');

const cashDoc = { code: '1000', name: 'Cash', type: 'asset' };

/** Chainable stand-in for the queries the service builds. */
const chain = (rows) => ({
  select: () => chain(rows),
  sort: () => chain(rows),
  lean: async () => rows,
});

test('a ledger with no opening date reports movement, not a balance', async (t) => {
  // The account carried ₦5,000,000 before the window and moved ₦100,000 inside
  // it. With no `from`, the service never looks at prior entries, so opening is
  // 0 and "closing" comes back as ₦100,000 — the *movement*. The widget labels
  // that figure "Closing" and the table's running column says "Balance", so
  // cash looked 50x smaller than it is.
  t.mock.method(Account, 'findOne', () => ({ lean: async () => cashDoc }));
  t.mock.method(JournalEntry, 'find', () =>
    chain([{ _id: 'e1', date: '2026-08-10T00:00:00Z', lines: [{ account: '1000', debit: 100000, credit: 0 }] }])
  );

  const gl = await svc.getGeneralLedger('tenant', { account: '1000' });
  assert.equal(gl.openingBalance, 0);
  assert.equal(gl.totals.closing, 100000);
  // The payload must not let a movement masquerade as a balance.
  assert.equal(gl.openingIncluded, false, 'caller must be able to tell movement from balance');
});

test('a ledger with an opening date reports a real balance', async (t) => {
  t.mock.method(Account, 'findOne', () => ({ lean: async () => cashDoc }));
  const prior = [{ _id: 'p1', date: '2026-07-01T00:00:00Z', lines: [{ account: '1000', debit: 5000000, credit: 0 }] }];
  const inWindow = [{ _id: 'e1', date: '2026-08-10T00:00:00Z', lines: [{ account: '1000', debit: 100000, credit: 0 }] }];
  let call = 0;
  t.mock.method(JournalEntry, 'find', () => chain(call++ === 0 ? prior : inWindow));

  const gl = await svc.getGeneralLedger('tenant', { account: '1000', from: '2026-08-01', to: '2026-08-31' });
  assert.equal(gl.openingBalance, 5000000);
  assert.equal(gl.totals.closing, 5100000);
  assert.equal(gl.openingIncluded, true);
});

test('a credit-nature ledger still opens on the credit side', async (t) => {
  t.mock.method(Account, 'findOne', () => ({ lean: async () => ({ code: '2100', name: 'Output VAT', type: 'liability' }) }));
  const prior = [{ _id: 'p1', date: '2026-07-01T00:00:00Z', lines: [{ account: '2100', debit: 0, credit: 40000 }] }];
  const paid = [{ _id: 'e1', date: '2026-08-10T00:00:00Z', lines: [{ account: '2100', debit: 40000, credit: 0 }] }];
  let call = 0;
  t.mock.method(JournalEntry, 'find', () => chain(call++ === 0 ? prior : paid));

  const gl = await svc.getGeneralLedger('tenant', { account: '2100', from: '2026-08-01' });
  assert.equal(gl.openingBalance, 40000);
  assert.equal(gl.totals.closing, 0);
  assert.equal(gl.openingIncluded, true);
});

test('reports disclose how many draft entries they excluded', async (t) => {
  t.mock.method(Account, 'find', () => chain([cashDoc]));
  t.mock.method(JournalEntry, 'find', () =>
    chain([{ _id: 'e1', date: '2026-08-10T00:00:00Z', lines: [{ account: '1000', debit: 100, credit: 0 }] }])
  );
  t.mock.method(JournalEntry, 'countDocuments', async () => 4);

  const tb = await svc.getTrialBalance('tenant', { period: '2026-08' });
  assert.equal(tb.draftsExcluded, 4);
  assert.equal(tb.entryCount, 1, 'the reader needs the posted scale alongside the draft count');
});
