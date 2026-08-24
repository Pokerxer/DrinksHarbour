// app/shared/accounting/tax-helpers.test.ts
import { describe, expect, it } from 'vitest';
import { appliesToLabel, fmtMoney, isValidTaxForm } from './tax-helpers';

describe('tax-helpers', () => {
  it('formats naira money', () => {
    expect(fmtMoney(112.5)).toBe('₦ 112.50');
  });
  it('labels full applicability', () => {
    expect(appliesToLabel(['sale', 'purchase', 'transfer', 'return'])).toBe('All flows');
    expect(appliesToLabel(['sale'])).toBe('sale');
  });
  it('validates the tax form', () => {
    expect(isValidTaxForm({ name: 'VAT', rate: '7.5', type: 'output' })).toBe(true);
    expect(isValidTaxForm({ name: '', rate: '7.5', type: 'output' })).toBe(false);
    expect(isValidTaxForm({ name: 'VAT', rate: '150', type: 'output' })).toBe(false);
    expect(isValidTaxForm({ name: 'VAT', rate: '7.5', type: 'other' })).toBe(false);
  });
});
