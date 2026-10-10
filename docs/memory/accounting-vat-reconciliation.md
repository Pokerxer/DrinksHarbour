---
name: accounting-vat-reconciliation
description: POS VAT source schema, exact tax snapshots, immutable retries, journal/tax-ledger reconciliation and sales/profit display rules.
type: convention
---

# Accounting VAT and profit — 2026-09-30

## Recording

TaxRecord now accepts `pos`. Previously the capture code attempted this source,
but schema validation rejected it and swallowed the failure. Order posting must
call tax capture with `strict: true`; a tax failure leaves `needs_review` rather
than claiming the entire order is posted.

`tax.pos-capture.js` validates header/line VAT agreement and preserves exact line
`taxAmount` snapshots (POS rounds at sale time). It inserts missing rate groups
idempotently, dates them to the receipt's paid/placed/created date, and refuses
conflicting existing data. It does not rewrite tax history on retry.

A linked POS receipt settles a SalesOrder: only that invoice captures VAT.
Voids reverse standalone receipt VAT. Refunds with no verified VAT allocation
remain `needs_review`; do not reverse the entire VAT record on a partial refund.
Voiding a linked receipt reverses its settlement/COGS and reopens the receivable;
the invoice continues to own its VAT until separately cancelled.

Sales invoice bases subtract line promotions and use recorded tax amounts.
Vendor bills/returns preserve header VAT rather than recomputing it from a
rounded effective rate. Supplier-return tax reduces input VAT in the summary.

## Reporting

`accounting.report-totals.js` owns the P&L breakdown:
- Sales = account 4000 credits less refunds/reversals; reversing a refund restores
  sales without creating another gross sale.
- POS tips → 2300; VAT → 2100; cash rounding → 4100, separate from sales.
- Gross profit = net sales − posted/derived COGS.
- Net profit = gross profit + other income − operating expenses.
- Journal VAT is displayed when journals exist; the TaxRecord totals are shown
  as reconciliation evidence. Differences are warned, never silently merged.
- Posted sales document counts are invoice/direct receipt entries, not payments.

`profit-loss-rows.ts` feeds the UI, CSV and print with the same breakdown. Report
columns align and allow horizontal scrolling locally on small screens.

## Historical data

`server/scripts/reconcile-pos-tax.js --tenant SLUG --order RECEIPT_OR_ID`
is read-only by default (`latest` is supported within the specified tenant).
`--apply` only inserts missing VAT on a paid, unreturned standalone POS receipt
whose VAT journal already matches its stored line/header tax. It refuses linked
invoices, conflicting/reversed records and unresolved refunds. It never rewrites
journals, moves money or clears accounting review flags.

The user's particular receipt remains unidentified; no live financial records
were changed during this work. See `RESUME-accounting-vat-reconciliation.md`.

## Limits

Profit is based on recorded costs; mixed historical COGS coverage still requires
reconciliation. VAT refund allocations, marketplace settlement refunds and
historical incorrectly posted rounding need explicit review/adjustments. Do not
present unposted/needs_review orders as reconciled financial history.
