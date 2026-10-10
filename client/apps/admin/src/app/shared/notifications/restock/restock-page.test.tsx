// @vitest-environment jsdom
import React from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import RestockPage from './restock-page';
let warehouse = '',
  purchase = true,
  extraProducts = 0;
const offer = {
  offerId: 'offer',
  vendorId: 'vendor',
  vendorName: 'Supplier',
  currency: 'NGN',
  quantity: 6,
  packagingQty: 1,
  minQuantity: 1,
  maxQuantity: null,
  unitPrice: 10,
};
vi.mock('../insights/use-insight-plan', () => ({
  useInsightPlan: () => ({
    scope: 'tenant',
    loading: false,
    error: '',
    refresh: vi.fn(),
    data: {
      generatedAt: '2026-10-09',
      coverDays: 14,
      warnings: [],
      warehouses: [],
      canSeeDemand: true,
      canSeeStock: true,
      canPurchase: purchase,
      lines: [
        'Wine',
        'Beer',
        ...Array.from({ length: extraProducts }, (_, i) => `Product ${i}`),
      ].map((productName, i) => ({
        key: productName,
        productName,
        warehouseId: 'main',
        warehouseName: 'Main',
        sizeName: '75cl',
        sku: '',
        subProductId: 'p',
        sizeId: 's',
        available: 10,
        productImage: 'https://example.com/wine.jpg',
        units30: i ? 30 : 5,
        selected: offer,
        alternatives: [offer],
      })),
    },
  }),
}));
vi.mock('../insights/insight-controls', () => ({
  default: () => null,
  usePlanningFilters: () => ({ query: '', warehouseId: warehouse }),
}));
vi.mock('../vendor-orders/vendor-order-groups', () => ({
  default: ({
    groups,
  }: {
    groups: Array<{
      lines: Array<{ productName: string; selected: { quantity: number } }>;
    }>;
  }) => (
    <output data-testid="order-groups">
      {groups
        .flatMap((g) => g.lines)
        .map((l) => `${l.productName}:${l.selected.quantity}`)
        .join(',')}
    </output>
  ),
}));
afterEach(() => {
  cleanup();
  warehouse = '';
  purchase = true;
  extraProducts = 0;
});
it('keeps edited quantities in complete order groups while search and status hide products', () => {
  render(<RestockPage />);
  fireEvent.click(screen.getByRole('button', { name: /View Wine/ }));
  fireEvent.change(screen.getByLabelText('Order units for Wine at Main'), {
    target: { value: '12' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Close restock details' })
  );
  fireEvent.change(
    screen.getByRole('searchbox', { name: 'Search restock products' }),
    { target: { value: 'Beer' } }
  );
  expect(screen.queryByRole('heading', { name: /Wine 75cl/ })).toBeNull();
  expect(screen.getByTestId('order-groups').textContent).toBe('Wine:12,Beer:6');
  fireEvent.click(screen.getByRole('button', { name: 'Clear product search' }));
  expect(screen.getByRole('heading', { name: /Wine 75cl/ })).toBeTruthy();
  fireEvent.change(screen.getByRole('combobox', { name: 'Sort products' }), {
    target: { value: 'sales' },
  });
  expect(
    screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
  ).toEqual(['Beer 75cl', 'Wine 75cl']);
  fireEvent.click(
    screen.getByRole('button', { name: 'Filter: Needs supplier' })
  );
  expect(screen.queryByRole('heading', { name: /Wine 75cl/ })).toBeNull();
  expect(screen.getByTestId('order-groups').textContent).toBe('Wine:12,Beer:6');
  fireEvent.click(screen.getByRole('button', { name: 'Reset filters' }));
  expect(screen.getByRole('heading', { name: /Wine 75cl/ })).toBeTruthy();
});

it('warehouse selections keep unrelated destination rows out of quantities and orders', () => {
  warehouse = 'other';
  render(<RestockPage />);
  expect(screen.queryByRole('heading', { name: /Wine 75cl/ })).toBeNull();
  expect(screen.getByTestId('order-groups').textContent).toBe('');
});
it('purchasing permission removal hides all order editing and preparation', () => {
  purchase = false;
  render(<RestockPage />);
  expect(screen.queryByRole('button', { name: /View Wine/ })).toBeNull();
  expect(screen.queryByTestId('order-groups')).toBeNull();
  expect(screen.getByText(/Purchasing access is required/)).toBeTruthy();
});

it('cards hide editors and evidence; named dialog closes and restores focus', async () => {
  render(<RestockPage />);
  const card = screen.getByRole('button', { name: /View Wine/ });
  expect(
    within(card).getByRole('img', { name: 'Wine' }).getAttribute('src')
  ).toContain('wine.jpg');
  expect(screen.queryByLabelText('Supplier for Wine at Main')).toBeNull();
  expect(screen.queryByText('Why this recommendation?')).toBeNull();
  card.focus();
  fireEvent.click(card);
  const dialog = screen.getByRole('dialog', { name: /Wine 75cl/ });
  expect(
    within(dialog).getByLabelText('Supplier for Wine at Main')
  ).toBeTruthy();
  expect(
    within(dialog)
      .getByRole('link', { name: /Review warehouse supply/ })
      .getAttribute('href')
  ).toContain('warehouseId=main');
  fireEvent.click(
    within(dialog).getByRole('button', { name: 'Close restock details' })
  );
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(card));
  fireEvent.click(card);
  fireEvent.keyDown(document.activeElement || document, { key: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
});
it('editing a product out of the active filter keeps its modal open and preserves its exclusion', () => {
  render(<RestockPage />);
  fireEvent.click(
    screen.getByRole('button', { name: 'Filter: Order quantities ready' })
  );
  fireEvent.click(screen.getByRole('button', { name: /View Wine/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Exclude from order' }));
  expect(screen.getByRole('dialog')).toBeTruthy();
  expect(
    (screen.getByLabelText('Order units for Wine at Main') as HTMLInputElement)
      .value
  ).toBe('0');
  fireEvent.click(
    screen.getByRole('button', { name: 'Close restock details' })
  );
  expect(screen.queryByRole('button', { name: /View Wine/ })).toBeNull();
  expect(screen.getByTestId('order-groups').textContent).toBe('Beer:6');
  fireEvent.click(screen.getByRole('button', { name: 'Reset filters' }));
  fireEvent.click(screen.getByRole('button', { name: /View Wine/ }));
  expect(
    (screen.getByLabelText('Order units for Wine at Main') as HTMLInputElement)
      .value
  ).toBe('0');
});

it('an edit that removes the last filtered page keeps the active product editor open', () => {
  extraProducts = 49;
  render(<RestockPage />);
  fireEvent.click(
    screen.getByRole('button', { name: 'Filter: Order quantities ready' })
  );
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  fireEvent.click(screen.getByRole('button', { name: /View Wine/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Exclude from order' }));
  expect(screen.getByRole('dialog', { name: /Wine 75cl/ })).toBeTruthy();
  expect(
    (screen.getByLabelText('Order units for Wine at Main') as HTMLInputElement)
      .value
  ).toBe('0');
});
