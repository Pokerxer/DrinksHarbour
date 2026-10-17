// services/customerAccount.service.js
//
// What a customer owes on their account ("tab"), derived from an append-only
// ledger of charges and payments.
//
// The balance is an aggregate, never a stored number. Two consequences worth
// keeping in mind while reading this:
//
//  * A running balance written at charge time would be wrong whenever two sales
//    are rung at once, and the row an operator reads to decide whether a
//    customer may buy is exactly the row that would be wrong.
//  * Nothing here touches the general ledger. A charge is already booked by the
//    POS order journal (Dr Receivables 1300); a payment is already booked by a
//    CustomerPayment (Dr Cash / Cr Receivables 1300). These rows are the
//    customer-facing view of those two events, and posting a third time would
//    credit the same receivable again.

const mongoose = require('mongoose');
const Statement = require('../models/CustomerAccountStatement');
const POSCustomer = require('../models/POSCustomer');
const accountingPayment = require('./accountingPayment.service');
const { bad } = require('./accounting.query');
const { round2 } = require('./accounting.helpers');

// $group accumulators accept a single expression, not an argument array.
const CHARGES = { $cond: [{ $eq: ['$entryType', 'charge'] }, '$amount', 0] };
const PAYMENTS = { $cond: [{ $eq: ['$entryType', 'payment'] }, '$amount', 0] };
// Lowers the balance with no money moving. Exists for the partial refund of a
// sale that went on the tab: the customer never paid that part, so it is neither
// a payment (they handed nothing over) nor a voided charge (the rest of the sale
// stands).
const CREDITS = { $cond: [{ $eq: ['$entryType', 'credit'] }, '$amount', 0] };

/**
 * Balances for a set of customers in one query. A directory page calls this once
 * rather than per row.
 * @returns {Map<string, number>} keyed by customer id string
 */
async function balances(tenantId, customerIds = [], { session } = {}) {
  const ids = (customerIds || [])
    .filter(id => mongoose.isValidObjectId(String(id)))
    .map(id => new mongoose.Types.ObjectId(String(id)));
  if (!ids.length) return new Map();

  const rows = await Statement.aggregate(
    [
      { $match: { tenant: new mongoose.Types.ObjectId(String(tenantId)), customer: { $in: ids }, voided: false } },
      {
        $group: {
          _id: '$customer',
          charges: { $sum: CHARGES },
          payments: { $sum: PAYMENTS },
          credits: { $sum: CREDITS },
          entries: { $sum: 1 },
          lastActivityAt: { $max: '$occurredAt' },
        },
      },
      {
        $project: {
          charges: 1,
          payments: 1,
          credits: 1,
          entries: 1,
          lastActivityAt: 1,
          // Round in the database so a value computed from kobo-level sums cannot
          // arrive as 0.30000000000000004 and be compared against a limit.
          balance: { $round: [{ $subtract: [{ $subtract: ['$charges', '$payments'] }, '$credits'] }, 2] },
        },
      },
    ],
    { session },
  );

  const map = new Map();
  for (const id of ids) map.set(String(id), 0); // owed nothing, not "unknown"
  for (const row of rows) map.set(String(row._id), round2(row.balance));
  return map;
}

/**
 * Every customer in the tenant carrying a tab, for the AR directory and summary.
 *
 * Only genuinely positive balances come back. A customer who settled up exactly
 * is not a receivable, and a negative one is data corruption rather than a credit
 * the shop owes — recordPayment refuses to create one in the first place.
 */
async function tabBalances(tenantId, { session } = {}) {
  const rows = await Statement.aggregate(
    [
      { $match: { tenant: new mongoose.Types.ObjectId(String(tenantId)), voided: false } },
      {
        $group: {
          _id: '$customer',
          charges: { $sum: CHARGES },
          payments: { $sum: PAYMENTS },
          credits: { $sum: CREDITS },
        },
      },
      {
        $project: {
          balance: {
            $round: [{ $subtract: [{ $subtract: ['$charges', '$payments'] }, '$credits'] }, 2],
          },
        },
      },
      { $match: { balance: { $gt: 0 } } },
    ],
    { session },
  );
  // The pipeline's $gt: 0 keeps zero-balance customers off the wire, which is the
  // efficient filter. Repeating the check here is what makes the function's promise
  // — "customers carrying a tab" — true of its result rather than of its query.
  return rows
    .map(row => ({ customerId: row._id, balance: round2(row.balance) }))
    .filter(row => row.balance > 0);
}

/** What one customer owes. */
async function balance(tenantId, customerId, { session } = {}) {
  if (!mongoose.isValidObjectId(String(customerId || ''))) return 0;
  const map = await balances(tenantId, [customerId], { session });
  return map.get(String(customerId)) ?? 0;
}

function assertAmount(amount, label) {
  const n = Number(amount);
  if (!Number.isFinite(n)) throw bad(`${label} must be finite`);
  if (n <= 0) throw bad(`${label} must be positive`);
  return round2(n);
}

