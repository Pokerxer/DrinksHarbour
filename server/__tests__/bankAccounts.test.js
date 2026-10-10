const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeBankAccounts,
  printableBankAccounts,
  validateBankAccounts,
} = require('../utils/bankAccounts');

const row = (bankName, accountNumber, accountName = '') => ({
  bankName,
  accountNumber,
  accountName,
});

test('normalizeBankAccounts trims before dropping blanks', () => {
  const out = normalizeBankAccounts([
    row('  GTBank  ', '  0123456789 ', '  DrinksHarbour Ltd  '),
    // Whitespace-only used to survive the filter, because the filter ran on
    // the untrimmed value, and was stored as an empty account.
    row('   ', '   ', '   '),
    null,
    'not an object',
    row('', '', ''),
  ]);
  assert.deepStrictEqual(out, [
    { bankName: 'GTBank', accountNumber: '0123456789', accountName: 'DrinksHarbour Ltd' },
  ]);
});

test('normalizeBankAccounts tolerates a missing array', () => {
  assert.deepStrictEqual(normalizeBankAccounts(undefined), []);
  assert.deepStrictEqual(normalizeBankAccounts('nonsense'), []);
});

test('validateBankAccounts accepts a complete account and an empty list', () => {
  assert.strictEqual(validateBankAccounts(normalizeBankAccounts([])), null);
  assert.strictEqual(
    validateBankAccounts(normalizeBankAccounts([row('GTBank', '0123456789')])),
    null
  );
});

test('validateBankAccounts rejects an account number with no bank', () => {
  // The defect this rule exists for: the endpoint used to accept this, so it
  // saved, looked correct in Settings, and never printed on an invoice.
  const problem = validateBankAccounts(normalizeBankAccounts([row('', '0123456789')]));
  assert.match(problem, /both a bank name and an account number/);
});

test('validateBankAccounts rejects a bank with no account number', () => {
  const problem = validateBankAccounts(normalizeBankAccounts([row('GTBank', '')]));
  assert.match(problem, /both a bank name and an account number/);
});

test('validateBankAccounts rejects a non-numeric account number', () => {
  const problem = validateBankAccounts(normalizeBankAccounts([row('GTBank', '0123-4567')]));
  assert.match(problem, /digits only/);
});

test('validateBankAccounts rejects an absurdly long account number', () => {
  const problem = validateBankAccounts(normalizeBankAccounts([row('GTBank', '1'.repeat(21))]));
  assert.match(problem, /20 digits or fewer/);
});

test('validateBankAccounts rejects a duplicated account number', () => {
  const problem = validateBankAccounts(
    normalizeBankAccounts([row('GTBank', '0123456789'), row('Zenith', '0123456789')])
  );
  assert.match(problem, /more than once/);
});

test('validateBankAccounts reports the offending row by position', () => {
  const problem = validateBankAccounts(
    normalizeBankAccounts([row('GTBank', '0123456789'), row('', '9876543210')])
  );
  assert.match(problem, /^Bank account 2/);
});

test('printableBankAccounts returns only rows a customer can actually pay into', () => {
  const out = printableBankAccounts([
    row('', '0123456789'),
    row('Zenith', ''),
    row(' GTBank ', ' 0123456789 '),
  ]);
  assert.deepStrictEqual(out, [
    { bankName: 'GTBank', accountNumber: '0123456789', accountName: '' },
  ]);
});

test('printableBankAccounts ignores the settlement account entirely', () => {
  // A caller must pass the bankAccounts array. The settlement trio is a
  // different account and has no path into a printed invoice.
  const tenant = {
    bankName: 'UBA',
    bankAccountName: 'DrinksHarbour Ltd',
    bankAccountNumber: '3011223344',
  };
  assert.deepStrictEqual(printableBankAccounts(tenant.bankAccounts), []);
});
