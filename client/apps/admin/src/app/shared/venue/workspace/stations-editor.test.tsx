// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import StationsEditor from './stations-editor';
import type { StationDTO } from '@/services/venue/ops';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const station: StationDTO = {
  id: 'st1',
  locationId: 'loc1',
  name: 'Grill',
  categories: ['grill'],
  staffIds: ['staff-1'],
  deviceIds: [],
  alertThresholdMins: 8,
  isDefault: false,
  version: 3,
  createdAt: null,
};

function stationResponse(body: unknown) {
  return new Response(JSON.stringify({ data: body }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

/** The one captured call of the given method, as {url, options}. */
function callOf(fetcher: { mock: { calls: unknown[][] } }, method: string) {
  const call = fetcher.mock.calls.find(([, options]) => (options as RequestInit).method === method);
  expect(call, `expected a ${method} call`).toBeTruthy();
  const [url, options] = call as [string | URL | Request, RequestInit | undefined];
  return { url: String(url), options: options as RequestInit };
}

it('lists the location stations and creates one through the S3 route', async () => {
  const fetcher = vi.fn(async (url: string, options?: RequestInit) => {
    if (url.endsWith('/stations') && options?.method === 'POST')
      return stationResponse(station);
    return stationResponse({ items: [station] });
  });
  vi.stubGlobal('fetch', fetcher);
  render(<StationsEditor token="t" locationId="loc1" />);
  expect(await screen.findByText(/alert after 8 min/i)).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Station name'), { target: { value: 'Bar' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create station' }));
  await waitFor(() => expect(fetcher.mock.calls.some(([, options]) => (options as RequestInit).method === 'POST')).toBe(true));
  const { url, options } = callOf(fetcher, 'POST');
  expect(url).toContain('/api/venue-ops/locations/loc1/stations');
  const body = JSON.parse(options.body as string) as { input: { name: string } };
  expect(body.input).toEqual({ name: 'Bar', categories: [], staffIds: [], deviceIds: [], alertThresholdMins: 15, isDefault: false });
});

it('edits a station with its optimistic version and the category/threshold config', async () => {
  const fetcher = vi.fn(async (url: string, options?: RequestInit) => {
    if (options?.method === 'PATCH') return stationResponse({ ...station, version: 4, name: 'Grill v2' });
    return stationResponse({ items: [station] });
  });
  vi.stubGlobal('fetch', fetcher);
  render(<StationsEditor token="t" locationId="loc1" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
  fireEvent.change(screen.getByLabelText(/Alert threshold \(minutes\)/), { target: { value: '12' } });
  fireEvent.click(screen.getByLabelText('Default station for unmapped categories'));
  fireEvent.click(screen.getByRole('button', { name: 'Save station' }));
  await waitFor(() => expect(fetcher.mock.calls.some(([, options]) => (options as RequestInit).method === 'PATCH')).toBe(true));
  const { url, options } = callOf(fetcher, 'PATCH');
  expect(url).toContain('/api/venue-ops/locations/loc1/stations/st1');
  const body = JSON.parse(options.body as string) as { expectedVersion: number; input: { alertThresholdMins: number; isDefault: boolean } };
  expect(body.expectedVersion).toBe(3); // the caller view of the version, per the optimistic contract
  expect(body.input.alertThresholdMins).toBe(12);
  expect(body.input.isDefault).toBe(true);
});

it('surfaces a server rejection instead of losing the edit', async () => {
  const fetcher = vi.fn(async (_url: string, options?: RequestInit) =>
    options?.method === 'PATCH'
      ? new Response(JSON.stringify({ message: 'Station changed elsewhere; reload before saving' }), { status: 409, headers: { 'Content-Type': 'application/json' } })
      : stationResponse({ items: [station] }),
  );
  vi.stubGlobal('fetch', fetcher);
  render(<StationsEditor token="t" locationId="loc1" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save station' }));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('changed elsewhere'));
});

it('registers the device bridge, shows the token once with a copy affordance, and revokes', async () => {
  const token = 'bridge-token-plaintext';
  const fetcher = vi.fn(async (url: string, options?: RequestInit) => {
    if (url.endsWith('/device-bridge/register')) return stationResponse({ token, registeredAt: '2026-10-28T00:00:00.000Z' });
    if (url.endsWith('/device-bridge/revoke')) return stationResponse({ registered: false });
    return stationResponse({ items: [station] });
  });
  vi.stubGlobal('fetch', fetcher);
  const writeText = vi.fn(async () => undefined);
  Object.assign(navigator, { clipboard: { writeText } });
  render(<StationsEditor token="t" locationId="loc1" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Register bridge token' }));
  // The raw token appears in the UI exactly once, with the shown-once warning.
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain(token));
  expect(screen.getByRole('status').textContent).toContain('shown once');
  const register = fetcher.mock.calls.find(([url, options]) => String(url).endsWith('/device-bridge/register') && (options as RequestInit).method === 'POST');
  expect(register).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Copy token' }));
  await waitFor(() => expect(writeText).toHaveBeenCalledWith(token));
  fireEvent.click(screen.getByRole('button', { name: 'Revoke bridge access' }));
  await waitFor(() => expect(fetcher.mock.calls.some(([url]) => String(url).endsWith('/device-bridge/revoke'))).toBe(true));
  await waitFor(() => expect(screen.queryByText(token)).toBeNull());
});
