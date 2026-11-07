// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import CoursesPanel from './courses-panel';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** Open-visit snapshot (GET bill): courses echo + lines with courseId/firedQuantity. */
const snapshot = {
  sessionId: 'visit1',
  state: 'open' as const,
  version: 5,
  lineVersion: 2,
  lines: [
    { lineId: 'l1', revision: 1, subProductId: 's1', sizeId: 'z1', name: 'Jollof', quantity: 2, unitPriceMinor: 1000, netMinor: 2000, taxMinor: 0, firedQuantity: 0, courseId: 'starters' },
    { lineId: 'l2', revision: 1, subProductId: 's2', sizeId: 'z2', name: 'Wine', quantity: 1, unitPriceMinor: 500, netMinor: 500, taxMinor: 0, firedQuantity: 1, courseId: 'mains' },
  ],
  courses: [
    { courseId: 'starters', name: 'Starters', order: 0, state: 'planned' as const },
    { courseId: 'mains', order: 1, state: 'hold' as const },
  ],
};

function snapshotResponse(body: unknown) {
  return new Response(JSON.stringify({ data: body }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

/** The one captured call of the given method, as {url, options}. */
function callOf(fetcher: { mock: { calls: unknown[][] } }, method: string) {
  const call = fetcher.mock.calls.find(([, options]) => (options as RequestInit).method === method);
  expect(call, `expected a ${method} call`).toBeTruthy();
  const [url, options] = call as [string | URL | Request, RequestInit | undefined];
  return { url: String(url), options: options as RequestInit };
}

function fixture(overrides: Record<string, unknown> = {}) {
  return vi.fn(async (url: string, options?: RequestInit) => {
    if (options?.method && options.method !== 'GET') return snapshotResponse({ ok: true });
    return snapshotResponse({ ...snapshot, ...overrides });
  });
}

it('renders server-owned course states with unfired counts derived from the lines', async () => {
  const fetcher = fixture();
  vi.stubGlobal('fetch', fetcher);
  render(<CoursesPanel token="t" visits={[{ _id: 'visit1', state: 'open' }, { _id: 'visit2', state: 'closed' }]} />);
  expect(await screen.findByText('2 unfired units')).toBeTruthy();
  expect(screen.getByText('0 unfired units')).toBeTruthy();
  expect(screen.getByText('Planned')).toBeTruthy();
  expect(screen.getByText('On hold')).toBeTruthy();
  // only the open visit is selectable
  expect((screen.getByLabelText(/Visit/) as HTMLSelectElement).options.length).toBe(1);
});

it('fires a course through the S3 route with the visit version, then reloads', async () => {
  const fetcher = fixture();
  vi.stubGlobal('fetch', fetcher);
  render(<CoursesPanel token="t" visits={[{ _id: 'visit1', state: 'open' }]} />);
  await screen.findByText('2 unfired units');
  fireEvent.click(screen.getAllByRole('button', { name: 'Fire' })[0]);
  await waitFor(() => expect(fetcher.mock.calls.some(([, options]) => (options as RequestInit).method === 'POST')).toBe(true));
  const { url, options } = callOf(fetcher, 'POST');
  expect(url).toContain('/api/venue-ops/service-sessions/visit1/courses/starters/fire');
  expect(JSON.parse(options.body as string)).toEqual({ expectedVersion: 5 });
});

it('saves the full ordered registry through courses.set', async () => {
  const fetcher = fixture();
  vi.stubGlobal('fetch', fetcher);
  render(<CoursesPanel token="t" visits={[{ _id: 'visit1', state: 'open' }]} />);
  await screen.findByText('2 unfired units');
  fireEvent.click(screen.getByRole('button', { name: 'Save registry' }));
  await waitFor(() => expect(fetcher.mock.calls.some(([, options]) => (options as RequestInit).method === 'PUT')).toBe(true));
  const { url, options } = callOf(fetcher, 'PUT');
  expect(url).toContain('/api/venue-ops/service-sessions/visit1/courses');
  expect(JSON.parse(options.body as string)).toEqual({
    expectedVersion: 5,
    courses: [{ courseId: 'starters', name: 'Starters' }, { courseId: 'mains' }],
  });
});

it('keeps a failed command visible instead of pretending it landed', async () => {
  const fetcher = vi.fn(async (url: string, options?: RequestInit) => {
    if (options?.method === 'POST')
      return new Response(JSON.stringify({ message: 'Course was already fired' }), { status: 409, headers: { 'Content-Type': 'application/json' } });
    return snapshotResponse(snapshot);
  });
  vi.stubGlobal('fetch', fetcher);
  render(<CoursesPanel token="t" visits={[{ _id: 'visit1', state: 'open' }]} />);
  await screen.findByText('2 unfired units');
  fireEvent.click(screen.getAllByRole('button', { name: 'Fire' })[0]);
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('already fired'));
});
