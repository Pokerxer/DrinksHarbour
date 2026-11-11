// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { PhonePriceChecker } from './phone-checker';
import { openSession, postPhoneScan } from './phone-api';
import type { KioskConfig, KioskProduct } from '@/components/price-checker/types';

vi.mock('./phone-api', () => ({ openSession: vi.fn(), postPhoneScan: vi.fn() }));
vi.mock('@/components/price-checker/use-offline', () => ({
  useOfflineBook: () => ({ book: null, refresh: vi.fn() }),
}));
vi.mock('@/components/price-checker/phone-scanner', () => ({
  PhoneScanner: ({ onScan }: { onScan: (code: string) => void }) => (
    <>
      <button onClick={() => onScan('001234')}>Capture first bottle</button>
      <button onClick={() => onScan('005678')}>Capture second bottle</button>
      <button onClick={() => onScan('009999')}>Capture unpriced bottle</button>
    </>
  ),
}));

const config = {
  slug: 'counter',
  currency: 'NGN',
  settings: { displayImages: true, enableCompare: true, enablePhoneScan: true },
} as KioskConfig;
const merlot: KioskProduct = {
  name: 'Estate Merlot',
  size: '75cl',
  price: 18000,
  currency: 'NGN',
  taxLabel: '',
  alcoholic: true,
  brand: 'Estate',
  category: 'Red wine',
  subCategory: 'Dry reds',
  grapeVarieties: ['Merlot'],
  description: 'Dark berries and cedar.',
  abv: 13,
};
const openPage = () => render(<PhonePriceChecker slug="counter" session="pair-test-0001" />);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  sessionStorage.clear();
  vi.resetAllMocks();
});

it('retains captured bottles through a failed scan and reopening, and supports details and explicit removal', async () => {
  const stored = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => stored.set(key, value),
    removeItem: (key: string) => stored.delete(key),
  });
  vi.mocked(openSession).mockResolvedValue(config);
  vi.mocked(postPhoneScan).mockImplementation(async (_slug, barcode) => {
    if (barcode === '009999') return { config, found: false, status: 'PRICE_UNAVAILABLE' };
    const product = barcode === '001234' ? merlot : { ...merlot, name: 'Hillside Syrah', size: '1L' };
    return { config, found: true, status: 'FOUND', product };
  });

  const firstVisit = openPage();
  fireEvent.click(await screen.findByRole('button', { name: 'Capture first bottle' }));
  await screen.findByRole('heading', { name: 'Scan history (1)' });
  fireEvent.click(screen.getByRole('button', { name: 'Capture second bottle' }));
  await screen.findByRole('heading', { name: 'Scan history (2)' });
  fireEvent.click(screen.getByRole('button', { name: 'Capture unpriced bottle' }));
  expect((await screen.findByRole('alert')).textContent).toBe('Price unavailable.');
  expect(screen.getByRole('heading', { name: 'Scan history (2)' })).toBeTruthy();
  firstVisit.unmount();

  openPage();
  await screen.findByRole('heading', { name: 'Scan history (2)' });
  fireEvent.click(screen.getByRole('button', { name: 'View details for Estate Merlot, 75cl' }));
  const details = within(screen.getByRole('dialog'));
  expect(details.getByText('Dark berries and cedar.')).toBeTruthy();
  expect(details.getByText('Red wine')).toBeTruthy();
  expect(details.getByText('Merlot', { exact: true })).toBeTruthy();
  fireEvent.click(details.getByRole('button', { name: 'Close details' }));
  fireEvent.click(screen.getByRole('button', { name: 'Remove Estate Merlot, 75cl from history' }));
  expect(screen.getByRole('heading', { name: 'Scan history (1)' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'View details for Hillside Syrah, 1L' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Clear history' }));
  expect(screen.queryByRole('heading', { name: /scan history/i })).toBeNull();
});
