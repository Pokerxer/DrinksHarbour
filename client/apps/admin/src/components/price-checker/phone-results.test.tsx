// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { mergeScan, PhoneResults, type Checked } from './phone-results';

afterEach(cleanup);

const hit = (name: string, price: number, barcode: string): Checked => ({
  barcode,
  product: { name, price, currency: 'NGN', alcoholic: true, taxLabel: '', size: '75cl' },
});

it('keeps every successful bottle visible and opens the exact record', () => {
  const results = Array.from({ length: 14 }, (_, index) => hit(`Wine ${index + 1}`, 42000, String(index)));
  const onSelect = vi.fn();
  const onRemove = vi.fn();
  const onClear = vi.fn();
  render(<PhoneResults results={results} onSelect={onSelect} onRemove={onRemove} onClear={onClear} />);
  expect(screen.getByRole('heading', { name: 'Scan history (14)' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'View details for Wine 14, 75cl' }));
  expect(onSelect).toHaveBeenCalledWith(results[13]);
  fireEvent.click(screen.getByRole('button', { name: 'Remove Wine 14, 75cl from history' }));
  expect(onRemove).toHaveBeenCalledWith('13');
  fireEvent.click(screen.getByRole('button', { name: 'Clear history' }));
  expect(onClear).toHaveBeenCalledOnce();
});

it('refreshes a repeated barcode without dropping any other bottles', () => {
  const one = hit('Wine', 42000, '001');
  const two = hit('Whisky', 38000, '002');
  const refreshed = hit('Wine', 41000, '001');
  expect(mergeScan(mergeScan([one], two), refreshed)).toEqual([refreshed, two]);
});
