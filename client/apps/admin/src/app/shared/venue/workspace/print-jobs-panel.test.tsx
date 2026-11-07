// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import PrintJobsPanel from './print-jobs-panel';
import type { PrintJobsListDTO } from '@/services/venue/ops';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const jobs: PrintJobsListDTO['jobs'] = [
  {
    id: '5f0a1b2c3d4e5f6a7b8c9d01',
    jobId: 'pj:0123456789abcdef0123',
    sessionId: 's1',
    locationId: 'loc1',
    stationId: 'st1',
    roundId: '5f0a1b2c3d4e5f6a7b8c9d02',
    lineIds: ['l1', 'l2'],
    actionType: 'print',
    deliveryState: 'delivered',
    attempts: 1,
    payload: { sessionId: 's1', roundNo: 2, items: [] },
    createdAt: null,
  },
  {
    id: '5f0a1b2c3d4e5f6a7b8c9d03',
    jobId: 'pj:fedcba9876543210fedc',
    sessionId: 's1',
    locationId: 'loc1',
    stationId: 'st1',
    lineIds: ['l1'],
    actionType: 'reprint',
    duplicateOf: 'pj:0123456789abcdef0123',
    deliveryState: 'failed',
    attempts: 5,
    lastError: 'Delivery attempts exceeded cap (5)',
    payload: { roundNo: 2, label: 'REPRINT', reprintOf: 'pj:0123456789abcdef0123', items: [] },
    createdAt: null,
  },
];

const visits = [{ _id: 's1', state: 'open' }];

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify({ data: body }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

it('lists the visit print jobs newest-first with state chips and duplicate labels', async () => {
  const fetcher = vi.fn(async () => jsonResponse({ sessionId: 's1', locationId: 'loc1', jobs }));
  vi.stubGlobal('fetch', fetcher);
  render(<PrintJobsPanel token="t" visits={visits} />);
  expect(await screen.findByText('Delivered')).toBeTruthy();
  expect(screen.getByText('Failed')).toBeTruthy();
  // The reprint is a visibly labelled duplicate pointing at the original job.
  const duplicate = screen.getByText(/duplicate of pj:0123456789abcdef0123/i);
  expect(duplicate.textContent).toContain('REPRINT');
  // Failed jobs surface the server's lastError, never a guessed reason.
  expect(screen.getByText(/Delivery attempts exceeded cap/i)).toBeTruthy();
  expect(screen.getByText(/5 delivery attempts/i)).toBeTruthy();
});

it('reprints through the staff route with the shared Idempotency-Key idiom', async () => {
  const fetcher = vi.fn(async (_url: string, options?: RequestInit) => {
    if (options?.method === 'POST') return jsonResponse({ ...jobs[0], actionType: 'reprint' });
    return jsonResponse({ sessionId: 's1', locationId: 'loc1', jobs });
  });
  vi.stubGlobal('fetch', fetcher);
  render(<PrintJobsPanel token="t" visits={visits} />);
  fireEvent.click((await screen.findAllByRole('button', { name: 'Reprint' }))[0]);
  await waitFor(() => expect(fetcher.mock.calls.some(([, options]) => (options as RequestInit).method === 'POST')).toBe(true));
  const call = fetcher.mock.calls.find(([, options]) => (options as RequestInit).method === 'POST');
  const [url, options] = call as [string | URL, RequestInit];
  expect(String(url)).toContain('/api/venue-ops/service-sessions/s1/print-jobs/pj:0123456789abcdef0123/reprint');
  expect((options.headers as Record<string, string>)['Idempotency-Key']).toBeTruthy();
  // The panel refetches the ledger after the command (server-owned state).
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('queued'));
});

it('shows an empty state when no open visit can carry print jobs', async () => {
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  render(<PrintJobsPanel token="t" visits={[{ _id: 's9', state: 'closed' }]} />);
  expect(await screen.findByText(/No open visits/i)).toBeTruthy();
  expect(fetcher).not.toHaveBeenCalled();
});
