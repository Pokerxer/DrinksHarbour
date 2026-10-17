# Invoice header outstanding — 2026-10-15

User reports header0 while ledger~3.9M and confirms the ledger amount is expected.
Root cause: saved summary selected posted invoices only. Wyn City has3 draft
positive balances NGN3,927,715.68;6 issue-bearing drafts total. Posted invoices
are paid. Source orders for the3 positive drafts are fulfilled and marked paid,
but required accounting postings are missing/inconsistent. Do not repair by
inventing payment/GL proof, posting drafts, or rewriting payment counters.

Implemented: summary.js emits reviewCount/reviewBalanceCount/reviewOutstanding
separately from unchanged posted totalOutstanding/count/aging. Header displays
posted invoice portion plus unverified review draft balances, and counts positive
review drafts, matching3,927,715.68 across3 invoices. Caption/banner explicitly
mark the draft amount as unverified, not confirmed customer debt. Posted aging
remains posted-only and is labelled as such. Review draft invoices clears filters
and opens Drafts. Clean drafts/cancelled/foreign currency excluded. Existing stale
summary masking retained. No live financial writes, commits or delegation.

Read-only audit server/scripts/audit-invoice-outstanding.js verifies exact live
summaryfields. Regression tests reproduced backend omission and numeric header/count
failure before fixing. Full server3809 pass/14 optional skips. Full admin2890pass/
2 unrelated5-second timeouts; both unchanged test files and final invoice suites
rerun in isolation:19 passed/4files. Changed-file lint/diff clean. Type check359 existing diagnostics, none in changed files.
CodeRabbit unavailable; manual single-agent review performed. Browser verification
unavailable under existing access restriction.

Resume docs/superpowers/specs/RESUME-invoice-outstanding-correction.md; rules in
server/services/customerInvoice/README.md. Vendor payment metadata/Event trigger
remain separate. Never call these draft discrepancies confirmed customer debt.
