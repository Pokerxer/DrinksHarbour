# Invoice detail redesign — 2026-10-13

User approved and implementation completed. Cold reader:
docs/superpowers/specs/RESUME-invoice-detail-page.md.

Small detail components + use-saved-invoice; workspace keyed by token/invoice.
Refresh only reads; Reconcile explicitly writes. Distinct statuses, mobile cards,
compact balance panel, current valid Tenant.bankAccounts, payment/credit history,
print isolation and recoverable errors. Receipt gate: posted/reconciled/NGN Sales
invoice with outstanding balance. POS uses the existing customer account flow.

Read-only tenant-scoped backend detail context. Per-invoice allocations show their
allocated amount, shared POS account payments their account scope, source receipts
and refunds their source scope. No recalculation of saved financial snapshots;
no extra GL writes, migration or deployment. Settlement accounts never displayed.

Verified: detail page 9 tests pass; real local Mongo detail/isolation/GET immutability
and existing transactions pass; full server 3,761 pass, 8 skips. Lint clean; 359
existing type errors remain, none in detail changes. Full frontend: 2,807 pass.
Legacy refund compatibility includes only the unrepresented older amount and
uses refundDetails.createdAt. Final server: 3,761 pass, 8 skips, zero failures. Disposable database stopped.
Browser policy blocks localhost; actual print layout not browser-verified.

User correction: invoice must retain the system inventory document template.
Print now routes through utils/print/customer-invoice.ts + requestDocumentExport,
the shared branded PDF renderer/tenant style preview used by inventory/Sales.
No window.print/custom page-print CSS. Saved financial snapshots are preserved;
draft/cancelled PDF watermark. Invoice kind uses existing Sales family preferences.
Template correction: full frontend 2,809 passed (337 files), lint clean; existing
359 type errors unchanged, none in invoice changes. Real shared-renderer PDF tested.

Payment badge refinement — 2026-10-14: shared badges on list/mobile/detail,
Payment closed + No payment due for cancellation. Full frontend 2,814 passed.
See docs/memory/invoice-payment-badges.md. No financial or PDF template changes.

PDF correction — 2026-10-14: user requested removing the item Tax column.
Saved invoice PDFs now have Description / Qty / Unit price / Amount. Section/note
rows match four columns. VAT remains in totals; saved line totals, balances and
the shared inventory document template are unchanged. Red/green regression and
94 print tests passed (real PDFs rendered); lint clean; existing 359 type errors,
none in customer-invoice files. Full frontend: 2,815 tests passed in 338 files.
Review confirmed only PDF table presentation changed. Backend unchanged; no
migration, commit or deployment. Browser preview remains unverified due to policy.
