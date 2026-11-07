// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import FloorOps from './floor-ops';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** Open-visit snapshot (GET bill): tableIds + partyGroup echo since S6, plus lines. */
const snapshot = {
  sessionId: 'visit1',
  state: 'open' as const,
  version: 5,
  lineVersion: 2,
  tableIds: ['table1'],
  lines: [],
};

function ok(body: unknown) {
  return new Response(JSON.stringify({ data: body }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

/** GET → the snapshot; POST → the given (success or error) response. */
function fixture(post: () => Response) {
  return vi.fn(async (_url: string, options?: RequestInit) =>
    options?.method && options.method !== 'GET' ? post() : ok({ ...snapshot }),
  );
}

function renderPanel(onChanged = vi.fn()) {
  return render(
    <FloorOps
      token="t"
      visits={[{ _id: 'visit1', state: 'open' }, { _id: 'visit2', state: 'open' }]}
      tables={[
        { _id: 'table1', name: 'T1', status: 'occupied' },
        { _id: 'table2', name: 'T2', status: 'available' },
      ]}
      onChanged={onChanged}
    />,
  );
}

it('lists the open visits and moves the visit to picked free tables with its version', async () => {
  const fetcher = fixture(() => ok({ ok: true }));
  vi.stubGlobal('fetch', fetcher);
  const onChanged = vi.fn();
  renderPanel(onChanged);
  expect(await screen.findByText(/Visit …visit1/)).toBeTruthy();
  expect((screen.getByLabelText('Visit') as HTMLSelectElement).options.length).toBe(2);
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: 'Move visit' }));
  await waitFor(() => expect(fetcher.mock.calls.some(([, options]) => (options as RequestInit).method === 'POST')).toBe(true));
  const call = fetcher.mock.calls.find(([, options]) => (options as RequestInit).method === 'POST') as [string, RequestInit];
  expect(String(call[0])).toContain('/api/venue-ops/service-sessions/visit1/move');
  expect(JSON.parse(call[1].body as string)).toEqual({ targetTableIds: ['table2'], expectedVersion: 5 });
  await waitFor(() => expect(onChanged).toHaveBeenCalled());
});

it('shows the coordinated-payment notice when consolidation is refused with BILL_ALREADY_COLLECTED', async () => {
  const fetcher = fixture(() => new Response(
    JSON.stringify({ success: false, message: 'A bill is already frozen; keep the separate bills', code: 'BILL_ALREADY_COLLECTED' }),
    { status: 409, headers: { 'Content-Type': 'application/json' } },
  ));
  vi.stubGlobal('fetch', fetcher);
  renderPanel();
  await screen.findByText(/Visit …visit1/);
  fireEvent.change(screen.getByLabelText('Visit to fold in'), { target: { value: 'visit2' } });
  fireEvent.click(screen.getByRole('button', { name: 'Consolidate' }));
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('coordinated payment'));
  // A refusal is a notice, not an error — no raw 409 text is shown.
  expect(screen.queryByRole('alert')).toBeNull();
});
