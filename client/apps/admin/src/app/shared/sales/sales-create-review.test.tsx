// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import SalesCreateReview from './sales-create-review';
import { salesCreateReadiness } from './sales-create-rules';
afterEach(cleanup);
it('reviews quotation total and expiration with sales-specific confirmation wording', () => {
  render(<SalesCreateReview customer="Ada Bello" validUntil="2026-11-10" productCount={2} subtotal={200} discounts={20} tax={5} shipping={5} total={190} currency="NGN" confirmError="" />);
  expect(screen.getByRole('region', { name: 'Quotation review' })).toBeTruthy();
  expect(screen.getByText('Ada Bello')).toBeTruthy();
  expect(screen.getByText('Quotation expires')).toBeTruthy();
  expect(screen.getByText(/Confirmation creates a sales order/)).toBeTruthy();
});
it('quotation validation rejects invalid line values and dates but permits other currencies', () => {
  const product = { lineType: 'product', subProductId: 'product', quantity: 1, unitPrice: 100 };
  expect(salesCreateReadiness([product], 100, '').confirmError).toBe('');
  expect(salesCreateReadiness([{ ...product, quantity: Infinity }], 100, '').saveError).toMatch(/finite/);
  expect(salesCreateReadiness([{ ...product, unitPrice: -1 }], 100, '').saveError).toMatch(/price/);
  expect(salesCreateReadiness([product], 100, '2026-02-30').saveError).toMatch(/expiration/);
  expect(salesCreateReadiness([product], 0, '').confirmError).toMatch(/positive total/);
});
