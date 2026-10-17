---
title: Invoice workspace design and function pass
date: 2026-10-13
status: implemented and verified locally
---

# Invoice workspace

The user requested design and functionality improvements for
`/accounting/invoices`. Read the concrete proposal in
`docs/superpowers/specs/RESUME-accounting-invoices-workspace.md` before continuing.
The user approved the open-invoice design. The implementation is complete; see
the proposal's Completed implementation and Verification sections for details.

Live inspection: localhost:3000 page works and has zero open invoices. The first
load was slow, then completed; do not label it a permanent loading failure.
Port 3001 was unavailable. Browser tab inspections made no financial changes.
Existing source already shows missing-token indefinite loading as a code path.

The original scope stayed with open invoices. On 2026-10-13 the user explicitly
expanded browsing to paid/fulfilled Sales and POS orders; see
`docs/superpowers/specs/RESUME-accounting-all-invoices.md`. Allocation reads retain
`scope=open` for outstanding Sales invoices; draft quotations stay excluded.
Shared invoice/bill components require vendor-bill compatibility checks.

Verification: 70 accounting tests pass; full admin suite has 2,751 passes across
320 files at maxWorkers=2. The initial inventory-movements-browser sorting test
timed out and passed on its separate rerun and the full final rerun. Lint passes.
The full TypeScript check has 359 existing errors; none are in the invoice or
changed payment/helper/service/shell files. Do not claim whole-project typecheck
success. Live empty state, status filtering/clearing and 390px mobile sizing were
checked. Populated rows and receipt loading use fixtures; no live financial writes.

Key rules: exports are page-scoped; summary covers all open balances and explains
tabs separately; due labels use Africa/Lagos calendar days. Do not revive missing
invoices from stale allocation data. The receipt loader queries the document by
number when it is outside the initial 100 records, and blocks recording if absent.
List and summary failures have separate retries; stale results cannot be paid or
exported. The server remains authoritative for allocation and tenant enforcement.

New focused components/hooks keep the browser and payment form small. The shell
has an optional actions slot. Shared invoice/bill views retain the same endpoint
contracts. No backend changes, commit or deployment occurred in this pass.
