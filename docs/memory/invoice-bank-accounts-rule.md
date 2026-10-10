---
name: invoice-bank-accounts-rule
description: A tenant's invoice remittance account must come only from Tenant.bankAccounts and needs both a bank name and a digits-only account number. The bankName/bankAccountName/bankAccountNumber trio is the settlement (payout) account and must never print on a customer invoice.
type: memory
---

# Invoice bank accounts: one rule, four places

A sales invoice (and the POS receipt) prints the accounts a **customer pays
into**. Those come from exactly one field: `Tenant.bankAccounts`, the array the
Settings → Bank Accounts form writes.

## The two accounts are not the same

The `Tenant` model carries two unrelated sets of bank fields, and the tenant form
labels them so:

| Field | Form label | Whose money |
|---|---|---|
| `bankAccounts[]` | "Invoice Bank Accounts — shown to customers on POS invoices" | money **in** from a customer |
| `bankName` / `bankAccountName` / `bankAccountNumber` | "Settlement Account — where this tenant's **payouts** are sent" | money **out** to the tenant |

The settlement trio is where Paystack pays the tenant. It is **not** a customer
remittance destination and must never reach a printed invoice — a customer
transfer sent there goes the wrong way. A first implementation read the
settlement trio as a fallback and was corrected; see
`docs/superpowers/specs/RESUME-sales-invoice-account-details.md`.

## A row needs both halves

A row prints only with a bank name **and** an account number. Half a row is not
payable, and "Account Number: 0123…" with no bank is not a usable instruction.

This has to hold at **save** time, not just print time. The writers used to
accept a bank name **OR** a number, so an account number with no bank saved
cleanly, looked correct in Settings, and then silently never appeared on any
invoice. The rule now lives in one place per side and is shared:

- Server: `server/utils/bankAccounts.js`
  (`normalizeBankAccounts` / `printableBankAccounts` / `validateBankAccounts`),
  used by `pos.controller.js` (`updateTenantBankAccounts`),
  `tenant.controller.js` (`buildTenantData` — throws `ValidationError`, it has
  no `res`), and `salesOrder.controller.js` (`getSalesOrder`).
- Client: `client/apps/admin/src/app/shared/point-of-sale/bank-account-rules.ts`,
  used by both Settings forms and mirrored by `printableBankAccounts` in
  `utils/print/so-print.ts`.

Digits only, ≤20 characters — **not** a hard 10-digit Nigerian rule, because the
platform also bills USD/EUR/GBP. `accountName` is optional.

## Printed on every sales document

Sales order, pro-forma **and quotation**. Quotations were initially excluded
("nothing is owed until it is accepted") and it was reported as a bug: with the
block simply absent, a quotation was indistinguishable from a tenant whose bank
account had failed to save. A quote here is commonly converted *by* paying it,
so the customer needs the account while deciding. The block is omitted only when
the tenant has no usable account.

Note that quotations render on screen through `SalesQuotationDetail`, not
`SalesInvoiceView` — a PDF-only change leaves the quotation page and its PDF
disagreeing. Both surfaces carry the block.

## Before changing any of this

Adding a fourth writer, or loosening a filter, re-opens the gap where Settings
and the printed document disagree. Add the new writer to the shared helper
instead. Existing half-filled rows in `Tenant.bankAccounts` were never cleaned
up; the print-time filter drops them, so those invoices are correct but missing
an account.
