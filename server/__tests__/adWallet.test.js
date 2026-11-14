// server/__tests__/adWallet.test.js
const test = require('node:test');
const assert = require('node:assert/strict');

const Tenant = require('../models/Tenant');
const AdWalletTransaction = require('../models/AdWalletTransaction');
const wallet = require('../services/adWallet.service');

const TENANT = '64b0000000000000000000aa';

test('creditAdWallet credits atomically and is idempotent by reference', async (t) => {
  let balance = 0;
  t.mock.method(Tenant, 'findOneAndUpdate', async (filter, update) => {
    balance += update.$inc.adWalletBalance;
    return { _id: TENANT, adWalletBalance: balance };
  });
  const rows = [];
  t.mock.method(AdWalletTransaction, 'findOne', async () => rows.length ? rows[0] : null);
  t.mock.method(AdWalletTransaction, 'create', async (doc) => {
    const row = { ...doc, _id: 'tx' + (rows.length + 1) };
    rows.push(row);
    return row;
  });

  await wallet.creditAdWallet(TENANT, 10000, { reference: 'PS-1', reason: 'top-up' });
  const again = await wallet.creditAdWallet(TENANT, 10000, { reference: 'PS-1', reason: 'top-up' });

  assert.equal(rows.length, 1, 'second credit with same reference must not append');
  assert.equal(balance, 10000, 'second credit must not mutate balance');
  assert.equal(again._id, rows[0]._id);
});

test('debitForClick refuses when balance is below the tariff', async (t) => {
  t.mock.method(Tenant, 'findOneAndUpdate', async () => null); // guard fails
  t.mock.method(AdWalletTransaction, 'create', async () => { throw new Error('must not append'); });

  const result = await wallet.debitForClick(TENANT, '507f1f77bcf86cd799439099', 50);
  assert.deepEqual(result, { ok: false, reason: 'insufficient_balance' });
});

test('debitForClick debits and appends a ledger row with balanceAfter', async (t) => {
  let balance = 500;
  t.mock.method(Tenant, 'findOneAndUpdate', async (filter, update) => {
    balance += update.$inc.adWalletBalance;
    return { _id: TENANT, adWalletBalance: balance };
  });
  let appended;
  t.mock.method(AdWalletTransaction, 'create', async (doc) => { appended = doc; return { _id: 'tx2', ...doc }; });

  const result = await wallet.debitForClick(TENANT, '507f1f77bcf86cd799439099', 50);
  assert.ok(result.ok);
  assert.equal(appended.type, 'debit');
  assert.equal(appended.amount, 50);
  assert.equal(appended.balanceAfter, 450);
  assert.ok(String(appended.reason).includes('507f1f77bcf86cd799439099'));
});
