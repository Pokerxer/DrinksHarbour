// @vitest-environment jsdom

import {
  act,
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Modal from './inventory-pricelist-print-modal';
import type { StockRow } from '@/services/warehouseStock.service';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  list: vi.fn(),
  warehouses: vi.fn(),
  catalog: vi.fn(),
  export: vi.fn(),
}));
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { id: 'u1', token: 'token' } } }),
}));
vi.mock('@/context/TenantContext', () => ({
  useTenant: () => ({ tenant: { _id: 't1', name: 'Cellar' } }),
}));
vi.mock('@/services/pricelist.service', () => ({
  pricelistService: { list: mocks.list, get: mocks.get },
}));
vi.mock('@/services/warehouse.service', () => ({
  warehouseService: { getWarehouses: mocks.warehouses },
}));
vi.mock('@/services/subproduct.service', () => ({
  subproductService: { getSubProducts: mocks.catalog },
}));
vi.mock('@/utils/print/document-export', () => ({
  requestDocumentExport: mocks.export,
}));
const rows = [
  {
    _id: 'r1',
    productName: 'Wine',
    subProductId: 's1',
    sizeId: 'sz1',
    sizeName: '75cl',
    categoryName: 'Wine',
    sku: 'W1',
    sellingPrice: 1000,
    wholesalePrice: 500,
    costPrice: 400,
    unitsPerPack: 6,
    currentQuantity: 12,
    warehouseName: 'Cellar',
  },
] as StockRow[];
const list = { _id: 'trade', name: 'Trade', ruleCount: 1 };
beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  mocks.list.mockResolvedValue({ data: { pricelists: [list], total: 1 } });
  mocks.warehouses.mockResolvedValue({
    data: [{ name: 'Cellar', address: { street: 'One Road', city: 'Abuja' } }],
  });
  mocks.get.mockResolvedValue({
    data: {
      ...list,
      rules: [
        {
          priceType: 'discount',
          discountType: 'percentage',
          discountPercentage: 10,
        },
      ],
    },
  });
  mocks.catalog.mockResolvedValue({
    data: { subProducts: [], pagination: { hasNext: false } },
  });
});
afterEach(cleanup);
const open = () => render(<Modal open rows={rows} onClose={() => {}} />);
it('exports named columns with the full selected rules and independent retail prices', async () => {
  open();
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'PDF' }).hasAttribute('disabled')
    ).toBe(false)
  );
  fireEvent.click(screen.getByRole('button', { name: /Trade/ }));
  await waitFor(() => expect(screen.getByText('NGN 900.00')).toBeTruthy());
  fireEvent.click(screen.getByRole('button', { name: 'Move column 2 up' }));
  fireEvent.click(screen.getByRole('button', { name: 'PDF' }));
  const model = mocks.export.mock.calls[0][0];
  expect(model.table.columns.map((c: { label: string }) => c.label)).toEqual([
    'Product',
    'Size',
    'Trade',
    'Recommended Sales Price',
  ]);
  expect(
    model.table.rows[1].slice(2).map((c: { text: string }) => c.text)
  ).toEqual(['NGN 900.00', 'NGN 1,000.00']);
});
it('blocks export through rule loading and failed requests and allows retry', async () => {
  let fail!: (error: Error) => void;
  mocks.get.mockImplementation(
    () =>
      new Promise((_, reject) => {
        fail = reject;
      })
  );
  open();
  fireEvent.click(await screen.findByRole('button', { name: /Trade/ }));
  expect(
    screen.getByRole('button', { name: 'PDF' }).hasAttribute('disabled')
  ).toBe(true);
  await act(async () => fail(new Error('Rules unavailable')));
  expect(await screen.findByText(/Rules unavailable/)).toBeTruthy();
  expect(
    screen.getByRole('button', { name: 'PDF' }).hasAttribute('disabled')
  ).toBe(true);
  mocks.get.mockResolvedValue({ data: { ...list, rules: [] } });
  fireEvent.click(screen.getByRole('button', { name: 'Retry loading' }));
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'PDF' }).hasAttribute('disabled')
    ).toBe(false)
  );
});
it('restores a selected list without clearing it while its directory is still loading', async () => {
  localStorage.setItem(
    'dh-inventory-pricelist-print-v2:t1:u1',
    JSON.stringify({
      columns: [{ plId: 'trade', label: 'Trade', mode: 'unit' }],
    })
  );
  let loaded!: (value: unknown) => void;
  mocks.list.mockImplementation(
    () =>
      new Promise((resolve) => {
        loaded = resolve;
      })
  );
  open();
  expect(screen.getByLabelText('Column 1 heading').getAttribute('value')).toBe(
    'Trade'
  );
  expect(
    screen.getByRole('button', { name: 'PDF' }).hasAttribute('disabled')
  ).toBe(true);
  await act(async () => loaded({ data: { pricelists: [list], total: 1 } }));
  await waitFor(() => expect(screen.getByText('NGN 900.00')).toBeTruthy());
});
it('select mode requires a product choice instead of exporting the current view', async () => {
  open();
  fireEvent.click(screen.getByRole('button', { name: 'Choose products…' }));
  await screen.findByText(
    'Choose at least one product or return to the current view.'
  );
  expect(
    screen.getByRole('button', { name: 'PDF' }).hasAttribute('disabled')
  ).toBe(true);
});

