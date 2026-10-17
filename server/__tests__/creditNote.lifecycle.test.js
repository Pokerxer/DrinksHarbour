// __tests__/creditNote.lifecycle.test.js
//
// The credit note lifecycle, against the real service with the journal stubbed
// so GL-post counts are assertable. Two invariants dominate every test here:
//
//   - POSTING a note moves the GL exactly once, for the FULL note total.
//   - APPLYING credit never touches the GL at all.
//
// Together those are what keep the receivable control account and the sum of
// open invoices in agreement. The original code had no apply path at all, so a
// standalone credit was stranded: in the GL, invisible to every balance.
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const CreditNote = require('../models/CreditNote');
const SalesOrder = require('../models/SalesOrder');
const JournalEntry = require('../models/JournalEntry');
const Counter = require('../models/Counter');
const POSCustomer = require('../models/POSCustomer');
const journal = require('../services/journalEntry.service');
const coa = require('../services/chartOfAccounts.service');

const session = {};
const oid = () => new mongoose.Types.ObjectId();

// Real ObjectIds, because the service guards on `mongoose.isValidObjectId` and
// mongoose casts query values — string ids like 'so1' fail both.
const TENANT = oid();
const CUSTOMER = oid();
const INVOICE = oid();
const USER = oid();

const saveable = (doc) => ({ ...doc, save: async function () { doc.saved = true; } });
const query = (doc) => ({ session: async () => doc });

/**
 * @param order  the SalesOrder fixture, or null for "not in this tenant"
 * @param notes  notes returned by CreditNote.find (used by applyCredit)
 */
function setup(t, { note, order = null, notes = [], journalEntry = { _id: 'j1' }, customer = true } = {}) {
  t.mock.method(mongoose.connection, 'transaction', async (fn) => fn(session));
  t.mock.method(coa, 'ensureDefaultCOA', async () => {});
  t.mock.method(Counter, 'findOneAndUpdate', async () => ({ seq: 1 }));

  const post = t.mock.method(journal, 'postJournalEntry', async () => ({ _id: 'j' }));
  const reverse = t.mock.method(journal, 'reverseEntry', async () => {});

  let noteFilter;
  let orderFilter;
  // Honours a status filter, so "posting an already-posted note" is genuinely
  // refused by the service rather than the mock handing back a draft regardless.
  t.mock.method(CreditNote, 'findOne', (filter) => {
    noteFilter = filter;
    const match = !filter.status || (note && note.status === filter.status);
    return query(match ? note : null);
  });
  t.mock.method(CreditNote, 'create', async (docs) => docs.map(saveable));
  t.mock.method(CreditNote, 'find', () => ({
    sort: () => ({ session: async () => notes }),
  }));
  t.mock.method(SalesOrder, 'findOne', (filter) => {
    orderFilter = filter;
    return query(order);
  });
  // Unmocked, this reaches for a real connection and times out after 10s.
  t.mock.method(POSCustomer, 'findOne', () => query(customer ? { _id: CUSTOMER } : null));
  t.mock.method(require('../models/Order'), 'exists', () => query(false));
  t.mock.method(JournalEntry, 'findOne', () => query(journalEntry));

  return {
    post,
    reverse,
    noteFilter: () => noteFilter,
    orderFilter: () => orderFilter,
  };
}

const service = () => require('../services/creditNote.service');

const draft = (over = {}) => saveable({
  _id: 'cn1',
  tenant: TENANT,
  customer: CUSTOMER,
  salesOrder: null,
  date: new Date('2026-08-01T00:00:00Z'),
  amount: 100000,
  taxAmount: 7500,
  status: 'draft',
  unappliedAmount: 0,
  allocations: [],
  ...over,
});

const order = (over = {}) => saveable({
  _id: INVOICE,
  tenant: TENANT,
  soNumber: 'INV-001',
  total: 107500,
  amountPaid: 0,
  creditedAmount: 0,
  currency: 'NGN',
  ...over,
});

