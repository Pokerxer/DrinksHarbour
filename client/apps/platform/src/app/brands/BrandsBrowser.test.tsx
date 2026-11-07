import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import BrandsBrowser from './BrandsBrowser';
import type { BrandCardData } from './brand-results';
const brands: BrandCardData[] = [
  { _id: 'a', name: 'Alpha', slug: 'alpha', countryOfOrigin: 'France', productCount: 0 },
  { _id: 'b', name: 'Beta', slug: 'beta', countryOfOrigin: 'Italy', productCount: 3 },
  { _id: 'g', name: 'Glenfiddich', slug: 'glenfiddich', countryOfOrigin: 'Scotland' },
];
const response = (list: BrandCardData[]) => ({ ok: true, json: async () => ({ success: true, data: { brands: list, pagination: { page: 1, pages: 1, total: list.length } } }) });
beforeEach(() => { vi.useFakeTimers(); vi.stubGlobal('fetch', vi.fn(async () => response(brands))); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
async function settle() { await act(async () => { vi.advanceTimersByTime(450); }); }
async function click(name: string) { await act(async () => { fireEvent.click(screen.getByRole('button', { name })); }); }
it('allows switching directly between populated initial letters', async () => {
  render(<BrandsBrowser initialBrands={brands} />);
  await settle();
  await click('A');
  expect((screen.getByRole('button', { name: 'B' }) as HTMLButtonElement).disabled).toBe(false);
  await click('B');
  expect(screen.getByRole('link', { name: /Beta/ })).toBeTruthy();
  expect(screen.queryByRole('link', { name: /Alpha/ })).toBeNull();
});
it('keeps a chosen letter after clearing a previous search through debounce', async () => {
  render(<BrandsBrowser initialBrands={brands} />);
  fireEvent.change(screen.getByPlaceholderText(/Search brands by name/), { target: { value: 'glen' } });
  await settle();
  await click('G');
  await settle();
  expect(screen.getByRole('button', { name: 'G' }).getAttribute('aria-pressed')).toBe('true');
});
it('sorts locally without refetching a complete server seed', async () => {
  render(<BrandsBrowser initialBrands={brands} />);
  fireEvent.change(screen.getByRole('combobox', { name: 'Sort brands' }), { target: { value: 'name_desc' } });
  expect(screen.getAllByRole('link').filter(link => link.getAttribute('href')?.startsWith('/brands/')).map(link => link.getAttribute('href')))
    .toEqual(['/brands/glenfiddich', '/brands/beta', '/brands/alpha']);
  expect(fetch).not.toHaveBeenCalled();
});
it('retains the full country selector while narrowing results', async () => {
  render(<BrandsBrowser initialBrands={brands} />);
  fireEvent.change(screen.getByRole('combobox', { name: 'Country of origin' }), { target: { value: 'France' } });
  await act(async () => {});
  expect(screen.getByRole('option', { name: 'Italy' })).toBeTruthy();
  expect(screen.getByRole('option', { name: 'Scotland' })).toBeTruthy();
});
it('treats a successful empty server seed as an empty directory, not a loading failure', async () => {
  render(<BrandsBrowser initialBrands={[]} />);
  await settle();
  expect(fetch).not.toHaveBeenCalled();
  expect(screen.getByRole('heading', { name: 'No brands found' })).toBeTruthy();
});
it('ignores an older response after a newer search completes', async () => {
  const requests: ((value: unknown) => void)[] = [];
  vi.stubGlobal('fetch', vi.fn(() => new Promise(resolve => requests.push(resolve))));
  render(<BrandsBrowser initialBrands={brands} />);
  fireEvent.change(screen.getByPlaceholderText(/Search brands by name/), { target: { value: 'old' } });
  await settle();
  fireEvent.change(screen.getByPlaceholderText(/Search brands by name/), { target: { value: 'new' } });
  await settle();
  await act(async () => requests[1](response([brands[1]])));
  await act(async () => requests[0](response([brands[0]])));
  expect(screen.getByRole('link', { name: /Beta/ })).toBeTruthy();
  expect(screen.queryByRole('link', { name: /Alpha/ })).toBeNull();
});
it('announces failed searches separately from empty results and supports retry', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('Connection lost')).mockResolvedValue(response([brands[1]])));
  render(<BrandsBrowser initialBrands={brands} />);
  fireEvent.change(screen.getByPlaceholderText(/Search brands by name/), { target: { value: 'alias' } });
  await settle();
  expect(screen.getByRole('alert').textContent).toContain('Connection lost');
  expect(screen.queryByRole('heading', { name: 'No brands found' })).toBeNull();
  expect(screen.getByRole('status').textContent).toContain('Results unavailable');
  await click('Retry');
  expect(screen.getByRole('link', { name: /Beta/ })).toBeTruthy();
});
it('keeps unknown totals distinct from zero after server and client loading fail', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Service unavailable')));
  render(<BrandsBrowser initialError="Could not load brands. Please try again." />);
  await act(async () => {});
  expect(screen.getByRole('alert').textContent).toContain('Service unavailable');
  expect(screen.queryAllByText('0', { exact: true })).toHaveLength(0);
});
