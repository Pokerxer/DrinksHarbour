// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import DoorPanel from './door-panel';
import type { DoorOccurrenceDTO, RedemptionDTO } from '@/services/venue/door';
import type { HostAlertDTO } from '@/services/venue/guestlists';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const occurrence: DoorOccurrenceDTO = {
  id: 'occ1',
  locationId: 'loc1',
  eventSlug: 'afro-night',
  name: 'Afro Night',
  occurrenceDate: '2026-11-04',
  startAt: '2026-11-04T22:00:00.000Z',
  endAt: '2026-11-05T02:00:00.000Z',
  capacity: { maxGuests: 200 },
  guestsAdmitted: 12,
  agePolicy: { minimumAge: 18, admissionTerms: '18+ with valid ID at the door.' },
  admissionPolicy: { maxReEntries: 1 },
};

const redemption: RedemptionDTO = {
  id: 'r1',
  occurrenceId: 'occ1',
  entitlementId: 'e1',
  token: 'gl-abc',
  guests: 4,
  kind: 'entry',
  reEntryOf: null,
  at: '2026-11-04T23:00:00.000Z',
  by: 'staff-1',
  deviceId: null,
};

const alert: HostAlertDTO = {
  id: 'a1',
  occurrenceId: 'occ1',
  kind: 'vip_arrival',
  name: 'Derin',
  partySize: 4,
  action: 'admitted',
  provenance: { flaggedBy: 'staff-1', reason: 'Birthday host', at: '2026-11-04T20:00:00.000Z' },
  acknowledged: false,
  acknowledgedBy: null,
  createdAt: '2026-11-04T23:00:00.000Z',
};

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify({ data: body }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

function doorFetcher(over: { scan?: () => Response; error?: { code: string; message: string } } = {}) {
  return vi.fn(async (url: string, options?: RequestInit) => {
    const method = options?.method ?? 'GET';
    if (method === 'POST' && String(url).includes('/redeem')) {
      if (over.error) throw Object.assign(new Error(over.error.message), { code: over.error.code });
      return over.scan ? over.scan() : jsonResponse({ name: 'Ada Obi', partySize: 4, result: 'admitted' });
    }
    if (method === 'GET' && String(url).includes('/redemptions')) return jsonResponse({ items: [redemption], next: null });
    if (method === 'GET' && String(url).includes('/host-alerts')) return jsonResponse({ items: [alert], next: null });
    return jsonResponse({ items: [occurrence] });
  });
}

it('lists assigned occurrences with the cap readout and scans a token through the door route', async () => {
  const fetcher = doorFetcher();
  vi.stubGlobal('fetch', fetcher);
  render(<DoorPanel token="t" locationId="loc1" />);
  expect(await screen.findByText(/afro night — 2026-11-04/i)).toBeTruthy();
  expect(screen.getByText(/admitted 12 of 200/i)).toBeTruthy();
  expect(screen.getByText(/188 slots left/i)).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Admission token'), { target: { value: 'gl-token-1' } });
  fireEvent.change(screen.getByLabelText('Guests'), { target: { value: '2' } });
  fireEvent.click(screen.getByRole('button', { name: /scan/i }));
  await waitFor(() => expect(fetcher.mock.calls.some(([, options]) => (options as RequestInit).method === 'POST')).toBe(true));
  const call = fetcher.mock.calls.find(([, options]) => (options as RequestInit).method === 'POST');
  const [url, options] = call as [string, RequestInit];
  expect(url).toContain('/api/venue-ops/locations/loc1/events/occ1/redeem');
  expect(JSON.parse(options.body as string)).toEqual({ token: 'gl-token-1', guests: 2, ageVerified: true });
  expect(await screen.findByText(/admitted — ada obi \(4\)/i)).toBeTruthy();
});

it('renders a deny chip with the server domain code and never shows more than the minimum details', async () => {
  const fetcher = doorFetcher({ error: { code: 'TOKEN_ALREADY_USED', message: 'This admission token has already been used' } });
  vi.stubGlobal('fetch', fetcher);
  render(<DoorPanel token="t" locationId="loc1" />);
  fireEvent.change(await screen.findByLabelText('Admission token'), { target: { value: 'gl-token-1' } });
  fireEvent.click(screen.getByRole('button', { name: /scan/i }));
  expect(await screen.findByText(/token_already_used/i)).toBeTruthy();
  // the ledger and VIP alerts render their permitted fields only
  expect(screen.getByText(/birthday host/i)).toBeTruthy();
  expect(screen.queryByText(/restricted/i)).toBeNull();
});

it('switches to re-entry mode (no age attestation needed for guests already admitted)', async () => {
  const fetcher = doorFetcher({ scan: () => jsonResponse({ name: 'Ada Obi', partySize: 4, result: 're_entered' }) });
  vi.stubGlobal('fetch', fetcher);
  render(<DoorPanel token="t" locationId="loc1" />);
  await screen.findByText(/afro night — 2026-11-04/i);
  fireEvent.change(screen.getByLabelText('Scan mode'), { target: { value: 're-entry' } });
  fireEvent.change(screen.getByLabelText('Admission token'), { target: { value: 'gl-token-1' } });
  fireEvent.click(screen.getByRole('button', { name: /scan/i }));
  await waitFor(() => expect(fetcher.mock.calls.some(([, options]) => (options as RequestInit).method === 'POST')).toBe(true));
  const [url] = fetcher.mock.calls.find(([, options]) => (options as RequestInit).method === 'POST') as [string, RequestInit];
  expect(url).toContain('/redeem-reentry');
  expect(await screen.findByText(/re-entered — ada obi \(4\)/i)).toBeTruthy();
});
