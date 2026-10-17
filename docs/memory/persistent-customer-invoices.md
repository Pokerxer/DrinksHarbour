# Persistent customer invoices — 2026-10-13

User approved separate numbered invoice documents linked to Sales/POS, frozen
posted snapshots, payment reconciliation and idempotent history import. They
explicitly selected BOTH Wyn City and CKK Giftery for live import. No commits,
pushes or deployment requested.

CustomerInvoice + InvoiceCounter; services/customerInvoice handles snapshots,
reconciliation, FIFO evidence, source hooks, saved browse, source-ID adapters and
import. Manual invoice autosaves persist drafts; issuance saves/posts in one
transaction. Source writes refresh linked invoices. Missing/mismatched accounting
leaves new documents as drafts; posted source changes show issues without rewriting
the financial snapshot. GET never creates invoices. Detail/print uses invoice IDs.
Cancelled invoices have no outstanding balance and cannot silently reactivate.

Historical import completed:
- Wyn City 699165839f3308b1baeca8fc: 13 sources → 9 invoices (3 posted, 6 review
  drafts), 4 linked receipt duplicates suppressed.
- CKK Giftery 6aabec2b9294f4afed5ce61f: 2 sources → 1 posted invoice, 1 linked
  receipt duplicate suppressed.
- Repeat apply runs: zero creates, zero errors.
- Existing GL unchanged: Wyn City 14 entries, debit=credit ₦21,147,608.96;
  CKK Giftery 3 entries, debit=credit ₦374,000.

Full frontend: 2,802 passed in 336 files. Full server: 3,759 passed, 8 opt-in skips,
zero failures. Separately verified real local replica-set transactions for invoice
issue, receipts/cancellations, credits/cancellations, FIFO, deduplication, concurrent
retries, tenant isolation, snapshots and import reruns. Changed frontend lint clean.
Full type check retains 359 existing errors; no errors in the new invoice files.
Browser policy previously denied localhost; no bypass or browser verification.
Final review checks: 101 focused frontend and 221 financial/fulfillment server
tests passed; local invoice transaction cases passed. Disposable Mongo stopped.

Cold-reader handoff: docs/superpowers/specs/RESUME-persistent-customer-invoices.md.
Import commands and invariants: server/services/customerInvoice/README.md.
