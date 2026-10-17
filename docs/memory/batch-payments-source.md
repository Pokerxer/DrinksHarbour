# Batch payments: Sales/POS and Wallet reconciliation

Implemented2026-10-15 after explicit design and implementation-plan approvals.
Single agent; current workspace; no delegation, commits, deployment or live financial
test writes. Resume: docs/superpowers/specs/RESUME-batch-payments-source.md.

Workspace has filtered totals, search/status/account/date filters, pagination,
responsive results, member details/source/invoice/bill links, reviewed completion
and cancellation, clear read failures/retry and guarded stale identity responses.
Picker retains selections across pages/search; refresh revalidates all selections;
changed/removed amounts require clear/rechoose. Uncertain writes require refresh.

Batch ownership is tenant+journal+account, with unique active SourceBatchClaim.
Cash1000, Bank1100 and Wallet2200 portions reconcile separately, net of verified
same-account refunds. AR1300 and uncertain/reversed/duplicated/nonfinite proof are
excluded. Saved Accounting journals require actual AR1300/AP2000 counterparts.
New snapshots persist cancelled history; completion rechecks proof/amount/ownership.
Legacy account semantics retained; missing old cancelled history is unavailable.
No new payment journals, transfers, wallet changes or stock replay. Models disable
hidden claim-index creation. Metadata-only source_account_active_unique setup is
complete on configured DB; requireSourceIndex enforces exact active-only filter.
Transaction-session operations are sequential. Rules: server/services/batchPayment/README.md.

Read-only live eligibility: Wyn CityCash4 portions, netNGN5,895,345.68; CKK GifteryCash1,
netNGN132,000. Bank/Wallet/vendor eligible0 in both businesses. Vendor purchases
require actual payment metadata before any posting; do not infer payment proof.

Verified full server3807 pass/14 optional skips; final focused backend11 pass;
local Mongo integration pass with duplicate claims, split tender, refund changes,
legacy completion/history, tenant isolation and no duplicate financial entries.
Test DB dropped and local Mongo stopped. Admin2890 passed/359files. Lint clean for
changed UI files; type check359 baseline diagnostics, none new batch-related.
CodeRabbit unavailable; single-agent review performed. Browser verification unavailable
under current access restriction. Full server listener tests require escalation;
first sandbox run failed from unavailable local listeners, approved rerun passed.
Final strict-index read-only audit passed; eligible counts remain as recorded above.

Separate vendor actual payment metadata and runtime [object Event] trigger remain
pending in their own handoffs. No further batch design/plan approval is needed.
