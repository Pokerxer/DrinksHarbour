// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import Dashboard from './dashboard';
import { priceCheckerApi as api } from '@/services/priceChecker.service';
import type { Kiosk, KioskOptions } from './types';

const auth = vi.hoisted(() => ({ token: 'tenant-a', status: 'authenticated' }));
vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { user: { token: auth.token } },
    status: auth.status,
  }),
}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/retail-tools/price-checker',
}));
vi.mock('@/services/priceChecker.service', () => ({
  priceCheckerApi: {
    list: vi.fn(),
    options: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));
const kiosk = {
  _id: 'a',
  name: 'Front counter',
  internalId: '001',
  slug: 'front',
  shopId: 'retail',
  location: 'branch',
  enabled: true,
  currency: 'NGN',
  settings: { resetSeconds: 10, theme: 'light' },
} as Kiosk;
const options = {
  shops: [{ _id: 'retail', name: 'Wyn City' }],
  locations: [{ _id: 'branch', name: 'Maitama' }],
  pricelists: [],
} as unknown as KioskOptions;
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
beforeEach(() => {
  vi.resetAllMocks();
  auth.token = 'tenant-a';
  auth.status = 'authenticated';
  vi.mocked(api.list).mockResolvedValue([kiosk]);
  vi.mocked(api.options).mockResolvedValue(options);
  vi.mocked(api.update).mockResolvedValue({ ...kiosk, enabled: false });
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

test('authentication loading never presents an empty fleet as loaded', () => {
  auth.token = '';
  auth.status = 'loading';
  render(<Dashboard />);
  expect(screen.getByRole('status', { name: 'Loading kiosks' })).toBeDefined();
  expect(
    screen.queryByRole('heading', {
      name: 'Make your first counter scan-ready',
    })
  ).toBeNull();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
async function ready() {
  render(<Dashboard />);
  await screen.findByRole('heading', { name: kiosk.name });
}

test('a confirmed status change appears even if the next list read fails', async () => {
  await ready();
  vi.mocked(api.list).mockRejectedValue(new Error('Refresh unavailable'));
  fireEvent.click(screen.getByRole('button', { name: 'Disable kiosk' }));
  await screen.findByRole('status', { name: '' });
  await waitFor(() =>
    expect(
      screen.getByRole('link', { name: 'Open disabled screen' })
    ).toBeDefined()
  );
  fireEvent.click(screen.getByRole('button', { name: 'Refresh kiosks' }));
  await screen.findByText(/Refresh unavailable/);
  expect(
    screen.getByRole('link', { name: 'Open disabled screen' })
  ).toBeDefined();
});

test('a deleted kiosk disappears without depending on another list request', async () => {
  await ready();
  vi.mocked(api.list).mockRejectedValue(new Error('Refresh unavailable'));
  vi.mocked(api.remove).mockResolvedValue(undefined);
  fireEvent.click(screen.getByRole('button', { name: 'Delete kiosk' }));
  await waitFor(() =>
    expect(screen.queryByRole('heading', { name: kiosk.name })).toBeNull()
  );
  expect(
    screen.getByRole('heading', { name: 'Make your first counter scan-ready' })
  ).toBeDefined();
});

test('a stale refresh cannot overwrite a confirmed status change', async () => {
  await ready();
  const refresh = deferred<Kiosk[]>();
  vi.mocked(api.list).mockReturnValue(refresh.promise);
  fireEvent.click(screen.getByRole('button', { name: 'Refresh kiosks' }));
  fireEvent.click(screen.getByRole('button', { name: 'Disable kiosk' }));
  await waitFor(() =>
    expect(
      screen.getByRole('link', { name: 'Open disabled screen' })
    ).toBeDefined()
  );
  await act(async () => refresh.resolve([kiosk]));
  expect(
    screen.getByRole('link', { name: 'Open disabled screen' })
  ).toBeDefined();
});

test('copy failures offer copy guidance instead of a list refresh action', async () => {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: vi.fn().mockRejectedValue(new Error('Permission denied')),
    },
  });
  await ready();
  fireEvent.click(
    screen.getByRole('button', { name: 'Copy link for Front counter' })
  );
  const alert = await screen.findByRole('alert');
  expect(alert.textContent).toContain('Open the kiosk and copy its address');
  expect(alert.querySelector('button')).toBeNull();
});

test('an old account write cannot add feedback or data to the new account', async () => {
  const update = deferred<Kiosk>();
  vi.mocked(api.update).mockReturnValue(update.promise);
  const view = render(<Dashboard />);
  await screen.findByRole('heading', { name: kiosk.name });
  fireEvent.click(screen.getByRole('button', { name: 'Disable kiosk' }));
  auth.token = 'tenant-b';
  vi.mocked(api.list).mockResolvedValue([]);
  view.rerender(<Dashboard />);
  await screen.findByRole('heading', {
    name: 'Make your first counter scan-ready',
  });
  await act(async () => update.resolve({ ...kiosk, enabled: false }));
  expect(screen.queryByText('Front counter disabled.')).toBeNull();
  expect(screen.queryByRole('heading', { name: kiosk.name })).toBeNull();
});
