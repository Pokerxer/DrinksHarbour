---
name: journal-entries-accounting-invariants
description: Invariants behind /accounting/journal-entries — period derivation in UTC, Account.type over code prefixes, reversal unwinds its tax capture, and page totals count posted entries only.
type: convention
---

# Journal entries — accounting invariants

Four rules the journal pages now depend on. Each replaced a defect that produced
a *plausible* wrong number rather than an error.

## `period` is derived in UTC

Every date in the ledger is a UTC instant. `periodOf()` and the monthly series
buckets use `getUTC*` getters. Local getters made the answer depend on the
server's timezone: a sale at 00:30 Lagos on 1 August (`2026-07-31T23:30Z`) was
filed under July, so the month's revenue and VAT disagreed with the bank
statement and the FIRS return. Historical entries keep the `period` they were
written with; only new postings change. Verified deterministic across
`TZ=UTC`, `Africa/Lagos`, `America/New_York`, `Pacific/Kiritimati`.

## `Account.type` beats the account-code prefix

Tenants create accounts with any code. A "1500 Revenue" account and a "4900
Asset" account are both reachable, so the trial balance (which read
`Account.type`) and the P&L / balance sheet (which read prefixes) used to
disagree, and the trial balance tied to neither. Reports now classify from the
Account document, falling back to the prefix only for an unknown account. COGS
remains a prefix split *within* confirmed expenses, so `5xxx` is still COGS.

**Why the fallback exists:** before a chart is loaded, or for a line whose
account has since been deleted, the prefix is all there is.

## A reversal unwinds its tax capture

`journalEntry.service.reverseEntry` calls `reverseDocumentTax` for the original's
source document. Doing it inside the service rather than at each call site is
deliberate — the call sites are exactly what drifted apart, which left 2100
credited back in the journal while the `TaxRecord` stayed `posted`, so output VAT
was overstated permanently and `tax.reconciled` could never recover.

`taxSourceForEntry` returns `null` for marketplace orders, refunds, manual
entries, absent `refDoc`, and reversals, so a reversal can never fabricate tax.
A tax-write failure is logged (`taxReverseFailed`) and does not lose the journal
reversal — the tax ledger is repairable by the backfill script, the journal is
not.

## Page totals count posted entries only

`client/apps/admin/src/app/shared/accounting/summarizePage` totals posted entries,
discloses the excluded draft count, and flags an out-of-balance page at the same
±0.01 tolerance `isBalanced` posts at. Drafts never reach the ledger, so folding
them in produced a figure corresponding to no real period movement.

**Convention:** the client tolerance must stay equal to the server's
`isBalanced` bound. They are asserted separately; if you change one, change both
or a bookkeeper sees a warning the posting path considers fine.

**Consequence for exports:** "Export CSV" pages the whole filtered set at the
API's 500-row ceiling and reports in the toast when the result is capped. A
short ledger export is worse than none.
