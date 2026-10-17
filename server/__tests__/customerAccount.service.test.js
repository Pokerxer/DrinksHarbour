// __tests__/customerAccount.service.test.js
//
// The tab ledger: deriving what a customer owes, and refusing to go past their
// limit without someone signing for it.
//
// The aggregation filter gets asserted directly. A wrong $match here is silent —
// it reports a plausible wrong balance rather than failing — and a customer
// being told they owe less than they do is the kind of error that surfaces as a
// bad debt write-off, months later.
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Statement = require('../models/CustomerAccountStatement');
const POSCustomer = require('../models/POSCustomer');

const TENANT = new mongoose.Types.ObjectId();
const OTHER_TENANT = new mongoose.Types.ObjectId();
const CUSTOMER = new mongoose.Types.ObjectId();
const USER = new mongoose.Types.ObjectId();

const service = () => require('../services/customerAccount.service');

function mockBalance(t, rows = []) {
  let pipeline;
  t.mock.method(Statement, 'aggregate', (p) => {
    pipeline = p;
    return Promise.resolve(rows);
  });
  return () => pipeline;
}

// Balance is derived, so the tests must pin the number the customer is told they
// owe: charges add, payments subtract.
test('what the customer owes is charges less payments', async (t) => {
  mockBalance(t, [{ _id: CUSTOMER, balance: 7500, charges: 20000, payments: 12500, count: 4 }]);
  assert.equal(await service().balance(TENANT, CUSTOMER), 7500);
});

test('the balance query is scoped to the tenant and the customer', async (t) => {
  const seen = mockBalance(t, []);
  await service().balance(TENANT, CUSTOMER);
  const [match] = seen();
  assert.equal(String(match.$match.tenant), String(TENANT));
  assert.deepEqual(
    match.$match.customer.$in.map(String),
    [String(CUSTOMER)],
    'another tenant\'s statement must never contribute to this balance',
  );
});

test('voided entries are excluded from the balance', async (t) => {
  const seen = mockBalance(t, []);
  await service().balance(TENANT, CUSTOMER);
  const [match] = seen();
  assert.equal(match.$match.voided, false, 'a voided entry must not still be owed');
});

test('a customer with no statement owes nothing', async (t) => {
  mockBalance(t, []);
  assert.equal(await service().balance(TENANT, CUSTOMER), 0);
});

test('an unreadable customer id reads zero rather than querying', async (t) => {
  let called = false;
  t.mock.method(Statement, 'aggregate', () => { called = true; return Promise.resolve([]); });
  assert.equal(await service().balance(TENANT, 'not-an-id'), 0);
  assert.equal(called, false);
});

test('balances for a directory come back keyed by customer', async (t) => {
  const other = new mongoose.Types.ObjectId();
  mockBalance(t, [
    { _id: CUSTOMER, balance: 7500 },
    { _id: other, balance: 0 },
  ]);
  const map = await service().balances(TENANT, [String(CUSTOMER), String(other)]);
  assert.equal(map.get(String(CUSTOMER)), 7500);
  assert.equal(map.get(String(other)), 0, 'a customer with no rows is owed zero, not missing');
});

test('an empty customer list does not query at all', async (t) => {
  let called = false;
  t.mock.method(Statement, 'aggregate', () => { called = true; return Promise.resolve([]); });
  assert.equal((await service().balances(TENANT, [])).size, 0);
  assert.equal(called, false);
});

// ── Recording a charge ───────────────────────────────────────────────────────

function stubCustomer(t, creditLimit = 10000) {
  // Supports both findOne().lean() and findOne().session(s).lean(), which is how
  // the service reads a customer inside and outside a transaction.
  const chain = { lean: () => Promise.resolve({ _id: CUSTOMER, creditLimit }) };
  chain.session = () => chain;
  t.mock.method(POSCustomer, 'findOne', () => chain);
}

function stubCreate(t) {
  const created = [];
  t.mock.method(Statement, 'create', (docs) => {
    created.push(...docs); // create() is called with an array, to take a session
    return Promise.resolve(docs);
  });
  return created;
}