// ── drafting ────────────────────────────────────────────────────────────────

test('creating a credit note drafts it and posts nothing to the GL', async (t) => {
  const state = setup(t, {});
  const cn = await service().createCreditNote({
    tenantId: TENANT,
    data: { customer: CUSTOMER, amount: 100000, taxAmount: 7500 },
    userId: USER,
  });
  assert.equal(cn.status, 'draft');
  assert.equal(cn.unappliedAmount, 0);
  assert.equal(cn.number, undefined, 'a draft must not consume a sequence number');
  assert.equal(state.post.mock.callCount(), 0);
});

test('a draft does not touch the invoice it names', async (t) => {
  const state = setup(t, { order: order() });
  const cn = await service().createCreditNote({
    tenantId: TENANT,
    data: { salesOrder: INVOICE, amount: 100000, taxAmount: 7500 },
    userId: USER,
  });
  assert.equal(cn.status, 'draft');
  assert.equal(String(state.orderFilter().tenant), String(TENANT), 'the invoice is scoped to the tenant');
  assert.equal(state.post.mock.callCount(), 0);
});

test('a credit with no invoice must name a real customer in the tenant', async (t) => {
  // Otherwise its unapplied amount belongs to an account nothing can ever reach,
  // which is the stranded-credit defect in miniature.
  setup(t, {});
  await assert.rejects(
    service().createCreditNote({
      tenantId: TENANT,
      data: { customerName: 'Walk-in Trader', amount: 50000 },
      userId: USER,
    }),
    /Customer is required for an unapplied credit/,
  );
});

test('an invoice customer with no customer record can still be credited', async (t) => {
  // Older orders carry a customer snapshot with no POSCustomer row. Requiring a
  // customer record here would make those invoices uncreditable — which is the
  // defect this change set exists to remove.
  setup(t, { order: order({ customer: CUSTOMER }), customer: false });
  const cn = await service().createCreditNote({
    tenantId: TENANT,
    data: { salesOrder: INVOICE, amount: 100000, taxAmount: 7500 },
    userId: USER,
  });
  assert.equal(cn.status, 'draft');
});

test('a customer that does not exist in this tenant is refused', async (t) => {
  setup(t, { customer: false });
  await assert.rejects(
    service().createCreditNote({
      tenantId: TENANT,
      data: { customer: CUSTOMER, amount: 50000 },
      userId: USER,
    }),
    /Customer not found/,
  );
});

test('a credit rejects non-positive and non-finite amounts', async (t) => {
  setup(t, {});
  for (const bad of [{ amount: 0 }, { amount: -5 }, { amount: 'abc' }]) {
    await assert.rejects(
      service().createCreditNote({ tenantId: TENANT, data: { customer: CUSTOMER, ...bad }, userId: USER }),
      /finite and non-negative/,
    );
  }
});

// ── posting ─────────────────────────────────────────────────────────────────

test('posting a note writes exactly one GL entry for the full note total', async (t) => {
  const state = setup(t, { note: draft() });
  await service().postCreditNote({ tenantId: TENANT, id: 'cn1', userId: USER });
  assert.equal(state.post.mock.callCount(), 1);
  const { lines } = state.post.mock.calls[0].arguments[0];
  const debits = lines.reduce((s, l) => s + l.debit, 0);
  const credits = lines.reduce((s, l) => s + l.credit, 0);
  assert.equal(debits, 107500);
  assert.equal(credits, 107500, 'the entry must balance');
});

test('posting gives the note a sequential number and a post time', async (t) => {
  setup(t, { note: draft() });
  const cn = await service().postCreditNote({ tenantId: TENANT, id: 'cn1', userId: USER });
  assert.equal(cn.status, 'applied');
  assert.equal(cn.number, 'CN-2026-000001');
  assert.ok(cn.postedAt);
});

