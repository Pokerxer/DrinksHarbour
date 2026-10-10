// client/apps/admin/src/app/shared/point-of-sale/bank-account-rules.ts
//
// The one rule for an invoice bank account, shared by both Settings forms and
// mirrored by the server and the printed document.
//
// Why this exists: the server used to accept a row with a bank name OR an
// account number, while the invoice printed a row only when it had BOTH. So an
// account could be saved in Settings, show as saved, and then never appear on
// any invoice — a silent failure with the operator none the wiser. One rule,
// stated once, so "what you can save" equals "what will print".
//
// What must NOT be here: the tenant's settlement account (`bankName` /
// `bankAccountNumber` / `bankAccountName`). That is where Paystack pays the
// tenant out. It is a different account and never goes on a customer invoice.

export interface BankAccountRow {
  bankName: string;
  accountNumber: string;
  accountName: string;
}

/** Nigerian accounts are 10 digits; the platform also bills USD/EUR/GBP. */
const MAX_ACCOUNT_NUMBER = 20;

export function isBlankRow(row: BankAccountRow): boolean {
  return (
    !row.bankName?.trim() && !row.accountNumber?.trim() && !row.accountName?.trim()
  );
}

/**
 * The problem with this row, or null when it is fine.
 *
 * A wholly blank row is not an error — it is the empty row "Add bank account"
 * leaves behind, and the server discards it. A half-filled row is: an account
 * number with no bank, or a bank with no number, cannot be paid into and must
 * not be saved as though it could.
 */
export function bankAccountError(
  row: BankAccountRow,
  all: BankAccountRow[] = [],
  index = -1
): string | null {
  if (isBlankRow(row)) return null;

  const bankName = row.bankName?.trim() ?? '';
  const accountNumber = row.accountNumber?.trim() ?? '';

  if (!accountNumber) return 'Enter the account number customers should pay into';
  if (!bankName) return 'Enter the bank name for this account number';
  if (!/^\d+$/.test(accountNumber)) return 'Account number must be digits only';
  if (accountNumber.length > MAX_ACCOUNT_NUMBER)
    return `Account number must be ${MAX_ACCOUNT_NUMBER} digits or fewer`;

  // A duplicate prints twice on the same invoice and reads as a mistake. Only
  // flag the later row, so the message ("already listed above") points at the
  // entry to delete rather than blaming the one you entered first.
  const clash = all.some(
    (other, i) => i < index && other?.accountNumber?.trim() === accountNumber
  );
  return clash ? 'This account number is already listed above' : null;
}

/** Problem per row index, for rendering inline. */
export function bankAccountErrors(rows: BankAccountRow[]): Record<number, string> {
  const out: Record<number, string> = {};
  rows.forEach((row, i) => {
    const error = bankAccountError(row, rows, i);
    if (error) out[i] = error;
  });
  return out;
}

/** True when at least one row would be saved in a state the invoice drops. */
export function hasBlockingBankAccountError(rows: BankAccountRow[]): boolean {
  return Object.keys(bankAccountErrors(rows)).length > 0;
}
