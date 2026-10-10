import { expect, test } from 'vitest';
import { receiptTax } from './pos-receipt-tax';

// A tenant that is not VAT-registered: no tax charged, and none invented.
const off = { showTaxOnReceipt: true, taxRate: 7.5, taxEnabled: false };
// A VAT-registered tenant: tax is genuinely charged at the till.
const on = { showTaxOnReceipt: true, taxRate: 7.5, taxEnabled: true };

test('a zero-rated receipt does not acquire the tenant default VAT', () => {
  expect(receiptTax({ total: 2193041.28, taxAmount: 0 }, off)).toEqual({
    label: 'VAT',
    amount: 0,
  });
});

test('charged tax is shown even when the tax breakdown is switched off', () => {
  // A tenant can hide the breakdown and still owe VAT. Suppressing the line
  // would leave the receipt total unexplainable.
  expect(receiptTax({ total: 43000, taxAmount: 3000 }, { ...on, showTaxOnReceipt: false })).toEqual({
    label: 'VAT',
    amount: 3000,
  });
});

test('a tenant that does not owe VAT is never shown an estimated tax line', () => {
  // Asking for a tax breakdown on a receipt is not a reason to invent tax.
  expect(receiptTax({ total: 10805, tipAmount: 50, roundingAmount: 5 }, off)).toBeNull();
});

test('a legacy receipt from a VAT-registered tenant is backed out of its total', () => {
  expect(receiptTax({ total: 10805, tipAmount: 50, roundingAmount: 5 }, on)?.amount).toBe(750);
});

test('the estimate excludes tips and cash rounding from the tax base', () => {
  // Only goods are taxed; a gratuity or a rounding adjustment is not.
  const a = receiptTax({ total: 10805, tipAmount: 50, roundingAmount: 5 }, on)?.amount;
  const b = receiptTax({ total: 10805, tipAmount: 0, roundingAmount: 0 }, on)?.amount;
  expect(a).not.toBe(b);
});

test('a recorded zero beats the estimate even when VAT is switched on', () => {
  expect(receiptTax({ total: 10805, taxAmount: 0 }, on)).toEqual({ label: 'VAT', amount: 0 });
});