test('posting against an unpaid invoice reduces it and leaves nothing unapplied', async (t) => {
  const so = order();
  setup(t, { note: draft({ salesOrder: INVOICE }), order: so });
  const cn = await service().postCreditNote({ tenantId: TENANT, id: 'cn1', userId: USER });
  assert.equal(so.creditedAmount, 107500);
  assert.equal(cn.unappliedAmount, 0);
  assert.equal(cn.allocations.length, 1);
  assert.equal(cn.allocations[0].amount, 107500);
});

test('credit beyond the invoice becomes unapplied credit on the account', async (t) => {
  const so = order({ total: 20000, amountPaid: 0, creditedAmount: 0 });
  setup(t, { note: draft({ salesOrder: INVOICE }), order: so });
  const cn = await service().postCreditNote({ tenantId: TENANT, id: 'cn1', userId: USER });
  assert.equal(so.creditedAmount, 20000, 'the invoice absorbs only what it owes');
  assert.equal(cn.unappliedAmount, 87500);
});

test('a credit on a fully paid invoice is accepted and held as unapplied credit', async (t) => {
  // Previously impossible: outstanding was 0, so the guard rejected every
  // amount including one naira.
  const so = order({ total: 107500, amountPaid: 107500, creditedAmount: 0, orderStatus: 'fulfilled' });
  const state = setup(t, { note: draft({ salesOrder: INVOICE }), order: so });
  const cn = await service().postCreditNote({ tenantId: TENANT, id: 'cn1', userId: USER });
  assert.equal(so.creditedAmount, 0, 'a settled invoice is not re-opened');
  assert.equal(cn.unappliedAmount, 107500);
  assert.equal(state.post.mock.callCount(), 1, 'the GL still records the credit');
});

test('posting a note with no invoice is wholly unapplied credit', async (t) => {
  setup(t, { note: draft() });
  const cn = await service().postCreditNote({ tenantId: TENANT, id: 'cn1', userId: USER });
  assert.equal(cn.unappliedAmount, 107500);
  assert.equal(cn.allocations.length, 0);
});

test('a note that is not a draft cannot be posted twice', async (t) => {
  const state = setup(t, { note: draft({ status: 'applied' }) });
  await assert.rejects(
    service().postCreditNote({ tenantId: TENANT, id: 'cn1', userId: USER }),
    /Only draft credit notes can be posted/,
  );
  assert.equal(state.post.mock.callCount(), 0, 'a second post must not post again');
});

test('posting refuses an invoice outside the tenant', async (t) => {
  const state = setup(t, { note: draft({ salesOrder: INVOICE }), order: null });
  await assert.rejects(
    service().postCreditNote({ tenantId: TENANT, id: 'cn1', userId: USER }),
    /Invoice not found/,
  );
  assert.equal(state.post.mock.callCount(), 0);
});

// ── applying ────────────────────────────────────────────────────────────────

const liveNote = (id, unappliedAmount, extra = {}) =>
  saveable({ _id: id, unappliedAmount, allocations: [], ...extra });

test('applying credit reduces the invoice without touching the GL', async (t) => {
  const so = order({ total: 50000, amountPaid: 0, creditedAmount: 0 });
  const state = setup(t, { order: so, notes: [liveNote('n1', 80000)] });
  const out = await service().applyCredit({
    tenantId: TENANT, customer: CUSTOMER, salesOrder: INVOICE, userId: USER,
  });
  assert.equal(out.applied, 50000);
  assert.equal(so.creditedAmount, 50000);
  assert.equal(state.post.mock.callCount(), 0, 'apply is a sub-ledger move, never a GL entry');
});

test('applying consumes the oldest credit first', async (t) => {
  const so = order({ total: 60000, amountPaid: 0, creditedAmount: 0 });
  const old = liveNote('old', 20000);
  const recent = liveNote('recent', 50000);
  setup(t, { order: so, notes: [old, recent] });
  const out = await service().applyCredit({
    tenantId: TENANT, customer: CUSTOMER, salesOrder: INVOICE, userId: USER,
  });
  assert.equal(out.applied, 60000);
  assert.equal(old.unappliedAmount, 0);
  assert.equal(recent.unappliedAmount, 10000);
});

