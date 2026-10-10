// __tests__/creditNote.balance.test.js
//
// The unapplied-credit balance is derived from the notes rather than cached on
// POSCustomer. The filter inside the aggregation is therefore the whole
// correctness argument: a cancelled note's credit must not be counted, and one
// tenant's notes must never leak into another's balance. These tests assert the
// pipeline that enforces that, since a wrong $match is silent — it returns a
// plausible wrong number rather than failing.
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const CreditNote = require('../models/CreditNote');

const TENANT = new mongoose.Types.ObjectId();
const CUSTOMER = new mongoose.Types.ObjectId();

const service = () => require('../services/creditNote.service');

function mockAggregate(t, rows = []) {
  let pipeline;
  t.mock.method(CreditNote, 'aggregate', (p) => {
    pipeline = p;
    return Promise.resolve(rows);
  });
  return () => pipeline;
}

test('the balance counts only applied notes for that customer and tenant', async (t) => {
  const seen = mockAggregate(t, [{ _id: null, total: 87500 }]);
  const balance = await service().unappliedBalance(TENANT, CUSTOMER);
  assert.equal(balance, 87500);
  const [match] = seen();
  assert.equal(String(match.$match.tenant), String(TENANT));
  assert.equal(String(match.$match.customer), String(CUSTOMER));
  assert.equal(match.$match.status, 'applied', 'a cancelled note holds no credit');
});

test('an account with no credit reads zero', async (t) => {
  mockAggregate(t, []);
  assert.equal(await service().unappliedBalance(TENANT, CUSTOMER), 0);
});

test('an invalid customer id reads zero rather than querying', async (t) => {
  let called = false;
  t.mock.method(CreditNote, 'aggregate', () => { called = true; return Promise.resolve([]); });
  assert.equal(await service().unappliedBalance(TENANT, 'not-an-id'), 0);
  assert.equal(called, false);
});

test('balances for a directory come back keyed by customer', async (t) => {
  const other = new mongoose.Types.ObjectId();
  mockAggregate(t, [
    { _id: CUSTOMER, total: 87500 },
    { _id: other, total: 1000 },
  ]);
  const map = await service().unappliedBalances(TENANT, [String(CUSTOMER), String(other)]);
  assert.equal(map.get(String(CUSTOMER)), 87500);
  assert.equal(map.get(String(other)), 1000);
});

test('an empty customer list does not query at all', async (t) => {
  let called = false;
  t.mock.method(CreditNote, 'aggregate', () => { called = true; return Promise.resolve([]); });
  assert.equal((await service().unappliedBalances(TENANT, [])).size, 0);
  assert.equal(called, false);
});
