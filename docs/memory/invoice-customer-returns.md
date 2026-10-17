# Invoice customer returns — 2026-10-14

Implemented and verified after user approval of reviewed credit/refund handling.
Resume: docs/superpowers/specs/RESUME-invoice-customer-returns.md.

Invoices show partial/full return badges, return-status filters before pagination,
returned quantities and invoice-scoped Inventory links. Shared inventory PDF
retains original amounts/items and four columns, with return notes. CSV includes
return and settlement information. Fully credited/refunded labels differ from
cash-paid; reviewed Sales return credits start as drafts with blank amounts.

Refund reconciliation requires balanced posted per-refund journal evidence with
no posted reversal. Fully refunded linked POS receipts remain attached to their
Sales invoice; refund hooks refresh that invoice. Gross Sales collection counters
remain unchanged; credit planning uses verified net collection. Allocated credit
and named posted commercial credit are separate fields. Goods returns alone
never post money or change immutable issued snapshots. Missing/excess/legacy
proof and ambiguous quantities remain reviewable. Paid-invoice unapplied credit
and credit cancellation also sync through existing hooks.

Invoice header reads saved posted balances and counts POS tabs once; other AR
reports retain source-ledger behavior. Legacy saved financial fields refresh via
normal hooks or explicit Reconcile; return summaries are live read projections.

Verification: server3,768 pass/10 optional skips; admin2,827 pass/342 files;
zero failures. Explicit local Mongo return and existing saved-invoice integrations
passed; databases dropped and temporary Mongo27192 stopped cleanly. Changed-file
lint clean; type check359 pre-existing errors, no new diagnostics. Browser check
unavailable under earlier access restriction. Single-agent inline review;
CodeRabbit unavailable. No live writes/imports, commits, push or deployment.
