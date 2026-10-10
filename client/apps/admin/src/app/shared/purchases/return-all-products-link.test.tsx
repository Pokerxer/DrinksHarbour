// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import ReturnAllProductsLink from './return-all-products-link';
import { routes } from '@/config/routes';
afterEach(cleanup);
it('opens the reviewable return form for the exact invoice and purchase order', () => {
  render(<ReturnAllProductsLink purchaseOrderId="po1" billId="bill1" />);
  const link = screen.getByRole('link', { name: 'Return all products' });
  const url = new URL(link.getAttribute('href')!, 'https://example.com');
  expect(url.pathname).toBe(routes.eCommerce.createVendorReturn);
  expect(Object.fromEntries(url.searchParams)).toEqual({ po: 'po1', all: '1', bill: 'bill1' });
});
