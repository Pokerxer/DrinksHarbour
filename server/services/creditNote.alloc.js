// services/creditNote.alloc.js
//
// Where a credit lands. Pure arithmetic, deliberately free of mongoose and the
// database so the rules are testable on their own.
//
// Three money conventions hold throughout the accounting module and this file
// does not introduce a fourth:
//
//   1. Every figure is VAT-INCLUSIVE of `taxAmount`. `amount` is the ex-tax
//      component, `taxAmount` the VAT on it, and the credit as a whole is their
//      sum. `SalesOrder.creditedAmount` already means exactly this.
//   2. All values pass through `round2`. Floating point makes 33.33 x 3 land on
//      99.99000000000001, and an allocation that does not sum to its own total
//      is how a credit goes missing.
//   3. An invoice's outstanding is clamped at zero. That clamp is load-bearing
//      for display but it *hides* inconsistency, so `deallocationCheck` exists to
//      catch a bad state before it reaches the clamp.

const { round2 } = require('./accounting.helpers');

/** Tolerance for money comparisons, half a kobo. */
const EPSILON = 0.005;

/** VAT-inclusive value of a note. */
function noteTotal(cn = {}) {
  return round2((cn.amount || 0) + (cn.taxAmount || 0));
}

/** What an invoice can still absorb. Clamped at zero. */
function invoiceOutstanding(so = {}) {
  return Math.max(
    0,
    round2((so.total || 0) - (so.amountPaid || 0) - (so.creditedAmount || 0)),
  );
}

/**
 * Split a note between the invoice it references and unapplied customer credit.
 *
 * `outstanding: null` means "no invoice" — the note becomes pure account credit.
 * An outstanding of 0 (a fully paid invoice) is a real invoice that can absorb
 * nothing, so the whole note is unapplied. That case used to be rejected outright.
 */
function planAllocation({ total, outstanding }) {
  const absorbable = outstanding == null ? 0 : Math.max(0, outstanding);
  const appliedNow = Math.min(total, absorbable);
  return { appliedNow, unapplied: round2(total - appliedNow) };
}

/**
 * Consume a credit pool onto one invoice, oldest note first.
 *
 * FIFO is a deliberate choice, not an arbitrary one: it makes the credit history
 * explainable. Following the oldest credit first means the ledger reads as "this
 * credit was spent, then that one", and reversing a specific note later has an
 * unambiguous meaning.
 *
 * `notes` must already be FIFO-ordered by the caller.
 */
function planApplication({ notes = [], outstanding, want }) {
  const pool = round2(notes.reduce((sum, n) => sum + (n.unappliedAmount || 0), 0));
  const target = Math.max(0, outstanding || 0);

  if (pool <= 0) return { error: 'No unapplied credit on this account' };
  if (target <= 0) return { error: 'Invoice has no outstanding balance' };

  const requested = want == null ? Math.min(pool, target) : round2(want);
  if (requested <= 0) return { error: 'Allocation amount must be positive' };
  if (requested > pool) return { error: `Exceeds available credit of ${pool}` };
  if (requested > target) {
    return { error: 'Allocation exceeds the invoice outstanding balance' };
  }

  const takes = [];
  let remaining = requested;
  for (const note of notes) {
    if (remaining <= EPSILON) break;
    const available = round2(note.unappliedAmount || 0);
    if (available <= EPSILON) continue;
    const take = Math.min(available, remaining);
    takes.push({ note, amount: take });
    remaining = round2(remaining - take);
  }

  return { takes, total: round2(requested - remaining) };
}

/**
 * May this allocation be removed without breaking the invoice?
 *
 * `was-settled` is the important one. If an invoice was settled *because of*
 * this credit, removing the credit re-opens an invoice the customer has already
 * paid in cash. That is an accounting event rather than a bookkeeping tidy-up,
 * so it goes to the cash-out route instead of being forced through — and forcing
 * it through would be invisible, because the outstanding clamp would report zero.
 */
function deallocationCheck({ so = {}, allocationAmount }) {
  const total = so.total || 0;
  const paid = so.amountPaid || 0;
  const credited = so.creditedAmount || 0;

  const before = round2(total - paid - credited);
  const after = round2(total - paid - (credited - allocationAmount));

  if (after < -EPSILON) return { ok: false, reason: 'over-credited' };
  if (before <= EPSILON && after > EPSILON) return { ok: false, reason: 'was-settled' };
  return { ok: true };
}

module.exports = {
  EPSILON,
  noteTotal,
  invoiceOutstanding,
  planAllocation,
  planApplication,
  deallocationCheck,
};