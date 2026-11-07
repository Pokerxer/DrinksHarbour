// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import VenueMenu from './venue-menu';
import POSVenueCheckout from './pos-venue-checkout';
vi.mock('@/app/shared/point-of-sale/store', () => ({
  usePOSAuth: () => ({ token: 'token' }), usePOSUI: () => ({ setActiveView: vi.fn() }),
  usePOSCart: () => ({ items: [{ subProductId: 'sub', sizeId: 'size', quantity: 1, price: 1000, discount: 0 }], tableBinding: { serviceSessionId: 'visit', version: 1 }, bindTable: vi.fn(), clearCart: vi.fn(), unbindTable: vi.fn(), discountValue: 0, appliedRewards: [] }),
}));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const line = { lineId: 'line', revision: 1, subProductId: 'sub', sizeId: 'size', name: 'Bottle', quantity: 1, unitPriceMinor: 100000, netMinor: 100000, taxMinor: 0 };
for (const surface of ['booking', 'pos']) test(`${surface}_can_freeze_and_settle_an_unchanged_served_item_absent_from_the_menu`, async () => {
  let state = 'open'; let saves = 0;
  vi.stubGlobal('fetch', vi.fn(async (url: string, options?: RequestInit) => {
    if (url.endsWith('/menu')) return { ok: true, json: async () => ({ data: [] }) };
    if (options?.method === 'PUT') { saves++; return { ok: false, json: async () => ({ message: 'Beverage or size not found' }) }; }
    if (url.endsWith('/bill') && options?.method === 'POST') state = 'unpaid';
    if (url.endsWith('/collections')) state = 'settled';
    const bill = { sessionId: 'visit', state, version: 1, lineVersion: 1, quoteId: 'quote', lines: [line], totalMinor: 100000, outstandingMinor: state === 'settled' ? 0 : 100000, supportedTenders: ['cash', 'paystack'] };
    return { ok: true, json: async () => ({ data: url.endsWith('/collections') ? { state, bill } : bill }) };
  }));
  render(surface === 'booking' ? <VenueMenu token="token" sessionId="visit" /> : <POSVenueCheckout />);
  await screen.findByText(/1 × Bottle/); fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: /review and freeze/i }));
  fireEvent.change(await screen.findByLabelText(/cash received/i), { target: { value: '1000' } });
  fireEvent.click(screen.getByRole('button', { name: /record cash payment/i }));
  expect(await screen.findByText(/payment settled/i)).toBeTruthy(); expect(saves).toBe(0);
});
test('stock_conflict_and_reload_preserve_editing_and_allow_a_reduced_quantity_retry', async () => {
  let state = 'open', version = 1, quantity = 2, freezes = 0;
  vi.stubGlobal('fetch', vi.fn(async (url: string, options?: RequestInit) => {
    if (url.endsWith('/menu')) return { ok: true, json: async () => ({ data: [{ _id: 'size', subProductId: 'sub', name: 'Bottle', price: 1000 }] }) };
    if (options?.method === 'PUT') { const body = JSON.parse(String(options.body)) as { expectedVersion: number; lines: { quantity: number }[] }; expect(body.expectedVersion).toBe(version); quantity = body.lines[0].quantity; version++; }
    if (url.endsWith('/bill') && options?.method === 'POST') {
      freezes++; if (freezes === 1) return { ok: false, json: async () => ({ message: 'Insufficient unreserved stock at this venue' }) };
      state = 'unpaid'; version++;
    }
    return { ok: true, json: async () => ({ data: { sessionId: 'visit', state, version, lineVersion: version, quoteId: 'q', lines: [{ ...line, quantity }], totalMinor: quantity * 100000, supportedTenders: ['paystack'] } }) };
  }));
  render(<VenueMenu token="token" sessionId="visit" />);
  await screen.findByLabelText('Quantity for Bottle'); fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(screen.getByRole('button', { name: /review and freeze/i }));
  await screen.findByText(/insufficient unreserved stock/i);
  expect(screen.getByLabelText('Quantity for Bottle')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Quantity for Bottle'), { target: { value: '1' } });
  version++; fireEvent.click(screen.getByRole('button', { name: /reload checkout status/i }));
  await waitFor(() => expect((screen.getByLabelText('Quantity for Bottle') as HTMLInputElement).value).toBe('1'));
  await waitFor(() => expect(screen.queryByText(/insufficient unreserved stock/i)).toBeNull());
  // Reload may remount the checkout, so wait for the fresh bill and confirm age when needed.
  await waitFor(() => expect(screen.getByRole('checkbox')).toBeTruthy());
  if (!(screen.getByRole('checkbox') as HTMLInputElement).checked) fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: /review and freeze/i }));
  expect(await screen.findByRole('button', { name: /pay with paystack/i })).toBeTruthy();
  expect(screen.queryByLabelText('Quantity for Bottle')).toBeNull(); expect(quantity).toBe(1);
});