test('a charge is recorded with a positive amount, so direction comes from entryType', async (t) => {
  mockBalance(t, []);
  stubCustomer(t);
  const created = stubCreate(t);
  await service().recordCharge({
    tenantId: TENANT, customerId: CUSTOMER, amount: 1500, userId: USER, receiptNumber: 'RCP-1',
  });
  assert.equal(created.length, 1);
  assert.equal(created[0].entryType, 'charge');
  assert.equal(created[0].amount, 1500);
  assert.ok(created[0].amount > 0, 'a negative amount would flip the tab the wrong way');
});

test('a charge is refused once it would exceed the credit limit', async (t) => {
  mockBalance(t, [{ _id: CUSTOMER, balance: 9000 }]);
  stubCustomer(t, 10000);
  stubCreate(t);
  await assert.rejects(
    service().recordCharge({ tenantId: TENANT, customerId: CUSTOMER, amount: 2000, userId: USER }),
    (e) => {
      assert.match(e.message, /credit limit/i);
      // The message has to say by how much, or the cashier cannot sell anything.
      assert.match(e.message, /11,?000/);
      return true;
    },
  );
});

test('a charge within the limit is accepted even from an existing balance', async (t) => {
  mockBalance(t, [{ _id: CUSTOMER, balance: 6000 }]);
  stubCustomer(t, 10000);
  const created = stubCreate(t);
  await service().recordCharge({ tenantId: TENANT, customerId: CUSTOMER, amount: 3000, userId: USER });
  assert.equal(created.length, 1);
});

test('a manager override is accepted and records who authorised it and why', async (t) => {
  mockBalance(t, [{ _id: CUSTOMER, balance: 12000 }]);
  stubCustomer(t, 10000);
  const created = stubCreate(t);
  await service().recordCharge({
    tenantId: TENANT, customerId: CUSTOMER, amount: 500, userId: USER,
    allowOverride: true, overrideReason: 'Regular, settled last week',
  });
  assert.equal(created[0].overrideReason, 'Regular, settled last week');
  assert.equal(created[0].overrideBy, USER, 'an override nobody is accountable for is not an audit trail');
});

test('an override with no reason is refused', async (t) => {
  mockBalance(t, [{ _id: CUSTOMER, balance: 12000 }]);
  stubCustomer(t, 10000);
  stubCreate(t);
  await assert.rejects(
    service().recordCharge({
      tenantId: TENANT, customerId: CUSTOMER, amount: 500, userId: USER,
      allowOverride: true, overrideReason: '   ',
    }),
    /reason/i,
  );
});

test('a charge without a valid customer is refused', async (t) => {
  await assert.rejects(
    service().recordCharge({ tenantId: TENANT, customerId: 'nope', amount: 100, userId: USER }),
    /customer/i,
  );
});

test('a non-positive or non-finite charge is refused', async (t) => {
  await assert.rejects(
    service().recordCharge({ tenantId: TENANT, customerId: CUSTOMER, amount: 0, userId: USER }),
    /positive/,
  );
  await assert.rejects(
    service().recordCharge({ tenantId: TENANT, customerId: CUSTOMER, amount: NaN, userId: USER }),
    /finite/,
  );
});

test('a charge against a customer who does not exist in this tenant is refused', async (t) => {
  mockBalance(t, []);
  t.mock.method(POSCustomer, 'findOne', () => ({ lean: () => Promise.resolve(null) }));
  stubCreate(t);
  await assert.rejects(
    service().recordCharge({ tenantId: TENANT, customerId: CUSTOMER, amount: 100, userId: USER }),
    /Customer not found/,
  );
});

// ── Recording a payment ──────────────────────────────────────────────────────

test('a payment is recorded as a payment, not a negative charge', async (t) => {
  mockBalance(t, [{ _id: CUSTOMER, balance: 4000 }]);
  stubCustomer(t);
  const created = stubCreate(t);
  await service().recordPayment({
    tenantId: TENANT, customerId: CUSTOMER, amount: 2500, method: 'cash', userId: USER,
  });
  assert.equal(created[0].entryType, 'payment');
  assert.equal(created[0].amount, 2500);
  assert.equal(created[0].method, 'cash');
});