async function requireCustomer(tenantId, customerId, { session } = {}) {
  if (!mongoose.isValidObjectId(String(customerId || ''))) throw bad('A valid customer is required');
  const query = POSCustomer.findOne({ _id: customerId, tenant: tenantId });
  if (session) query.session(session);
  const customer = await query.lean();
  if (!customer) throw bad('Customer not found in this tenant');
  return customer;
}

/**
 * Record what a customer bought on account.
 *
 * The credit limit is enforced HERE rather than in the caller, because the caller
 * is not the only path a sale can take and a limit that some routes skip is not a
 * limit. It is checked against the balance the customer will owe AFTER this
 * charge — the limit is on the total owed, so standing debt counts.
 */
async function recordCharge({
  tenantId, customerId, amount, userId,
  receiptNumber, reference, method, posSessionId, note,
  allowOverride = false, overrideReason, occurredAt, session,
}) {
  const value = assertAmount(amount, 'Charge amount');
  const customer = await requireCustomer(tenantId, customerId, { session });
  const owed = await balance(tenantId, customerId, { session });
  const limit = Math.max(0, Number(customer.creditLimit) || 0);
  const wouldOwe = round2(owed + value);

  if (wouldOwe > limit) {
    if (!allowOverride) {
      // State the shortfall, not just the refusal: a cashier who cannot fix it
      // needs to tell the customer something better than "no".
      throw bad(
        `This sale would put ${customer.firstName || 'the customer'} ${Math.round(wouldOwe).toLocaleString()} over a credit limit of ${Math.round(limit).toLocaleString()}. A manager can authorise it.`
      );
    }
    // An override with no reason is not an audit trail, so it is not accepted.
    if (!String(overrideReason || '').trim()) throw bad('An override reason is required');
  }

  return Statement.create(
    [{
      tenant: tenantId,
      customer: customerId,
      entryType: 'charge',
      amount: value,
      method: method || 'account',
      reference,
      receiptNumber,
      posSessionId,
      staff: userId,
      note,
      // Recorded only when actually needed, so a normal sale is not made to look
      // like an exception in the history.
      overrideBy: wouldOwe > limit && allowOverride ? userId : undefined,
      overrideReason: wouldOwe > limit && allowOverride ? String(overrideReason).trim() : undefined,
      occurredAt: occurredAt || new Date(),
    }],
    { session },
  ).then(([doc]) => doc);
}

/**
 * Record money received against the tab.
 *
 * Refuses to overpay. A negative tab would read as "the shop owes this customer",
 * which is the opposite of what happened; an overpayment belongs on the stored
 * value wallet, where the customer can actually spend it.
 */
async function recordPayment({
  tenantId, customerId, amount, method = 'cash', userId, reference, note, occurredAt, session,
}) {
  const value = assertAmount(amount, 'Payment amount');
  await requireCustomer(tenantId, customerId, { session });
  const owed = await balance(tenantId, customerId, { session });
  if (value > owed) {
    throw bad(`This customer owes ${Math.round(owed).toLocaleString()}, which is less than the payment`);
  }

  return Statement.create(
    [{
      tenant: tenantId,
      customer: customerId,
      entryType: 'payment',
      amount: value,
      method,
      reference,
      staff: userId,
      note,
      occurredAt: occurredAt || new Date(),
    }],
    { session },
  ).then(([doc]) => doc);
}

/**
 * Take money against the tab.
 *
 * The payment is an ordinary unallocated CustomerPayment (Dr Cash / Cr Receivables
 * 1300) and the statement row is written in the SAME transaction. That pairing is
 * the whole point: a journaled payment with no statement row leaves the customer
 * looking like they still owe money they have handed over, and they pay twice.
 *
 * Refuses to overpay — see recordPayment.
 */
async function takePayment({ tenantId, customerId, amount, method = 'cash', userId, reference, note, date }) {
  const value = assertAmount(amount, 'Payment amount');
  // Settling a tab out of store credit is a wallet movement, and the wallet has
  // its own guarded path. Saying so here beats createPayment's ledger-mechanics
  // message, which means nothing to a cashier.
  if (method === 'wallet') throw bad('A tab cannot be paid from store credit — top up the wallet or take cash');

  // Checked before the transaction opens: a refused payment must not commit
  // anything, and a failed balance read inside the transaction would roll back
  // for the wrong reason.
  await requireCustomer(tenantId, customerId);
  const owed = await balance(tenantId, customerId);
  if (value > owed) {
    throw bad(`This customer owes ${Math.round(owed).toLocaleString()}, which is less than the payment`);
  }

  return mongoose.connection.transaction(async session => {
    const payment = await accountingPayment.createPayment({
      tenantId,
      direction: 'customer',
      userId,
      session,
      data: { customer: customerId, amount: value, method, reference, date, allocations: [] },
    });
    await recordPayment({
      tenantId,
      customerId,
      amount: value,
      method,
      userId,
      // The payment number, not whatever the caller passed: it is what makes this
      // row traceable back to the journal entry when the two are reconciled.
      reference: payment.number,
      note,
      occurredAt: payment.date || new Date(),
      session,
    });
    return payment;
  });
}

