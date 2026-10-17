---
date: 2026-10-15
type: project
---

# Invoice calculation audit

User requested functionality/calculation fixes for `/accounting/invoices`,
explicitly excluding design changes. Resume:
`docs/superpowers/specs/RESUME-invoice-calculation-audit.md`.

Six reproduced bugs: summary aging disagreed with Lagos calendar due labels;
missing due dates aged from issue date; unbalanced POS repayments reduced debt;
reversed linked receipts counted as paid; overallocated payments and credit notes
reduced invoice balances. Fixes are confined to customerInvoice services, with
six regressions plus existing invoice/return integration checks. Final full server
suite:3815 passed/14 optional skips/0 failures. Both disposable Mongo invoice and
returns integration checks passed; their databases were dropped and instance
stopped. Syntax/whitespace checks pass. No frontend changes; manual review used
because CodeRabbit is unavailable.

No live financial data repair or snapshot rewriting. Existing saved balances
refresh through explicit reconciliation/source hooks. Preserve current reviewed
draft header behavior, posted-only aging and POS FIFO, NGN and tenant isolation.
Verification results and limitations are recorded in the resume file.