test('paying more than the customer owes is refused rather than creating a credit', async (t) => {
  // A negative tab would read as "the shop owes them", which is the opposite of
  // what happened. An overpayment belongs on the stored-value wallet.
  mockBalance(t, [{ _id: CUSTOMER, balance: 1000 }]);
  stubCustomer(t);
  stubCreate(t);
  await assert.rejects(
    service().recordPayment({ tenantId: TENANT, customerId: CUSTOMER, amount: 1500, userId: USER }),
    /owes/,
  );
});

test('paying exactly what is owed is allowed and leaves nothing owing', async (t) => {
  mockBalance(t, [{ _id: CUSTOMER, balance: 1000 }]);
  stubCustomer(t);
  const created = stubCreate(t);
  await service().recordPayment({ tenantId: TENANT, customerId: CUSTOMER, amount: 1000, userId: USER });
  assert.equal(created.length, 1);
});

test('a payment against a customer who owes nothing is refused', async (t) => {
  mockBalance(t, []);
  stubCustomer(t);
  stubCreate(t);
  await assert.rejects(
    service().recordPayment({ tenantId: TENANT, customerId: CUSTOMER, amount: 100, userId: USER }),
    /owes/,
  );
});

// ── Reading the statement ────────────────────────────────────────────────────

test('the statement pages newest first and reports its own total', async (t) => {
  const find = { sort: () => ({ limit: () => ({ skip: () => ({ exec: () => Promise.resolve([{ _id: 'x' }]) }) }) }) };
  let filter;
  t.mock.method(Statement, 'find', (f) => { filter = f; return find; });
  t.mock.method(Statement, 'countDocuments', () => Promise.resolve(41));

  const result = await service().listEntries(TENANT, CUSTOMER, { page: 2, limit: 20 });
  assert.equal(filter.tenant.toString(), TENANT.toString());
  assert.equal(result.total, 41);
  assert.equal(result.pages, 3);
  assert.equal(result.page, 2);
  assert.equal(result.data.length, 1);
});

test('the statement never reaches outside its tenant', async (t) => {
  let filter;
  t.mock.method(Statement, 'find', (f) => {
    filter = f;
    return { sort: () => ({ limit: () => ({ skip: () => ({ exec: () => Promise.resolve([]) }) }) }) };
  });
  t.mock.method(Statement, 'countDocuments', () => Promise.resolve(0));
  await service().listEntries(TENANT, CUSTOMER);
  assert.equal(filter.tenant.toString(), TENANT.toString());
  assert.notEqual(filter.tenant.toString(), OTHER_TENANT.toString());
});
// ── Taking a payment against the tab ─────────────────────────────────────────
// The two records must commit together. A journaled payment whose statement row
// never lands leaves a customer appearing to owe money they have handed over, and
// they will pay it twice.

function stubPayment(t) {
  const calls = [];
  const mod = { createPayment: (arg) => { calls.push(arg); return Promise.resolve({ _id: 'pay1', number: 'PAY-2026-abc' }); } };
  const session = { id: 'sess-1' };
  t.mock.method(mongoose.connection, 'transaction', (fn) => fn(session));
  // create(docs, { session }) — the session is the second argument.
  t.mock.method(Statement, 'create', (docs, opts) => {
    calls.push({ statement: docs, session: opts?.session });
    return Promise.resolve(docs);
  });
  return { calls, session };
}

test('taking a payment writes the ledger entry and the statement row in one transaction', async (t) => {
  const accountingPayment = require('../services/accountingPayment.service');
  mockBalance(t, [{ _id: CUSTOMER, balance: 5000 }]);
  stubCustomer(t);
  const { calls, session } = stubPayment(t);
  t.mock.method(accountingPayment, 'createPayment', (arg) => {
    calls.push({ payment: arg });
    return Promise.resolve({ _id: 'pay1', number: 'PAY-2026-abc' });
  });

  const payment = await service().takePayment({
    tenantId: TENANT, customerId: CUSTOMER, amount: 2000, method: 'cash', userId: USER,
  });

  const paymentCall = calls.find(c => c.payment);
  const statementCall = calls.find(c => c.statement);
  assert.ok(paymentCall && statementCall, 'both records are written');
  assert.equal(paymentCall.payment.session, session, 'the journal commit is the statement row\'s commit');
  assert.equal(statementCall.session, session);
  assert.equal(paymentCall.payment.direction, 'customer');
  assert.deepEqual(paymentCall.payment.data.allocations, [], 'a tab payment is not allocated to any invoice');
  assert.equal(paymentCall.payment.data.amount, 2000);
  assert.equal(statementCall.statement[0].entryType, 'payment');
  assert.equal(statementCall.statement[0].amount, 2000);
  // The statement row points back at the payment, so the two can be reconciled.
  assert.equal(statementCall.statement[0].reference, 'PAY-2026-abc');
  assert.equal(payment._id, 'pay1');
});

