// server/utils/bankAccounts.js
//
// The single server-side rule for a tenant's invoice bank accounts.
//
// The printed sales invoice renders an account only when it has a bank name AND
// an account number, so anything less is not payable. Three separate writers
// used to accept looser input than the printer did — a row with an account
// number but no bank name would save cleanly, look correct in Settings, and
// then never appear on a customer invoice. Validate once, here, so every writer
// agrees with the document.
//
// This is deliberately NOT the tenant's settlement account (`bankName` /
// `bankAccountNumber` / `bankAccountName`), which is where the platform pays the
// tenant out and is never printed on a customer invoice.

const MAX_ACCOUNT_NUMBER = 20;

/**
 * Trim and drop blank rows. Blank rows are not an error — they are the empty
 * row an "Add bank account" button leaves behind.
 */
function normalizeBankAccounts(input) {
  return (Array.isArray(input) ? input : [])
    .filter((a) => a && typeof a === 'object')
    .map((a) => ({
      bankName: String(a.bankName ?? '').trim(),
      accountNumber: String(a.accountNumber ?? '').trim(),
      accountName: String(a.accountName ?? '').trim(),
    }))
    .filter((a) => a.bankName || a.accountNumber || a.accountName);
}

/**
 * The same accounts a sales invoice would actually print, in print order.
 * Used to decide whether an order has anywhere to be paid into.
 */
function printableBankAccounts(input) {
  return normalizeBankAccounts(input).filter(
    (a) => a.bankName && a.accountNumber
  );
}

/**
 * Returns null when every row is payable, or a message naming the first row
 * that is not. Callers turn this into a 400 rather than storing a row the
 * printer will drop.
 */
function validateBankAccounts(normalized) {
  for (const [i, a] of normalized.entries()) {
    if (!a.accountNumber || !a.bankName) {
      return `Bank account ${i + 1} needs both a bank name and an account number`;
    }
    if (!/^\d+$/.test(a.accountNumber)) {
      return `Bank account ${i + 1}: account number must be digits only`;
    }
    if (a.accountNumber.length > MAX_ACCOUNT_NUMBER) {
      return `Bank account ${i + 1}: account number must be ${MAX_ACCOUNT_NUMBER} digits or fewer`;
    }
    if (
      normalized.findIndex((o) => o.accountNumber === a.accountNumber) !== i
    ) {
      return `Bank account ${i + 1}: account number is listed more than once`;
    }  }
  return null;
}

module.exports = {
  normalizeBankAccounts,
  printableBankAccounts,
  validateBankAccounts,
  MAX_ACCOUNT_NUMBER,
};
