// services/creditNote.service.js
//
// AR customer credit: draft → post → (apply to invoices) → cancel.
//
// ── The two invariants ──────────────────────────────────────────────────────
//
//   1. POSTING moves the GL exactly once, for the FULL note total
//      (Dr Sales Revenue + Dr Tax Collected, Cr Receivables). The amount that
//      lands on an invoice and the amount held as account credit are a
//      SUB-LEDGER question and never change what the GL says.
//
//   2. APPLYING credit never touches the GL. The receivable was already
//      credited at post time; applying only records which invoice the credit
//      settled. Crediting the receivable again here would silently overstate
//      every customer's credit and leave the control account disagreeing with
//      the sum of open invoices.
//
// Everything below is bookkeeping in service of those two rules.
//
// ── Why unapplied credit exists ─────────────────────────────────────────────
//
// A credit may exceed what an invoice owes, or name no invoice at all. Before
// this module tracked `unappliedAmount`, that portion was credited in the GL and
// visible nowhere else: not in the customer balance, not in ageing, and with no
// way to spend it. This is the defect the ledger now closes.

const mongoose = require('mongoose');
const CreditNote = require('../models/CreditNote');
const SalesOrder = require('../models/SalesOrder');
const POSCustomer = require('../models/POSCustomer');
const JournalEntry = require('../models/JournalEntry');
const journalService = require('./journalEntry.service');
const { ensureDefaultCOA } = require('./chartOfAccounts.service');
const { round2 } = require('./accounting.helpers');
const { CODE } = require('./accounting.posting');
const { bad, dateRange } = require('./accounting.query');
const { nextNumber } = require('./creditNote.numbering');
const {
  noteTotal,
  invoiceOutstanding,
  planAllocation,
  planApplication,
  deallocationCheck,
} = require('./creditNote.alloc');

/** Order states a credit may reference. */
const CREDITABLE_ORDER_STATES = ['confirmed', 'partially_fulfilled', 'fulfilled'];

/**
 * Lines for the single GL entry a posted note produces. Always the full note
 * total, regardless of how the note is later allocated.
 */
function buildLines(cn) {
  const total = noteTotal(cn);
  return [
    { account: CODE.SALES_REVENUE, debit: round2(cn.amount), credit: 0, memo: cn.reason || 'Credit note' },
    { account: CODE.TAX_COLLECTED, debit: round2(cn.taxAmount), credit: 0, memo: 'Output VAT adjustment' },
    { account: CODE.RECEIVABLES, debit: 0, credit: total, memo: cn.customerName || 'Customer credit' },
  ];
}

function validateAmounts({ amount, taxAmount }) {
  if (
    !Number.isFinite(Number(amount)) ||
    round2(amount) <= 0 ||
    !Number.isFinite(Number(taxAmount || 0)) ||
    round2(taxAmount) < 0
  ) {
    throw bad('Credit amounts must be finite and non-negative');
  }
}

function assertInvoiceUsable(so) {
  if (!so) throw bad('Invoice not found in this tenant');
  if (so.currency && so.currency !== 'NGN') {
    throw bad('Accounting credits currently support NGN invoices only');
  }
}

// ── create (draft) ──────────────────────────────────────────────────────────

/**
 * Create a credit note as a DRAFT. Nothing touches the ledger: no journal
 * entry, no invoice movement, no number consumed. Review happens before the
 * books move.
 *
 * A note that names no invoice must name a customer. Without one its credit
 * would sit on an account nothing can query, which is the stranded-credit
 * defect in miniature.
 */
async function createCreditNote({ tenantId, data, userId, session: outerSession } = {}) {
  const run = async (session) => {
    validateAmounts({ amount: data.amount, taxAmount: data.taxAmount });
    const date = data.date ? new Date(data.date) : new Date();
    if (Number.isNaN(date.getTime())) throw bad('Invalid credit date');

    let so = null;
    if (data.salesOrder) {
      if (!mongoose.isValidObjectId(data.salesOrder)) throw bad('Invalid invoice');
      so = await SalesOrder.findOne({
        _id: data.salesOrder,
        tenant: tenantId,
        orderStatus: { $in: CREDITABLE_ORDER_STATES },
      }).session(session);
      assertInvoiceUsable(so);
    }

    const fromInvoice = so?.customer || so?.customerSnapshot?.customerId || null;
    const customer = fromInvoice || data.customer || null;
    if (fromInvoice && data.customer && String(data.customer) !== String(fromInvoice)) {
      throw bad('Credit customer does not match the invoice');
    }

    if (!so && !customer) {
      throw bad('Customer is required for an unapplied credit');
    }
    // Only an EXPLICITLY chosen customer has to be a real account. A customer
    // read off the invoice is trusted as-is: older orders carry a customer
    // snapshot with no POSCustomer row, and demanding one would make those
    // invoices uncreditable — the defect this change is meant to remove.
    if (data.customer && !fromInvoice) {
      const exists = await POSCustomer.findOne({ _id: data.customer, tenant: tenantId }).session(session);
      if (!exists) throw bad('Customer not found in this tenant');
    }

    const [creditNote] = await CreditNote.create([{
      tenant: tenantId,
      // No number: allocated at post so the published sequence stays gapless.
      customer,
      customerName: so?.customerSnapshot?.name || data.customerName,
      salesOrder: so?._id || null,
      date,
      reason: data.reason,
      amount: round2(data.amount),
      taxAmount: round2(data.taxAmount || 0),
      status: 'draft',
      unappliedAmount: 0,
      allocations: [],
      postedBy: userId,
    }], { session });

    return creditNote;
  };

  return outerSession ? run(outerSession) : mongoose.connection.transaction(run);
}

