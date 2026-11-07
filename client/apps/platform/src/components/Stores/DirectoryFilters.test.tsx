import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import VendorsClient from '@/app/vendors/VendorsClient';

type Request = { url: URL; resolve: (value: unknown) => void; reject: (error: Error) => void };
let requests: Request[];
beforeEach(() => {
  vi.useFakeTimers();
  requests = [];
  vi.stubGlobal('fetch', vi.fn((url: string) => new Promise((resolve, reject) => {
    requests.push({ url: new URL(url), resolve, reject });
  })));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
const store = (name: string) => ({ _id: name, name, slug: name.toLowerCase().replace(/ /g, '-'), productCount: 5 });
async function respond(index: number, name: string, page = 1, pages = 3) {
  await act(async () => requests[index].resolve({ ok: true, json: async () => ({ success: true,
    data: { stores: [store(name)], pagination: { page, pages, total: 3, limit: 16 } } }) }));
}
async function type(placeholder: string, value: string) {
  fireEvent.change(screen.getByPlaceholderText(placeholder), { target: { value } });
  await act(async () => { vi.advanceTimersByTime(450); });
}
it('provides named search, location, sort and clear controls', async () => {
  render(<VendorsClient />);
  expect(screen.getByRole('searchbox', { name: 'Search vendors by name' })).toBeTruthy();
  expect(screen.getByRole('searchbox', { name: 'State or city' })).toBeTruthy();
  expect(screen.getByRole('combobox', { name: 'Sort vendors' })).toBeTruthy();
  await type('Search vendors by name…', 'Wine');
  fireEvent.click(screen.getByRole('button', { name: 'Clear vendor search' }));
  expect((screen.getByRole('searchbox', { name: 'Search vendors by name' }) as HTMLInputElement).value).toBe('');
});
it('sends city/state filtering and sorting to the directory API', async () => {
  render(<VendorsClient />);
  await type('State / city…', '  Abuja  ');
  expect(requests.at(-1)!.url.searchParams.get('location')).toBe('Abuja');
  fireEvent.change(screen.getByRole('combobox', { name: 'Sort vendors' }), { target: { value: 'name_asc' } });
  expect(requests.at(-1)!.url.searchParams.get('sort')).toBe('name_asc');
});
it('ignores stale responses even if the network does not honor cancellation', async () => {
  render(<VendorsClient />);
  await type('Search vendors by name…', 'Old');
  await type('Search vendors by name…', 'New');
  await respond(2, 'New Store');
  await respond(1, 'Old Store');
  expect(screen.getByRole('link', { name: /New Store/ })).toBeTruthy();
  expect(screen.queryByRole('link', { name: /Old Store/ })).toBeNull();
});
it('retries a failed next page without skipping it or discarding loaded stores', async () => {
  render(<VendorsClient />);
  await respond(0, 'First Store');
  fireEvent.click(screen.getByRole('button', { name: 'Load more vendors' }));
  await act(async () => requests[1].reject(new Error('Connection lost')));
  expect(screen.getByRole('link', { name: /First Store/ })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Load more vendors' }));
  expect(requests.at(-1)!.url.searchParams.get('page')).toBe('2');
  await respond(2, 'Second Store', 2);
  expect(screen.getByRole('link', { name: /First Store/ })).toBeTruthy();
  expect(screen.getByRole('link', { name: /Second Store/ })).toBeTruthy();
});
it('recovers when a pending search is cleared before its debounce completes', async () => {
  render(<VendorsClient />);
  fireEvent.change(screen.getByPlaceholderText('Search vendors by name…'), { target: { value: 'temporary' } });
  await respond(0, 'First Store');
  fireEvent.click(screen.getByRole('button', { name: 'Clear vendor search' }));
  await act(async () => { vi.advanceTimersByTime(450); });
  expect(screen.getByRole('link', { name: /First Store/ })).toBeTruthy();
});
