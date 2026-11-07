// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import VenueCompletion from './venue-completion';
const auth = vi.hoisted(() => ({ token: 'token' }));
vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { user: { token: auth.token, role: 'tenant_owner' } },
    status: 'authenticated',
  }),
}));
vi.mock('./venue-checkout', () => ({
  default: ({ sessionId }: { sessionId: string }) => (
    <p>Existing bill {sessionId}</p>
  ),
}));
afterEach(() => {
  cleanup();
  auth.token = 'token';
  vi.unstubAllGlobals();
});
it('opens an existing eligible visit without offering a new booking or stock order', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            data: {
              items: [
                {
                  id: 'visit',
                  location: 'Main lounge',
                  tables: ['Table 1'],
                  openedAt: '2026-10-19T19:00:00Z',
                  timezone: 'Africa/Lagos',
                },
              ],
              next: null,
            },
          }),
        ),
    ),
  );
  render(<VenueCompletion />);
  fireEvent.click(
    await screen.findByRole('button', { name: 'Open existing bill' }),
  );
  expect(screen.getByText('Existing bill visit')).toBeTruthy();
  expect(
    screen.queryByRole('button', { name: /new visit|new booking/i }),
  ).toBeNull();
});

it('a late response cannot replace the current account’s open visits', async () => {
  let finishOld!: (response: Response) => void;
  const row = (name: string) =>
    new Response(
      JSON.stringify({
        data: {
          items: [
            {
              id: name,
              location: name,
              tables: ['Table 1'],
              openedAt: '2026-10-19T19:00:00Z',
              timezone: 'Africa/Lagos',
            },
          ],
          next: null,
        },
      }),
    );
  vi.stubGlobal(
    'fetch',
    vi.fn((url, options) =>
      options.headers.Authorization === 'Bearer token'
        ? new Promise<Response>((resolve) => {
            finishOld = resolve;
          })
        : Promise.resolve(row('New account lounge')),
    ),
  );
  const view = render(<VenueCompletion />);
  auth.token = 'other';
  view.rerender(<VenueCompletion />);
  await screen.findByText(/New account lounge/);
  await act(async () => {
    finishOld(row('Old account lounge'));
  });
  expect(screen.queryByText(/Old account lounge/)).toBeNull();
  expect(screen.getByText(/New account lounge/)).toBeTruthy();
});

it('announces visits awaiting action and focuses the first pending visit', async () => {
  const row = (name: string) => ({
    id: name,
    location: name,
    tables: ['Table 1'],
    openedAt: '2026-10-19T19:00:00Z',
    timezone: 'Africa/Lagos',
  });
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            data: {
              items: [row('First lounge'), row('Second lounge')],
              next: null,
            },
          }),
        ),
    ),
  );
  render(<VenueCompletion />);
  // Visible count of pending work…
  await screen.findByText(/Visits awaiting action: 2/);
  // …and an sr-only polite announcement of the same figure.
  expect(screen.getByText(/2 visits awaiting action\./)).toBeTruthy();
  // The first pending visit button receives focus for keyboard users.
  const pending = screen.getAllByRole('button', {
    name: 'Open existing bill',
  });
  await waitFor(() => expect(document.activeElement).toBe(pending[0]));
});