// ── post ────────────────────────────────────────────────────────────────────

/**
 * Post a draft: the single GL entry for the full note total, the invoice's
 * share applied against its outstanding, and the remainder held as unapplied
 * credit on the account.
 *
 * A credit larger than the invoice, or larger than the invoice's outstanding,
 * is legitimate — a goodwill credit on a paid invoice is the common case — so
 * the old "Credit exceeds outstanding invoice balance" guard is deliberately
 * gone. Nothing is over-credited: an invoice absorbs at most its outstanding.
 */
async function postCreditNote({ tenantId, id, userId }) {
  return mongoose.connection.transaction(async (session) => {
    const creditNote = await CreditNote.findOne({
      _id: id, tenant: tenantId, status: 'draft',
    }).session(session);
    if (!creditNote) throw bad('Only draft credit notes can be posted');

    await ensureDefaultCOA(tenantId);

    const total = noteTotal(creditNote);
    let unapplied = total;

    if (creditNote.salesOrder) {
      const so = await SalesOrder.findOne({
        _id: creditNote.salesOrder, tenant: tenantId,
      }).session(session);
      assertInvoiceUsable(so);

      const { appliedNow, unapplied: remainder } = planAllocation({
        total,
        outstanding: invoiceOutstanding(so),
      });
      unapplied = remainder;

      if (appliedNow > 0) {
        so.creditedAmount = round2((so.creditedAmount || 0) + appliedNow);
        await so.save({ session });
        creditNote.allocations.push({
          salesOrder: so._id,
          amount: appliedNow,
          appliedAt: new Date(),
          appliedBy: userId,
        });
      }
    }

    creditNote.number = await nextNumber({
      tenant: tenantId,
      year: creditNote.date.getUTCFullYear(),
      session,
    });
    creditNote.status = 'applied';
    creditNote.unappliedAmount = unapplied;
    creditNote.postedAt = new Date();
    creditNote.postedBy = userId;
    await creditNote.save({ session });

    // One entry, full total. buildLines ignores any allocation.
    await journalService.postJournalEntry({
      tenantId,
      date: creditNote.date,
      lines: buildLines(creditNote),
      source: 'credit_note',
      refDoc: creditNote._id,
      refDocType: 'CreditNote',
      memo: `Credit note ${creditNote.number}`,
      postedBy: userId,
      entryType: 'refund',
      session,
    });

    return creditNote;
  });
}

// ── apply ───────────────────────────────────────────────────────────────────

/**
 * Spend unapplied customer credit on an invoice, oldest credit first.
 *
 * NO journal entry. See invariant 2 at the top of this file — this is the single
 * most important thing not to "fix" later.
 */
async function applyCredit({ tenantId, customer, salesOrder, amount, userId }) {
  return mongoose.connection.transaction(async (session) => {
    if (!mongoose.isValidObjectId(salesOrder)) throw bad('Invalid invoice');
    const so = await SalesOrder.findOne({ _id: salesOrder, tenant: tenantId }).session(session);
    assertInvoiceUsable(so);

    const who = customer || so.customer || so.customerSnapshot?.customerId || null;
    if (!who) throw bad('Invoice has no customer to hold credit');

    const notes = await CreditNote.find({
      tenant: tenantId,
      customer: who,
      status: 'applied',
      unappliedAmount: { $gt: 0 },
    }).sort({ postedAt: 1, _id: 1 }).session(session);

    const plan = planApplication({
      notes,
      outstanding: invoiceOutstanding(so),
      want: amount,
    });
    if (plan.error) throw bad(plan.error);

    const appliedAt = new Date();
    for (const { note, amount: take } of plan.takes) {
      note.unappliedAmount = round2(note.unappliedAmount - take);
      note.allocations.push({ salesOrder: so._id, amount: take, appliedAt, appliedBy: userId });
      await note.save({ session });
    }

    so.creditedAmount = round2((so.creditedAmount || 0) + plan.total);
    await so.save({ session });

    return {
      salesOrder: so._id,
      customer: who,
      applied: plan.total,
      notes: plan.takes.map((t) => ({ _id: t.note._id, amount: t.amount })),
    };
  });
}

// ── cancel ──────────────────────────────────────────────────────────────────