test('taking a payment is refused when it exceeds the balance, before anything is written', async (t) => {
  mockBalance(t, [{ _id: CUSTOMER, balance: 1000 }]);
  stubCustomer(t);
  let transacted = false;
  t.mock.method(mongoose.connection, 'transaction', (fn) => { transacted = true; return fn({}); });
  await assert.rejects(
    service().takePayment({ tenantId: TENANT, customerId: CUSTOMER, amount: 1001, userId: USER }),
    /owes/,
  );
  assert.equal(transacted, false, 'a refused payment must not open a transaction');
});

test('a tab cannot be repaid from the stored-value wallet', async (t) => {
  // createPayment refuses it, but the message there is about ledger mechanics and
  // would mean nothing to a cashier. Fail here with something actionable.
  mockBalance(t, [{ _id: CUSTOMER, balance: 5000 }]);
  stubCustomer(t);
  await assert.rejects(
    service().takePayment({
      tenantId: TENANT, customerId: CUSTOMER, amount: 1000, method: 'wallet', userId: USER,
    }),
    /store credit/i,
  );
});

// ── Reverting a charge ────────────────────────────────────────────────────────
// A tab charge must be reversible when the sale it came from is voided or
// refunded. The statement is append-only, so "reversing" means marking the rows
// voided — never deleting or rewriting them, which would take the audit trail
// with it.

test('voiding a receipt voids its charges only, leaving payments alone', async (t) => {
  let filter;
  t.mock.method(Statement, 'updateMany', (f) => { filter = f; return Promise.resolve({ modifiedCount: 1 }); });
  const res = await service().revertCharge(TENANT, 'RCPT-1', { userId: 'u1' });

  assert.equal(res.modifiedCount, 1);
  assert.equal(filter.voided, false, 'only rows not already reversed');
  assert.equal(filter.entryType, 'charge', 'a payment is money received, not a sale to undo');
  assert.equal(filter.receiptNumber, 'RCPT-1');
  assert.equal(String(filter.tenant), String(TENANT), "another tenant's charges must never be voided");
});

test('reverting the same receipt twice reports nothing the second time', async (t) => {
  // The `voided: false` in the filter is what makes a retried refund idempotent —
  // without it a replayed request would look successful while moving nothing.
  t.mock.method(Statement, 'updateMany', () => Promise.resolve({ modifiedCount: 0 }));
  const res = await service().revertCharge(TENANT, 'RCPT-1', { userId: 'u1' });
  assert.equal(res.modifiedCount, 0);
});

test('a reversed charge keeps its row and gains an audit trail', async (t) => {
  let update;
  t.mock.method(Statement, 'updateMany', (_f, u) => { update = u; return Promise.resolve({ modifiedCount: 1 }); });
  await service().revertCharge(TENANT, 'RCPT-1', { userId: 'u1' });
  assert.equal(update.$set.voided, true);
  assert.ok(update.$set.voidedAt instanceof Date, 'when it was reversed');
  assert.equal(update.$set.voidedBy, 'u1', 'who reversed it');
});

test('a reversed charge no longer counts toward what the customer owes', async (t) => {
  // The aggregation is the balance, so it has to exclude voided rows. If it did
  // not, a returned sale would keep the customer owing for goods they no longer
  // have.
  let pipeline;
  t.mock.method(Statement, 'aggregate', (p) => { pipeline = p; return Promise.resolve([]); });
  await service().balance(TENANT, CUSTOMER);
  assert.equal(pipeline[0].$match.voided, false);
});

test('reverting a receipt with no customer is refused', async (t) => {
  t.mock.method(Statement, 'updateMany', () => Promise.resolve({ modifiedCount: 0 }));
  await assert.rejects(() => service().revertCharge(TENANT, ''), /receipt/i);
});

