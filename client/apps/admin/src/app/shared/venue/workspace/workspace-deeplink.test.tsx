// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import VenueWorkspace from './workspace';
import { resolveVenueTool } from './tool-search';
vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { user: { token: 'test' } },
    status: 'authenticated',
  }),
}));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
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
                      visits: [],
                      canManage,
                      canonicalCheckoutEnabled: true,
                      readiness: { profile: true },
                    },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
    ),
  );
}
it('resolveVenueTool accepts only real workspace tool keys', () => {
  expect(resolveVenueTool('money')).toBe('money');
  expect(resolveVenueTool('practice')).toBe('practice');
  expect(resolveVenueTool('requests')).toBeUndefined();
  expect(resolveVenueTool('../../../etc/passwd')).toBeUndefined();
  expect(resolveVenueTool(undefined)).toBeUndefined();
});
it('restores the deep-linked tool and marks the active pill distinctly', async () => {
  fixture(true);
  render(<VenueWorkspace initialTool="menu" />);
  await screen.findByRole('heading', { name: 'Lounge workspace' });
  const menuPill = screen.getByRole('button', { name: /Beverage menu/ });
  expect(menuPill.getAttribute('aria-pressed')).toBe('true');
  // The overview content is not rendered while the deep-linked tool is shown.
  expect(
    screen.queryByRole('button', { name: /Check booking availability/ }),
  ).toBeNull();
});
it('updates the URL with replaceState when switching tools, no reload', async () => {
  fixture(true);
  render(<VenueWorkspace />);
  await screen.findByRole('heading', { name: 'Lounge workspace' });
  const replaceState = vi.spyOn(window.history, 'replaceState');
  fireEvent.click(screen.getByRole('button', { name: /Payment exceptions/ }));
  expect(screen.getByRole('button', { name: /Payment exceptions/ }).getAttribute('aria-pressed')).toBe('true');
  expect(replaceState).toHaveBeenCalledWith(null, '', '/venue?tool=money');
});
it('a manage-tool deep link falls back to the overview for non-managers', async () => {
  fixture(false);
  render(<VenueWorkspace initialTool="profile" />);
  await screen.findByRole('heading', { name: 'Lounge workspace' });
  // Overview content renders instead of a blank configuration panel.
  expect(
    screen.getByRole('region', { name: 'Requests and arrivals' }),
  ).toBeTruthy();
  expect(screen.queryByLabelText('Venue name')).toBeNull();
});