/**
 * Cancel a credit note.
 *
 * A draft simply becomes cancelled — it never touched the ledger.
 *
 * A posted note gives back the invoice credit it consumed and reverses the GL.
 * Where the invoice was settled *because of* this credit, the cancellation is
 * refused: removing the credit re-opens an invoice the customer has already paid
 * in cash, and `normalizeOpenDoc` would then clamp outstanding to zero and hide
 * the inconsistency. That is a cash-out event, not a bookkeeping tidy-up.
 */
async function cancelCreditNote({ tenantId, id, userId }) {
  return mongoose.connection.transaction(async (session) => {
    const creditNote = await CreditNote.findOne({ _id: id, tenant: tenantId }).session(session);
    if (!creditNote) throw bad('Credit note not found');
    if (creditNote.status === 'cancelled') throw bad('Credit note is already cancelled');

    if (creditNote.status === 'draft') {
      creditNote.status = 'cancelled';
      await creditNote.save({ session });
      return creditNote;
    }

    // Validate-then-mutate per allocation. The transaction is what makes this
    // safe: any throw below aborts the whole unit, so a refusal cannot leave a
    // half-deallocated invoice behind.
    for (const allocation of creditNote.allocations) {
      const so = await SalesOrder.findOne({
        _id: allocation.salesOrder, tenant: tenantId,
      }).session(session);
      if (!so) throw bad('Invoice for this credit is missing; reconcile before cancelling');

      const check = deallocationCheck({ so, allocationAmount: allocation.amount });
      if (!check.ok) {
        if (check.reason === 'was-settled') {
          throw bad(
            `Cannot cancel: ${round2(allocation.amount)} of this credit was applied to ` +
            `invoice ${so.soNumber || so._id}, which has since been paid. ` +
            'Reverse the receipt instead.',
          );
        }
        throw bad('Invoice credit balance needs reconciliation before cancelling');
      }

      so.creditedAmount = Math.max(0, round2((so.creditedAmount || 0) - allocation.amount));
      await so.save({ session });
    }

    const original = await JournalEntry.findOne({
      tenant: tenantId, refDoc: creditNote._id, entryType: 'refund',
    }).session(session);
    if (!original) throw bad('Credit journal is missing; reconcile before cancelling');

    await journalService.reverseEntry({
      tenantId, entryId: original._id, userId, session,
    });

    creditNote.status = 'cancelled';
    // The GL reversal removed the credit, so the account credit must go too —
    // otherwise the sub-ledger would claim credit the GL no longer holds.
    creditNote.unappliedAmount = 0;
    await creditNote.save({ session });
    return creditNote;
  });
}

// ── read ────────────────────────────────────────────────────────────────────

async function listCreditNotes(tenantId, { status, from, to, customer, page = 1, limit = 50 } = {}) {
  const filter = { tenant: tenantId };
  if (status) filter.status = status;
  if (customer) filter.customer = customer;
  const range = dateRange({ from, to });
  if (range) filter.date = range;
  const [data, total] = await Promise.all([
    CreditNote.find(filter)
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate({ path: 'customer', select: 'firstName lastName', match: { tenant: tenantId } })
      .lean(),
    CreditNote.countDocuments(filter),
  ]);
  return { data, total, page, pages: Math.ceil(total / limit) || 1 };
}

/**
 * Credit a customer has on account and has not yet spent. Derived from the notes
 * themselves — never cached on the customer record, because a cached balance is
 * what silently drifts away from the ledger.
 */
async function unappliedBalance(tenantId, customerId) {
  if (!customerId || !mongoose.isValidObjectId(customerId)) return 0;
  const [row] = await CreditNote.aggregate([
    { $match: { tenant: new mongoose.Types.ObjectId(tenantId), customer: new mongoose.Types.ObjectId(customerId), status: 'applied' } },
    { $group: { _id: null, total: { $sum: '$unappliedAmount' } } },
  ]);
  return round2(row?.total || 0);
}

/** Balances for many customers at once, so a directory view is not an N+1. */
async function unappliedBalances(tenantId, customerIds = []) {
  const ids = customerIds.filter((id) => mongoose.isValidObjectId(id));
  if (!ids.length) return new Map();
  const rows = await CreditNote.aggregate([
    { $match: { tenant: new mongoose.Types.ObjectId(tenantId), customer: { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) }, status: 'applied' } },
    { $group: { _id: '$customer', total: { $sum: '$unappliedAmount' } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), round2(r.total)]));
}

/** The panel payload: balance plus the notes that make it up. */
async function customerCredits(tenantId, customerId, { page = 1, limit = 50 } = {}) {
  if (!mongoose.isValidObjectId(customerId)) throw bad('Invalid customer');
  const [balance, notes] = await Promise.all([
    unappliedBalance(tenantId, customerId),
    listCreditNotes(tenantId, { customer: customerId, page, limit }),
  ]);
  return { customer: customerId, balance, ...notes };
}

module.exports = {
  buildLines,
  createCreditNote,
  postCreditNote,
  applyCredit,
  cancelCreditNote,
  listCreditNotes,
  unappliedBalance,
  unappliedBalances,
  customerCredits,
};