// ── Credit entries (partial refund of a tab sale) ─────────────────────────────
// Refunding part of a sale that went on the tab reduces what the customer owes
// without any money moving — they never paid it. Neither existing entry type
// says that: a 'payment' would look like they handed over cash, and a voided
// 'charge' would pretend the whole sale came back. So a 'credit' entry lowers the
// balance on its own.

test('a credit lowers the balance without looking like a payment', async (t) => {
  let created;
  // create() takes a list — the single-row form returns the array.
  t.mock.method(Statement, 'create', (docs) => { created = docs[0]; return Promise.resolve(docs); });
  // The credit is checked against what is owed, so the balance read must be stubbed.
  t.mock.method(Statement, 'aggregate', () => Promise.resolve([
    { _id: CUSTOMER, balance: 5000, charges: 5000, payments: 0, credits: 0 },
  ]));
  stubCustomer(t);
  await service().creditStatement({
    tenantId: TENANT, customerId: CUSTOMER, amount: 500,
    userId: 'u1', receiptNumber: 'RCPT-1', method: 'refund',
  });
  assert.equal(created.entryType, 'credit');
  assert.equal(created.amount, 500);
  assert.equal(created.receiptNumber, 'RCPT-1', 'traced back to the sale being refunded');
  assert.equal(created.staff, 'u1');
});

test('the balance subtracts credits', async (t) => {
  let pipeline;
  t.mock.method(Statement, 'aggregate', (p) => { pipeline = p; return Promise.resolve([]); });
  await service().balance(TENANT, CUSTOMER);
  // Asserted on the accumulator rather than on a `$match` entryType filter: a
  // filter would silently ignore any entry type added later, which is how a new
  // kind of movement ends up quietly not counting towards the balance.
  assert.deepEqual(
    pipeline[1].$group.credits.$sum,
    { $cond: [{ $eq: ['$entryType', 'credit'] }, '$amount', 0] },
  );
  assert.deepEqual(pipeline[2].$project.balance, {
    $round: [{ $subtract: [{ $subtract: ['$charges', '$payments'] }, '$credits'] }, 2],
  });
});

test('the tab directory also subtracts credits', async (t) => {
  let pipeline;
  t.mock.method(Statement, 'aggregate', (p) => { pipeline = p; return Promise.resolve([]); });
  await service().tabBalances(TENANT);
  // In $group, $sum takes one expression, not an array of expressions.
  assert.deepEqual(
    pipeline[1].$group.credits.$sum,
    { $cond: [{ $eq: ['$entryType', 'credit'] }, '$amount', 0] },
  );
  assert.ok(pipeline[2].$project.balance, 'credits must reach the projected balance');
});

for (const method of ['balances', 'tabBalances']) {
  test(`${method} emits valid conditional charge and payment accumulators`, async (t) => {
    const seen = mockBalance(t);
    await service()[method](TENANT, ...(method === 'balances' ? [[CUSTOMER]] : []));
    const group = seen()[1].$group;
    assert.deepEqual(group.charges.$sum, {
      $cond: [{ $eq: ['$entryType', 'charge'] }, '$amount', 0],
    });
    assert.deepEqual(group.payments.$sum, {
      $cond: [{ $eq: ['$entryType', 'payment'] }, '$amount', 0],
    });
  });
}

test('a credit larger than the outstanding balance is refused', async (t) => {
  // Otherwise a mistyped refund creates a negative tab, which reads as the shop
  // owing the customer and would be counted as a payable.
  t.mock.method(Statement, 'aggregate', () => Promise.resolve([
    { _id: CUSTOMER, balance: 100, charges: 100, payments: 0, credits: 0 },
  ]));
  t.mock.method(Statement, 'create', () => Promise.resolve([]));
  stubCustomer(t);
  await assert.rejects(
    () => service().creditStatement({ tenantId: TENANT, customerId: CUSTOMER, amount: 9999 }),
    /less than/,
  );
});

test('a credit of zero or a negative amount is refused', async (t) => {
  // Refused before any read — the amount is nonsense regardless of the balance.
  t.mock.method(Statement, 'create', () => Promise.resolve([]));
  for (const amount of [0, -50]) {
    await assert.rejects(
      () => service().creditStatement({ tenantId: TENANT, customerId: CUSTOMER, amount }),
      /positive/,
    );
  }
});
