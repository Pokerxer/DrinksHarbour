---
name: accounting-credit-gl-vs-subledger
description: The two invariants that keep the receivable control account equal to the sum of open invoices — post moves the GL once for the full total, apply never does.
type: convention
---

# Credit notes: GL versus sub-ledger — 2026-09-30

Customer credit has two ledgers that must not be confused: the **general
ledger** (what the receivable is worth) and the **sub-ledger** (which invoices
the credit has been spent against). Two rules keep them consistent.

1. **Posting moves the GL exactly once, for the full note total.**
   `buildLines()` in `server/services/creditNote.service.js` ignores
   allocations on purpose. A ₦107,500 note posts one entry for ₦107,500 even if
   ₦20,000 lands on an invoice and ₦87,500 is held as account credit.

2. **Applying credit never touches the GL.** `applyCredit` writes only
   `unappliedAmount` and `SalesOrder.creditedAmount`. The receivable was already
   credited at post time. Adding a journal entry here would credit every
   customer's receivable twice and leave the control account disagreeing with the
   sum of open invoices.

If these are ever violated the failure is **silent**: the balance sheet still
balances, because both sides are wrong by the same amount. Nothing errors, and
the discrepancy surfaces months later as an unexplained difference between the
receivable control account and the AR ageing. A test asserting
`postJournalEntry` call counts is the only thing guarding this — keep them.

## Related decisions

- **Credit balances are derived, never cached.** The customer balance is a
  `$sum` over notes. There is deliberately no `creditBalance` on `POSCustomer`:
  a cached balance drifts from the ledger and cannot be reconciled afterwards.
  `AccountingCustomer.creditBalance` in the API response is computed per request.
- **A credit may exceed its invoice.** The old `gross <= outstanding` guard made
  a credit against a *paid* invoice impossible (outstanding 0 rejected every
  amount, including ₦1). Excess is legitimate and becomes `unappliedAmount`.
  Never reinstate that guard.
- **`invoiceOutstanding` clamps at zero, so it hides inconsistency.** That clamp
  is why `deallocationCheck` exists: without it, cancelling a credit on an
  invoice that was settled *because of* that credit would re-open cash the
  customer actually paid, and the clamp would report 0.
- **Numbers are allocated at post, not at draft**, so a discarded draft does not
  leave a permanent gap in an auditable sequence. This is also why the unique
  index on `{ tenant, number }` must be **partial** — a plain unique index treats
  a missing value as one shared value and permits only one unnumbered draft per
  tenant.
- **Allocation arithmetic lives in `creditNote.alloc.js`, pure and DB-free**, so
  the rules are testable without a database. Keep it pure; it is where the
  correctness is.

See `docs/superpowers/specs/RESUME-customer-credit-notes.md` for the full
delivered design and deployment notes.
