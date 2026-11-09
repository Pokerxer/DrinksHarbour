// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import KioskEditor from './editor';
import { priceCheckerApi as api } from '@/services/priceChecker.service';
import type { Kiosk, KioskOptions } from './types';

vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { user: { token: 'jwt' } },
    status: 'authenticated',
  }),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/retail-tools/price-checker/create',
}));
vi.mock('@/services/priceChecker.service', () => ({
  priceCheckerApi: {
    options: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}));
const options: KioskOptions = {
  tenantName: 'Shop',
  currency: 'NGN',
  shops: [{ _id: 'retail', name: 'Retail', location: 'branch' }],
  locations: [{ _id: 'branch', name: 'Branch', isDefault: true }],
  pricelists: [],
  defaults: {
    displayImages: true,
    displayTenantName: false,
    displayBrand: true,
    displaySize: true,
    displayStockStatus: true,
    displayStockQuantity: false,
    displayPromotions: true,
    displayDiscountPercentage: true,
    displayStoreName: true,
    displayBarcode: false,
    language: 'en',
    enableCompare: true,
    enablePhoneScan: true,
    manualEntry: true,
    fullscreen: true,
    resetSeconds: 8,
    outOfStock: 'DISPLAY',
    theme: 'light',
    welcomeMessage: '',
    resultMessage: '',
    notFoundMessage: '',
    logo: '',
    background: '',
    accent: '#b20202',
  },
};
const field = (name: string | RegExp) =>
  screen.getByRole('textbox', { name }) as HTMLInputElement;
beforeEach(() => {
  vi.mocked(api.options).mockResolvedValue(options);
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

it('generates identifiers from a new kiosk name, follows edits, normalizes accents and clears with the name', async () => {
  render(<KioskEditor />);
  await screen.findByRole('textbox', { name: 'Kiosk name' });
  fireEvent.change(field('Kiosk name'), {
    target: { value: 'Café Maitama Counter!' },
  });
  expect(field('Internal kiosk ID').value).toBe('CAFE_MAITAMA_COUNTER');
  expect(field(/^URL slug/).value).toBe('cafe-maitama-counter');
  fireEvent.change(field('Kiosk name'), { target: { value: 'Wuse Counter' } });
  expect(field('Internal kiosk ID').value).toBe('WUSE_COUNTER');
  expect(field(/^URL slug/).value).toBe('wuse-counter');
  fireEvent.change(field('Kiosk name'), { target: { value: '' } });
  expect(field('Internal kiosk ID').value).toBe('');
  expect(field(/^URL slug/).value).toBe('');
});

it('keeps independently customized identifiers while continuing automatic untouched fields', async () => {
  render(<KioskEditor />);
  await screen.findByRole('textbox', { name: 'Kiosk name' });
  fireEvent.change(field('Kiosk name'), { target: { value: 'First' } });
  fireEvent.change(field('Internal kiosk ID'), {
    target: { value: 'CUSTOM_01' },
  });
  fireEvent.change(field('Kiosk name'), { target: { value: 'Second' } });
  expect(field('Internal kiosk ID').value).toBe('CUSTOM_01');
  expect(field(/^URL slug/).value).toBe('second');
  fireEvent.change(field(/^URL slug/), { target: { value: 'saved-address' } });
  fireEvent.change(field('Kiosk name'), { target: { value: 'Third' } });
  expect(field(/^URL slug/).value).toBe('saved-address');
  expect(field('Internal kiosk ID').value).toBe('CUSTOM_01');
  fireEvent.click(
    screen.getByRole('button', { name: 'Suggest URL from name' })
  );
  expect(field(/^URL slug/).value).toBe('third');
  fireEvent.change(field('Kiosk name'), { target: { value: 'Fourth' } });
  expect(field(/^URL slug/).value).toBe('fourth');
});

it('preserves existing identifiers when renaming a saved kiosk', async () => {
  vi.mocked(api.get).mockResolvedValue({
    _id: 'existing',
    tenant: 'tenant',
    version: 1,
    createdAt: '',
    name: 'Original',
    internalId: 'ORIGINAL_01',
    slug: 'saved-url',
    shopId: 'retail',
    location: 'branch',
    pricelist: null,
    currency: 'NGN',
    mode: 'STORE_ONLY',
    enabled: true,
    settings: options.defaults,
  } satisfies Kiosk);
  render(<KioskEditor id="existing" />);
  await screen.findByRole('textbox', { name: 'Kiosk name' });
  fireEvent.change(field('Kiosk name'), { target: { value: 'Renamed' } });
  expect(field('Internal kiosk ID').value).toBe('ORIGINAL_01');
  expect(field(/^URL slug/).value).toBe('saved-url');
});

it('submits generated identity values with the configured store and pricing defaults', async () => {
  render(<KioskEditor />);
  await screen.findByRole('textbox', { name: 'Kiosk name' });
  fireEvent.change(field('Kiosk name'), { target: { value: 'Front Counter' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save kiosk' }));
  await waitFor(() =>
    expect(api.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Front Counter',
        internalId: 'FRONT_COUNTER',
        slug: 'front-counter',
        shopId: 'retail',
        location: 'branch',
        currency: 'NGN',
        pricelist: null,
      }),
      'jwt'
    )
  );
});
