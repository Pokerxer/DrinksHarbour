# Payments workspace — 2026-10-14

Approved bounded redesign of /accounting/payments implemented and verified. Resume: docs/superpowers/specs/RESUME-payments-workspace.md.
Rules: server/services/accountingPayment.README.md.

Customer receipts/vendor payments now have complete filtered totals, safe search,
method/date/status filters, mobile cards, details/document links, references,
allocated/unallocated amounts and batch explanations. Cancellation is reviewed,
with original journal/deallocation rules and batch restrictions preserved.
Reads clear stale records and ignore old replies; side/token change resets state.
Failed reads show unavailable totals. Account-aware recording includes allocation
and remainder preview, date/reference, and paginated account/document choices.
Name-only fallback is labeled; there is no new later-allocation or gateway flow.

Fixed actual vendor request bug: create/cancel previously read only query side,
while client sent body.side, so defaulted to customer. Side now accepts query/body
and rejects invalid/conflicting values. Refund-related reopened invoice allocations
use existing verified net balance while preserving original gross Sales collection
counters. Real test records40 after refund40, then cancels it, restoring net60/due40
without changing original invoice snapshot or posting duplicate payments/refunds.

Server3,776 pass/12 optional skips. Focused UI14 pass; final receipt-context/failed-summary regressions9 pass. Local new payment, saved-invoice and invoice-return integrations
passed. Type359 pre-existing diagnostics/no new errors; final changed-file lint clean. Final full admin2,841 passed across346 files; no failures. Temporary Mongo27192
stopped cleanly, exit0; disposable databases dropped. No live writes/imports/commit/push/deployment. Browser
restriction respected; single-agent local review complete, CodeRabbit unavailable.

First broad admin run exposed2 invoice-receipt regressions from unnecessary account-choice loading in document context; fixed by omitting account picker when an initial document is present. Final broad run includes both corrected cases. No further work pending.
