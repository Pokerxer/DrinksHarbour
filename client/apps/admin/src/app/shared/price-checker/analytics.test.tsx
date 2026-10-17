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
import Analytics from './analytics';
import { priceCheckerApi as api } from '@/services/priceChecker.service';
import type { KioskAnalytics } from './types';

const context = vi.hoisted(() => ({
  token: 'tenant-a',
  kiosk: '',
  status: 'authenticated',
}));
vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { user: { token: context.token } },
    status: context.status,
  }),
}));
vi.mock('next/navigation', () => ({
  useSearchParams: () =>
    new URLSearchParams(context.kiosk ? { kiosk: context.kiosk } : {}),
  usePathname: () => '/retail-tools/price-checker/analytics',
}));
vi.mock('@/services/priceChecker.service', () => ({
  priceCheckerApi: {
    list: vi.fn(),
    analytics: vi.fn(),
  },
}));
function report(total = 15, page = 1): KioskAnalytics {
  return {
    range: { from: '2026-10-01', to: '2026-10-13', page },
    overview: {
      total,
      successful: total,
      unknown: 0,
      uniqueProducts: 1,
      mostActiveKiosk: total ? 'Front counter' : null,
      today: 2,
      week: 8,
      month: 15,
    },
    hours: Array.from({ length: 24 }, (_, hour) => ({
      hour,
      scans: hour === 14 ? total : 0,
    })),
    popular: total
      ? [
          {
            kiosk: 'one',
            kioskName: 'Front counter',
            barcode: '001234',
            productName: 'Sparkling water',
            scans: total,
            currentPrice: 1200,
            currency: 'NGN',
          },
        ]
      : [],
    unknown: [],
    lowStock: [],
    hasMore: page === 1,
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-13T10:00:00Z'));
  vi.resetAllMocks();
  context.token = 'tenant-a';
  context.kiosk = '';
  context.status = 'authenticated';
  vi.mocked(api.list).mockResolvedValue([]);
  vi.mocked(api.analytics).mockResolvedValue(report());
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
async function ready() {
  const view = render(<Analytics />);
  await screen.findByText('Sparkling water');
  return view;
}

test('clears old report immediately when the authenticated account changes', async () => {
  const view = await ready();
  fireEvent.change(screen.getByLabelText('From'), {
    target: { value: '2026-10-03' },
  });
  const next = deferred<KioskAnalytics>();
  vi.mocked(api.analytics).mockReturnValue(next.promise);
  context.token = 'tenant-b';
  view.rerender(<Analytics />);
  expect(screen.queryByText('Sparkling water')).toBeNull();
  expect((screen.getByLabelText('From') as HTMLInputElement).value).toBe(
    '2026-09-14'
  );
  await act(async () => next.resolve(report(0)));
  expect(
    await screen.findByRole('heading', { name: 'No scans in this period' })
  ).toBeDefined();
});

test('changing the kiosk URL loads that kiosk rather than retaining the old report', async () => {
  const view = await ready();
  vi.mocked(api.analytics).mockImplementation(async (query) => ({
    ...report(),
    popular: [
      {
        ...report().popular[0],
        productName:
          query.kiosk === 'second' ? 'Second kiosk water' : 'Wrong kiosk',
      },
    ],
  }));
  context.kiosk = 'second';
  view.rerender(<Analytics />);
  expect(await screen.findByText('Second kiosk water')).toBeDefined();
});

test('kiosk-list failures are visible and retryable without discarding a valid report', async () => {
  vi.mocked(api.list).mockRejectedValue(new Error('Kiosk choices unavailable'));
  await ready();
  expect(await screen.findByText(/Kiosk choices unavailable/)).toBeDefined();
  vi.mocked(api.list).mockResolvedValue([]);
  fireEvent.click(screen.getByRole('button', { name: 'Retry kiosk list' }));
  await waitFor(() =>
    expect(screen.queryByText(/Kiosk choices unavailable/)).toBeNull()
  );
  expect(screen.getByText('Sparkling water')).toBeDefined();
});

test('edited draft filters are explicitly marked while pagination retains the applied scope', async () => {
  vi.mocked(api.analytics).mockImplementation(async (query) => ({
    ...report(15, Number(query.page)),
    popular: [
      {
        ...report().popular[0],
        productName:
          query.kiosk || query.from === '2026-10-03'
            ? 'Wrong scope'
            : 'Sparkling water',
      },
    ],
  }));
  await ready();
  fireEvent.change(screen.getByLabelText('From'), {
    target: { value: '2026-10-03' },
  });
  expect(screen.getByText(/Unapplied changes/)).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(await screen.findByText('Page 2')).toBeDefined();
  expect(screen.getByText(/Unapplied changes/)).toBeDefined();
  expect(screen.getByText('Sparkling water')).toBeDefined();
});

test('empty reports skip the empty chart and redundant table headers', async () => {
  vi.mocked(api.analytics).mockResolvedValue({ ...report(0), hasMore: false });
  render(<Analytics />);
  await screen.findByRole('heading', { name: 'No scans in this period' });
  expect(screen.queryByRole('img')).toBeNull();
  expect(screen.queryByRole('table')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
});

test('a slow older report cannot replace the latest preset response', async () => {
  await ready();
  const old = deferred<KioskAnalytics>();
  vi.mocked(api.analytics)
    .mockReturnValueOnce(old.promise)
    .mockResolvedValueOnce({
      ...report(),
      popular: [{ ...report().popular[0], productName: 'Latest report water' }],
    });
  fireEvent.click(screen.getByRole('button', { name: 'Today' }));
  fireEvent.click(screen.getByRole('button', { name: 'Last 7 days' }));
  await screen.findByText('Latest report water');
  await act(async () => old.resolve(report()));
  expect(screen.queryByText('Sparkling water')).toBeNull();
  expect(screen.getByText('Latest report water')).toBeDefined();
});

test('failed reports hide old totals and retry the applied dates rather than edited drafts', async () => {
  await ready();
  vi.mocked(api.analytics).mockRejectedValueOnce(
    new Error('Report temporarily unavailable')
  );
  fireEvent.click(screen.getByRole('button', { name: 'Refresh report' }));
  await screen.findByText(/Report temporarily unavailable/);
  expect(screen.queryByText('Sparkling water')).toBeNull();
  fireEvent.change(screen.getByLabelText('From'), {
    target: { value: '2026-10-03' },
  });
  vi.mocked(api.analytics).mockImplementation(async (query) => ({
    ...report(),
    popular: [
      {
        ...report().popular[0],
        productName:
          query.from === '2026-09-14'
            ? 'Applied report water'
            : 'Wrong draft report',
      },
    ],
  }));
  fireEvent.click(screen.getByRole('button', { name: 'Retry report' }));
  await screen.findByText('Applied report water');
  expect(screen.getByText(/Unapplied changes/)).toBeDefined();
});
