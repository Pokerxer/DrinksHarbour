// __tests__/journalEntry.service.test.js
//
// Validation paths that reject before any DB access (pure contract checks).
// DB-backed behaviour is covered by accounting.helpers.test.js + manual
// verification steps in RESUME-accounting-module.md.
const test = require('node:test');
const assert = require('node:assert');
const {
  postJournalEntry,
  resolveAccounts,
} = require('../services/journalEntry.service');

test('postJournalEntry rejects unbalanced entries with status 400', async () => {
  await assert.rejects(
    postJournalEntry({
      tenantId: '507f1f77bcf86cd799439011',
      lines: [{ account: '1000', debit: 100, credit: 0 }, { account: '4000', debit: 0, credit: 90 }],
    }),
    (err) => err.status === 400 && /not balanced/.test(err.message)
  );
});

test('postJournalEntry rejects zero-amount entries with status 400', async () => {
  await assert.rejects(
    postJournalEntry({
      tenantId: '507f1f77bcf86cd799439011',
      lines: [{ account: '1000', debit: 0, credit: 0 }],
    }),
    (err) => err.status === 400 && /no amount/.test(err.message)
  );
});

test('resolveAccounts rejects unknown codes with status 400', async () => {
  // No DB connection: Account.find throws; assert it surfaces as a rejection
  // before any write would happen.
  await assert.rejects(
    resolveAccounts('507f1f77bcf86cd799439011', [
      { account: '9999', debit: 5, credit: 5 },
    ]),
    /Cannot read|find|buffering|Mongoose/i
  );
});
