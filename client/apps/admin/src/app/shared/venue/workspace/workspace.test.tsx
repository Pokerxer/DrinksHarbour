// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import VenueWorkspace from './workspace';
vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { user: { token: 'test' } },
    status: 'authenticated',
  }),
}));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const config = {
  locationId: 'one',
  version: 1,
  profileVersion: 1,
  publication: 'reviewed',
  profile: {
    slug: 'main',
    name: 'Main lounge',
    types: ['lounge'],
    timezone: 'Africa/Lagos',
    description: 'Drinks',
    address: 'Abuja',
    hours: [],
    exceptions: [],
    policies: 'Request only',
  },
  menu: { sections: [] },
  floor: { zones: [], tables: [] },
};
function fixture(canManage: boolean) {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async (input: string) =>
        new Response(
          JSON.stringify({
            data: input.endsWith('/locations')
              ? [{ id: 'one', name: 'Main lounge' }]
              : input.endsWith('/requests')
                ? { items: [], next: null }
                : input.endsWith('/catalog')
                  ? { items: [], next: null }
                  : {
                      config,
                      tables: [],
                      visits: [
                        {
                          _id: 'existing',
                          state: 'open',
                          version: 1,
                          businessDate: '2026-10-20',
                        },
                      ],
                      canManage,
                      canonicalCheckoutEnabled: false,
                      readiness: {
                        profile: true,
                        publication: 'reviewed',
                        menu: false,
                      },
                    },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
    ),
  );
}
it('assigned staff get an operational workspace without configuration authority', async () => {
  fixture(false);
  render(<VenueWorkspace />);
  expect(
    await screen.findByRole('heading', { name: 'Lounge workspace' }),
  ).toBeTruthy();
  expect(screen.getByText('No requests at this location.')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Location profile' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Open visit bill' })).toBeNull();
  expect(screen.getByRole('link', { name: 'Open POS' })).toBeTruthy();
});
it('manager profile editing shows the reviewed-publication boundary and keeps failure editable', async () => {
  fixture(true);
  render(<VenueWorkspace />);
  await screen.findByRole('heading', { name: 'Lounge workspace' });
  fireEvent.click(screen.getByRole('button', { name: 'Location profile' }));
  fireEvent.change(screen.getByLabelText('Venue name'), {
    target: { value: 'Updated lounge' },
  });
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            message: 'Configuration changed; reload before saving',
          }),
          { status: 409 },
        ),
    ),
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Save location profile' }),
  );
  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toContain(
      'Configuration changed',
    ),
  );
  expect((screen.getByLabelText('Venue name') as HTMLInputElement).value).toBe(
    'Updated lounge',
  );
  expect(
    screen.getByRole('button', { name: 'Reload venue status' }),
  ).toBeTruthy();
});
