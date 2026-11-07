// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import WaitlistPanel from './waitlist-panel';
import type { WaitlistEntryDTO } from '@/services/venue/waitlist';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const waiting: WaitlistEntryDTO = {
  id: 'wl1',
  locationId: 'loc1',
  occurrenceId: null,
  name: 'Ada Obi',
  phone: '+2348012345678',
  verifiedContactRoute: 'sms',
  partySize: 4,
  window: { earliestAt: '2026-11-04T19:00:00.000Z', latestAt: '2026-11-04T23:00:00.000Z' },
  acceptableZones: ['terrace'],
  state: 'waiting',
  offer: null,
  version: 0,
  createdBy: 'staff-1',
  createdAt: '2026-11-04T18:00:00.000Z',
};

const offered: WaitlistEntryDTO = {
  ...waiting,
  id: 'wl2',
  name: 'Bola',
  state: 'offered',
  version: 1,
  offer: {
    at: '2026-11-04T19:10:00.000Z',
    expiresAt: '2026-11-04T19:25:00.000Z',
    claimRef: 'claim1',
    bookingRef: 'book1',
  },
};

const accepted: WaitlistEntryDTO = {
  ...waiting,
  id: 'wl3',
  name: 'Chidi',
  verifiedContactRoute: 'email',
  state: 'accepted',
  version: 2,
  offer: { at: '2026-11-04T19:10:00.000Z', expiresAt: '2026-11-04T19:25:00.000Z', claimRef: 'claim2', bookingRef: 'abcdef123456' },
};

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify({ data: body }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

function fetcher(over: { error?: { code: string; message: string } } = {}) {
  return vi.fn(async (url: string, options?: RequestInit) => {
    const method = options?.method ?? 'GET';
    if (method !== 'GET' && over.error) throw Object.assign(new Error(over.error.message), { code: over.error.code });
    if (method === 'POST' && String(url).includes('/offer')) {
      expect((JSON.parse((options as RequestInit).body as string) as { input: { bookingAt: string } }).input.bookingAt).toBeTruthy();
      return jsonResponse({ ...waiting, state: 'offered', version: 1 });
    }
    return jsonResponse({ items: [waiting, offered, accepted], next: null });
  });
}

it('lists the queue with state chips, windows and party size; resolved entries show the booking linkage', async () => {
  const f = fetcher();
  vi.stubGlobal('fetch', f);
  render(<WaitlistPanel token="t" locationId="loc1" />);
  expect(await screen.findByText(/ada obi · party of 4/i)).toBeTruthy();
  expect(screen.getAllByText(/contact: sms/i).length).toBe(2); // waiting + offered entries carry the recorded contact route
  expect(screen.getAllByText(/zones: terrace/i).length).toBe(2); // the queue rows (waiting + offered) name the acceptable zones
  expect(screen.getByText(/table held — offer expires/i)).toBeTruthy();
  expect(screen.getByText(/booking 123456/i)).toBeTruthy(); // accepted → booking linkage (last 6 of bookingRef)
  expect(screen.getByText(/chidi/i)).toBeTruthy(); // resolved section shows the settled entries
  expect(screen.getByText(/table held — offer expires/i)).toBeTruthy();
  expect(screen.getByText(/booking 123456/i)).toBeTruthy(); // accepted → booking linkage (last 6 of bookingRef)
});

it('offers one candidate a table through the 12 §5 entry route with the entry version', async () => {
  const f = fetcher();
  vi.stubGlobal('fetch', f);
  render(<WaitlistPanel token="t" locationId="loc1" />);
  fireEvent.click(await screen.findByRole('button', { name: /offer table/i }));
  await waitFor(() => expect(f.mock.calls.some(([, options]) => (options as RequestInit).method === 'POST')).toBe(true));
  const [url, options] = f.mock.calls.find(([, options]) => (options as RequestInit).method === 'POST') as [string, RequestInit];
  expect(url).toContain('/api/venue-ops/waitlist/wl1/offer'); // the 12 §5 shape — the ENTRY, no locationId
  expect((JSON.parse(options.body as string) as { expectedVersion: number }).expectedVersion).toBe(0);
  expect(await screen.findByText(/table offered to ada obi/i)).toBeTruthy();
});

it('renders a deny chip with the server domain code (e.g. an expired offer can never confirm)', async () => {
  const f = fetcher({ error: { code: 'WAITLIST_OFFER_EXPIRED', message: 'The waitlist offer expired; the held table was released and nothing was confirmed or charged' } });
  vi.stubGlobal('fetch', f);
  render(<WaitlistPanel token="t" locationId="loc1" />);
  fireEvent.click(await screen.findByRole('button', { name: /offer table/i }));
  expect(await screen.findByText(/waitlist_offer_expired/i)).toBeTruthy();
});
