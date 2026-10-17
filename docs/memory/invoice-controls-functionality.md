# Invoice controls reliability — 2026-10-14

User pointed to invoice balance/open count/aging and ledger filters/export/refresh.
Kept existing approved invoice workspace scope. Found a concrete presentation bug:
cached summary balances, count and aging stayed visible during refresh or failure,
including zero values that could be mistaken for a fresh successful read.

AccountingDocumentSummary now masks its cached summary during loading/error.
Shows dashes, updating/error state and independent retry; only successful reads
show confirmed balances or zero. The underlying cached data and list remain intact,
with existing stale-list receipt/export guards. Financial logic, saved invoice
snapshots, POS FIFO, ledger identity, global summary scope and PDF unchanged.

Regression accounting-summary-availability.test.tsx: pending balances/count/aging,
failed cached zero, successful confirmed zero. First2 failed before fix, third
already passed. invoice-workspace.test.tsx adds invalid-date no-query/disabled
receipt/export and combined return/date query/reset coverage. Existing tests verify
late reply suppression, page clamp, retry independence and paid POS history.
CSV/calendar/source helper tests unchanged. Focused17 passed; full admin2,875 passed across355 files,zero failures. Changed-file lint and diff check clean. Single-agent review verified global summary scope, availability guard and preserved list retry/actions; CodeRabbit unavailable. No type check rerun for this small existing-component guard; last workspace type363 unrelated errors. Backend unchanged; prior server3,797/13skip retained.
No backend, data writes or invoice reconciliation/import; no browser workaround.

Separate pending work: Vendor orders already paid, actual payment metadata remains
unsupplied in vendor-payment-recording-review.md. Runtime [object Event] origin
still unconfirmed; pending immediate-load versus click in vendor-runtime-event.md.
Do not claim this invoice summary fix resolves that unrelated runtime rejection.

Resume docs/superpowers/specs/RESUME-invoice-controls-functionality.md.