it('ignores a late response from a deselected pricelist', async () => {
  mocks.list.mockResolvedValue({
    data: {
      pricelists: [list, { _id: 'other', name: 'Other', ruleCount: 1 }],
      total: 2,
    },
  });
  let complete!: (value: unknown) => void;
  mocks.get.mockImplementation((id: string) =>
    id === 'trade'
      ? new Promise((resolve) => {
          complete = resolve;
        })
      : Promise.resolve({
          data: {
            _id: 'other',
            name: 'Other',
            rules: [
              {
                priceType: 'discount',
                discountType: 'percentage',
                discountPercentage: 20,
              },
            ],
          },
        })
  );
  open();
  fireEvent.click(await screen.findByRole('button', { name: /Trade/ }));
  await waitFor(() => expect(complete).toBeTypeOf('function'));
  fireEvent.click(screen.getByRole('button', { name: /Trade/ }));
  fireEvent.click(screen.getByRole('button', { name: /Other/ }));
  await screen.findByText('NGN 800.00');
  await act(async () =>
    complete({
      data: { ...list, rules: [{ priceType: 'fixed', fixedPrice: 1 }] },
    })
  );
  fireEvent.click(screen.getByRole('button', { name: 'PDF' }));
  const model = mocks.export.mock.calls[0][0];
  expect(model.table.rows[1][3].text).toBe('NGN 800.00');
  expect(model.table.columns[3].label).toBe('Other');
});
it('loads later catalogue pages before exporting a selected product', async () => {
  mocks.catalog.mockImplementation((_token: string, params: { page: number }) =>
    Promise.resolve({
      data: {
        subProducts: [
          {
            _id: `p${params.page}`,
            productName: `Wine ${params.page}`,
            sellingPrice: 500,
            category: 'Wine',
            sellWithoutSizeVariants: true,
          },
        ],
        pagination: { hasNext: params.page === 1 },
      },
    })
  );
  open();
  fireEvent.click(screen.getByRole('button', { name: 'Choose products…' }));
  fireEvent.click(screen.getByRole('button', { name: 'Products' }));
  const second = await screen.findByText('Wine 2');
  fireEvent.click(second);
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'PDF' }).hasAttribute('disabled')
    ).toBe(false)
  );
  fireEvent.click(screen.getByRole('button', { name: 'PDF' }));
  const model = mocks.export.mock.calls[0][0];
  expect(model.table.rows[1][0].text).toBe('Wine 2');
  expect(model.table.rows[1][2].text).toBe('NGN 500.00');
});

it('restores the screenshot pack columns and exports formula totals and labelled wholesale fallback', async () => {
  localStorage.setItem(
    'dh-inventory-pricelist-print-v2:t1:u1',
    JSON.stringify({
      columns: [
        { plId: '', label: 'Recommended Sales Price', mode: 'unit' },
        { plId: 'cost', label: 'Cost price', mode: 'bundle' },
        { plId: 'wholesale', label: 'Wholesale Price', mode: 'bundle' },
      ],
    })
  );
  mocks.list.mockResolvedValue({
    data: {
      pricelists: [
        { _id: 'cost', name: 'Cost price' },
        { _id: 'wholesale', name: 'Wholesale Price' },
      ],
      total: 2,
    },
  });
  mocks.get.mockImplementation((id: string) =>
    Promise.resolve({
      data: {
        _id: id,
        name: id,
        rules:
          id === 'cost'
            ? [
                {
                  priceType: 'formula',
                  markupBase: 'wholesale',
                  markupPercentage: 7.5,
                },
              ]
            : [
                {
                  priceType: 'bundle',
                  subProduct: 'other-product',
                  bundleQuantity: 6,
                  bundleDiscountType: 'markup_on_cost',
                  bundleDiscount: 18.4,
                  bundleMarkupBase: 'wholesale',
                },
              ],
      },
    })
  );
  open();
  await screen.findByText('NGN 3,225.00');
  expect(screen.getByText('NGN 3,000.00')).toBeTruthy();
  expect(screen.queryByText('Saved wholesale price')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'PDF' }));
  const cells = mocks.export.mock.calls[0][0].table.rows[1];
  expect(cells.slice(2).map((c: { text: string }) => c.text)).toEqual([
    'NGN 1,000.00',
    'NGN 3,225.00',
    'NGN 3,000.00',
  ]);
});
