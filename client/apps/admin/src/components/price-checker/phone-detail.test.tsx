// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { KioskProduct } from './types';
import { PhoneDetail } from './phone-detail';

afterEach(() => cleanup());

const product: KioskProduct = {
  name: 'Glenfiddich 12',
  price: 24000,
  originalPrice: 28000,
  savings: 4000,
  currency: 'NGN',
  alcoholic: true,
  taxLabel: 'Includes tax',
  brand: 'Glenfiddich',
  size: '70cl',
  abv: 40,
  volumeMl: 700,
  origin: 'Scotland',
  beverageType: 'spirit',
  availability: 'IN_STOCK',
  barcode: '5010327101577',
};

it('renders the full product record in the sheet', () => {
  render(<PhoneDetail product={product} currency="NGN" onClose={() => {}} />);
  expect(screen.getByRole('dialog', { name: /product details/i })).toBeTruthy();
  expect(screen.getAllByText('Glenfiddich 12').length).toBeGreaterThan(0);
  expect(String(document.body.textContent)).toContain('Includes tax');
  expect(String(document.body.textContent)).toContain('40% ABV');
  expect(String(document.body.textContent)).toContain('Scotland');
  expect(String(document.body.textContent)).toContain('Spirit');
  expect(String(document.body.textContent)).toContain('5010327101577');
  expect(String(document.body.textContent)).toContain('Save');
});

it('dismisses with the close button and Escape', () => {
  const onClose = vi.fn();
  render(<PhoneDetail product={product} currency="NGN" onClose={onClose} />);
  fireEvent.click(screen.getByRole('button', { name: 'Close details' }));
  expect(onClose).toHaveBeenCalledTimes(1);
  fireEvent.keyDown(screen.getByRole('button', { name: 'Close details' }), {
    key: 'Escape',
  });
  expect(onClose).toHaveBeenCalledTimes(2);
});