test('applying more than the account holds is refused', async (t) => {
  const state = setup(t, { order: order({ total: 100000 }), notes: [liveNote('n1', 5000)] });
  await assert.rejects(
    service().applyCredit({
      tenantId: TENANT, customer: CUSTOMER, salesOrder: INVOICE, amount: 9000, userId: USER,
    }),
    /Exceeds available credit/,
  );
  assert.equal(state.post.mock.callCount(), 0);
});

test('applying to a settled invoice is refused', async (t) => {
  setup(t, {
    order: order({ total: 1000, amountPaid: 1000, creditedAmount: 0 }),
    notes: [liveNote('n1', 50000)],
  });
  await assert.rejects(
    service().applyCredit({ tenantId: TENANT, customer: CUSTOMER, salesOrder: INVOICE, userId: USER }),
    /no outstanding balance/,
  );
});

// ── cancelling ──────────────────────────────────────────────────────────────

test('cancelling a draft touches neither the GL nor any invoice', async (t) => {
  const state = setup(t, { note: draft({ status: 'draft' }) });
  const cn = await service().cancelCreditNote({ tenantId: TENANT, id: 'cn1', userId: USER });
  assert.equal(cn.status, 'cancelled');
  assert.equal(state.post.mock.callCount(), 0);
  assert.equal(state.reverse.mock.callCount(), 0);
});

test('cancelling a posted note reverses the GL once and restores the invoice', async (t) => {
  // Still owing before the cancel, so giving back the credit is legitimate: the
  // invoice simply becomes outstanding again by the amount of credit removed.
  const so = order({ total: 200000, amountPaid: 100000, creditedAmount: 50000 });
  const cn = draft({
    status: 'applied',
    unappliedAmount: 0,
    allocations: [{ salesOrder: INVOICE, amount: 50000 }],
  });
  const state = setup(t, { note: cn, order: so });
  const out = await service().cancelCreditNote({ tenantId: TENANT, id: 'cn1', userId: USER });
  assert.equal(so.creditedAmount, 0, 'the invoice credit is given back');
  assert.equal(out.status, 'cancelled');
  assert.equal(out.unappliedAmount, 0, 'the GL reversal removed the credit');
  assert.equal(state.reverse.mock.callCount(), 1);
});

test('cancelling is refused once the credited invoice has been paid', async (t) => {
  // Cash 57,500 plus a 50,000 credit settled the 107,500 invoice. Removing the
  // credit re-opens money that was actually received.
  const so = order({ total: 107500, amountPaid: 57500, creditedAmount: 50000 });
  const cn = draft({
    status: 'applied',
    allocations: [{ salesOrder: INVOICE, amount: 50000 }],
  });
  const state = setup(t, { note: cn, order: so });
  await assert.rejects(
    service().cancelCreditNote({ tenantId: TENANT, id: 'cn1', userId: USER }),
    /has since been paid/,
  );
  assert.equal(state.reverse.mock.callCount(), 0, 'a refusal must not reverse anything');
  assert.equal(so.creditedAmount, 50000, 'a refusal must not mutate the invoice');
});

test('an already cancelled note cannot be cancelled again', async (t) => {
  const state = setup(t, { note: draft({ status: 'cancelled' }) });
  await assert.rejects(
    service().cancelCreditNote({ tenantId: TENANT, id: 'cn1', userId: USER }),
    /already cancelled/,
  );
  assert.equal(state.reverse.mock.callCount(), 0);
});

test('cancelling is refused when the note journal is missing', async (t) => {
  const state = setup(t, { note: draft({ status: 'applied', allocations: [] }), journalEntry: null });
  await assert.rejects(
    service().cancelCreditNote({ tenantId: TENANT, id: 'cn1', userId: USER }),
    /journal is missing/,
  );
  assert.equal(state.reverse.mock.callCount(), 0);
});