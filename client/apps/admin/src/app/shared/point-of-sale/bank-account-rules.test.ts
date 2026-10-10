import { describe, expect, it } from 'vitest';
import {
  bankAccountError,
  bankAccountErrors,
  hasBlockingBankAccountError,
  isBlankRow,
  type BankAccountRow,
} from './bank-account-rules';

const row = (
  bankName: string,
  accountNumber: string,
  accountName = ''
): BankAccountRow => ({ bankName, accountNumber, accountName });

describe('isBlankRow', () => {
  it('treats an untouched row as blank, not as an error', () => {
    expect(isBlankRow(row('', '', ''))).toBe(true);
    expect(isBlankRow(row('   ', '  '))).toBe(true);
  });

  it('treats any typed value as non-blank', () => {
    expect(isBlankRow(row('', '', 'DrinksHarbour Ltd'))).toBe(false);
  });
});

describe('bankAccountError', () => {
  it('accepts a complete account', () => {
    expect(bankAccountError(row('GTBank', '0123456789'))).toBeNull();
    expect(bankAccountError(row('GTBank', '0123456789', 'DrinksHarbour Ltd'))).toBeNull();
  });

  it('accepts a blank row, which the server discards', () => {
    expect(bankAccountError(row('', ''))).toBeNull();
  });

  it('rejects an account number with no bank name', () => {
    // The defect: this saved cleanly, looked right in Settings, and then never
    // printed on the invoice.
    expect(bankAccountError(row('', '0123456789'))).toMatch(/bank name/);
  });

  it('rejects a bank name with no account number', () => {
    expect(bankAccountError(row('GTBank', ''))).toMatch(/account number/);
  });

  it('rejects non-numeric account numbers', () => {
    expect(bankAccountError(row('GTBank', '0123-4567'))).toMatch(/digits only/);
    expect(bankAccountError(row('GTBank', 'ACCT123'))).toMatch(/digits only/);
  });

  it('rejects an account number longer than 20 digits', () => {
    expect(bankAccountError(row('GTBank', '1'.repeat(21)))).toMatch(/20 digits or fewer/);
  });

  it('rejects a duplicate account number', () => {
    const list = [row('GTBank', '0123456789'), row('Zenith', '0123456789')];
    const errors = bankAccountErrors(list);
    // The second row is the duplicate worth removing; the first is fine.
    expect(errors[0]).toBeUndefined();
    expect(errors[1]).toMatch(/already listed/);
  });

  it('compares numbers after trimming', () => {
    const list = [row('GTBank', ' 0123456789 '), row('Zenith', '0123456789')];
    expect(bankAccountErrors(list)[1]).toMatch(/already listed/);
  });
});

describe('hasBlockingBankAccountError', () => {
  it('is false for a list the invoice can print in full', () => {
    expect(
      hasBlockingBankAccountError([row('GTBank', '0123456789'), row('Zenith', '9876543210')])
    ).toBe(false);
  });

  it('is true when any row would be saved but never printed', () => {
    expect(hasBlockingBankAccountError([row('GTBank', '0123456789'), row('Zenith', '')])).toBe(
      true
    );
  });

  it('ignores the trailing empty row an add button leaves behind', () => {
    expect(hasBlockingBankAccountError([row('GTBank', '0123456789'), row('', '')])).toBe(false);
  });
});