/**
 * Lower what a customer owes without any money moving.
 *
 * Written for the partial refund of a sale that went on the tab. A 'payment' row
 * would be wrong — it would look like the customer handed over cash that never
 * arrived — and voiding the charge would be wrong too, because the rest of the
 * sale still stands.
 *
 * Refuses a credit larger than the balance. A negative tab reads as the shop
 * owing the customer, and would be folded into the AR directory as a receivable.
 */
async function creditStatement({
  tenantId, customerId, amount, userId = null, method = 'refund',
  receiptNumber, reference, note, occurredAt, session,
}) {
  const value = assertAmount(amount, 'Credit amount');
  await requireCustomer(tenantId, customerId);

  const owed = await balance(tenantId, customerId, { session });
  if (value > owed) {
    throw bad(`This customer owes ${round2(owed).toLocaleString()}, which is less than the credit`);
  }

  return Statement.create(
    [{
      tenant: new mongoose.Types.ObjectId(String(tenantId)),
      customer: new mongoose.Types.ObjectId(String(customerId)),
      entryType: 'credit',
      amount: value,
      method,
      receiptNumber,
      reference,
      note,
      occurredAt: occurredAt || new Date(),
      staff: userId,
    }],
    { session },
  ).then(rows => rows[0]);
}

/**
 * Reverse the tab charge(s) a receipt created, when that sale is voided or
 * refunded.
 *
 * The statement is append-only, so this MARKS rows voided rather than deleting
 * or rewriting them — the charge and its reversal both stay readable, which is
 * what an auditor needs and what a `deleteOne` would destroy.
 *
 * Idempotent by construction: the filter carries `voided: false`, so a retried
 * refund reports `modifiedCount: 0` instead of appearing to succeed twice.
 * Payments are never touched — a payment is money received, not a sale to undo.
 */
async function revertCharge(tenantId, receiptNumber, { userId = null } = {}) {
  if (!receiptNumber) throw bad('A receipt number is required to reverse a charge');
  const result = await Statement.updateMany(
    {
      tenant: new mongoose.Types.ObjectId(String(tenantId)),
      receiptNumber: String(receiptNumber),
      entryType: 'charge',
      voided: false,
    },
    { $set: { voided: true, voidedAt: new Date(), voidedBy: userId } },
  );
  if (mongoose.connection.readyState === 1 && result?.modifiedCount) {
    const rows = await Statement.find({ tenant: tenantId, receiptNumber: String(receiptNumber), entryType: 'charge' }).select('tenant customer').lean();
    for (const row of rows) {
      try { await require('./customerInvoice/hooks').customerLedgerSaved(row); }
      catch (err) { console.error('invoiceVoidSyncFailed', { message: err.message }); }
    }
  }
  return { modifiedCount: result?.modifiedCount ?? 0 };
}

/**
 * How much of a receipt's tab charge has already been given back, as refund
 * credits. A refund path needs this to credit only the increment: recomputing
 * `min(refund, charge)` per refund would hand back the full tab charge twice on
 * two partial refunds of one sale.
 */
async function creditedForReceipt(tenantId, receiptNumber, { session } = {}) {
  if (!receiptNumber) return 0;
  const rows = await Statement.aggregate(
    [
      {
        $match: {
          tenant: new mongoose.Types.ObjectId(String(tenantId)),
          receiptNumber: String(receiptNumber),
          entryType: 'credit',
          voided: false,
        },
      },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ],
    { session },
  );
  return round2(rows[0]?.total || 0);
}

/** Newest-first statement for one customer. */
async function listEntries(tenantId, customerId, { page = 1, limit = 25 } = {}) {
  if (!mongoose.isValidObjectId(String(customerId || ''))) throw bad('A valid customer is required');
  const perPage = Math.min(Math.max(parseInt(limit, 10) || 25, 1), 100);
  const current = Math.max(parseInt(page, 10) || 1, 1);
  const filter = { tenant: tenantId, customer: customerId };

  const [data, total] = await Promise.all([
    Statement.find(filter).sort({ occurredAt: -1, _id: -1 }).limit(perPage).skip((current - 1) * perPage).exec(),
    Statement.countDocuments(filter),
  ]);
  return { data, total, page: current, limit: perPage, pages: Math.ceil(total / perPage) || 1 };
}

/** Balance plus limit in one read, for the customer panel. */
async function account(tenantId, customerId) {
  const customer = await requireCustomer(tenantId, customerId);
  const [owed, statement] = await Promise.all([
    balance(tenantId, customerId),
    listEntries(tenantId, customerId, { limit: 25 }),
  ]);
  return {
    customer: customerId,
    balance: owed,
    creditLimit: Math.max(0, Number(customer.creditLimit) || 0),
    availableCredit: Math.max(0, round2((Number(customer.creditLimit) || 0) - owed)),
    entries: statement.data,
    pagination: { page: statement.page, limit: statement.limit, total: statement.total, pages: statement.pages },
  };
}

module.exports = {
  balance, balances, tabBalances, recordCharge, revertCharge, creditStatement,
  creditedForReceipt,
  recordPayment, takePayment,
  listEntries, account,
};
