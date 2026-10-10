// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { inventoryService, type InventoryMovement } from '@/services/inventory.service';
import InventoryMovementsBrowser from './inventory-movements-browser';
import { DOCUMENT_EXPORT_EVENT, type DocumentExportRequest } from '@/utils/print/document-export';
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { token: 't' } }, status: 'authenticated' }),
}));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});
const delivery = (id: string, extra: Partial<InventoryMovement> = {}) =>
  ({
    _id: id,
    subProduct: { _id: id, name: `Product ${id}`, sku: `SKU-${id}` },
    warehouse: { _id: 'city', name: 'City' },
    type: 'sold',
    category: 'out',
    quantity: 3,
    quantityBefore: 8,
    quantityAfter: 5,
    totalCost: 30,
    unitCost: 10,
    status: 'confirmed',
    source: 'pos',
    createdAt: '2026-10-04T12:00:00Z',
    ...extra,
  }) as InventoryMovement;
it('shows actual issued stock, pending units, source and historical balances and prints a full delivery note', async () => {
  const rows = [
    delivery('a', {
      reference: 'DL-1',
      relatedOrder: { _id: 'order', orderNumber: 'ORDER-7', receiptNumber: 'SALE-8' },
      notes: 'Full delivery notes',
    }),
    delivery('b', { type: 'shipped', status: 'pending', quantity: 8, source: 'system' }),
    delivery('c', { status: 'cancelled', quantity: 7 }),
  ];
  vi.spyOn(inventoryService, 'getAllMovements').mockResolvedValue({
    movements: rows,
    total: 3,
    truncated: false,
  });
  const events: CustomEvent<DocumentExportRequest>[] = [];
  const listener = (e: Event) => events.push(e as CustomEvent<DocumentExportRequest>);
  window.addEventListener(DOCUMENT_EXPORT_EVENT, listener);
  try {
    render(<InventoryMovementsBrowser preset="deliveries" />);
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: 'Select line' })).toHaveLength(3),
    );
    expect(screen.getByText('Units issued')).toBeTruthy();
    expect(screen.getByText('8 units · 1 pending line')).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: /Source/ })).toBeTruthy();
    expect(screen.getByRole('cell', { name: '8 → 5' })).toBeTruthy();
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Print delivery note for this line' })[0],
    );
    expect(events[0].detail.models[0].sections).toContainEqual({
      title: 'Notes',
      body: 'Full delivery notes',
    });
    expect(events[0].detail.models[0].table.columns.map((c) => c.label)).toContain('Unit cost');
    fireEvent.click(screen.getAllByRole('button', { name: 'Select line' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Print Delivery Note' }));
    expect(events[1].detail.models[0].sections).toContainEqual({
      title: 'Notes',
      body: 'Full delivery notes',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Print history' }));
    expect(events[2].detail.models[0].docTitle).toBe('Delivery history');
    expect(events[2].detail.models[0].table.rows).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: /View delivery DL-1/ }));
    expect(screen.getByRole('link', { name: 'Open order invoice' }).getAttribute('href')).toBe(
      '/ecommerce/orders/order',
    );
  } finally {
    window.removeEventListener(DOCUMENT_EXPORT_EVENT, listener);
  }
});
it('combines multiple products, source and status filters and searches either sales reference', async () => {
  vi.spyOn(inventoryService, 'getAllMovements').mockResolvedValue({
    movements: [
      delivery('a', {
        relatedOrder: { _id: 'order', receiptNumber: 'SALE-8', orderNumber: 'ORDER-7' },
      }),
      delivery('b', { source: 'system' }),
      delivery('c', { status: 'pending' }),
    ],
    total: 3,
    truncated: false,
  });
  render(<InventoryMovementsBrowser preset="deliveries" />);
  await waitFor(() =>
    expect(screen.getAllByRole('button', { name: 'Select line' })).toHaveLength(3),
  );
  fireEvent.focus(screen.getByRole('searchbox', { name: 'Search products' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Product a · SKU-a' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Product b · SKU-b' }));
  fireEvent.change(screen.getByRole('combobox', { name: 'Filter by source' }), {
    target: { value: 'pos' },
  });
  fireEvent.change(screen.getByRole('combobox', { name: 'Filter by status' }), {
    target: { value: 'confirmed' },
  });
  expect(screen.getAllByRole('button', { name: 'Select line' })).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Group By' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save current search' }));
  fireEvent.change(screen.getByPlaceholderText('Name this search…'), {
    target: { value: 'POS products' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  const stored = JSON.parse(localStorage.getItem('dh-inventory-delivery-searches')!)[0];
  expect(stored).toMatchObject({ products: 'a,b', source: 'pos', status: 'confirmed' });
  fireEvent.change(screen.getByRole('textbox', { name: 'Search movements' }), {
    target: { value: 'ORDER-7' },
  });
  expect(screen.getByRole('link', { name: 'Product a' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
  expect(screen.getAllByRole('button', { name: 'Select line' })).toHaveLength(3);
  fireEvent.click(screen.getByRole('button', { name: 'POS products' }));
  expect(
    (screen.getByRole('combobox', { name: 'Filter by source' }) as HTMLSelectElement).value,
  ).toBe('pos');
  expect(screen.getAllByRole('button', { name: 'Select line' })).toHaveLength(1);
});
it('shows unavailable totals and blocks history printing after a failed refresh', async () => {
  const fetch = vi
    .spyOn(inventoryService, 'getAllMovements')
    .mockResolvedValue({ movements: [delivery('a')], total: 1, truncated: false });
  render(<InventoryMovementsBrowser preset="deliveries" />);
  await waitFor(() => expect(screen.getByRole('link', { name: 'Product a' })).toBeTruthy());
  fetch.mockRejectedValueOnce(new Error('Delivery history unavailable'));
  fireEvent.click(screen.getByRole('button', { name: 'Refresh list' }));
  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toContain('Delivery history unavailable'),
  );
  expect(
    within(screen.getByRole('region', { name: 'Delivery totals' })).getAllByText('—'),
  ).toHaveLength(5);
  expect(
    (screen.getByRole('button', { name: 'Print history' }) as HTMLButtonElement).disabled,
  ).toBe(true);
});
it('keeps transfers, returns and scrap outside deliveries and labels capped totals as incomplete', async () => {
  vi.spyOn(inventoryService, 'getAllMovements').mockResolvedValue({
    movements: [
      delivery('sold'),
      delivery('shipped', { type: 'shipped' }),
      delivery('transfer', { type: 'transfer_out', category: 'transfer' }),
      delivery('return', { type: 'return_out' }),
      delivery('scrap', { type: 'damaged' }),
    ],
    total: 10001,
    truncated: true,
  });
  render(<InventoryMovementsBrowser preset="deliveries" />);
  await waitFor(() =>
    expect(screen.getAllByRole('button', { name: 'Select line' })).toHaveLength(2),
  );
  expect(screen.queryByRole('link', { name: 'Product transfer' })).toBeNull();
  expect(screen.queryByRole('link', { name: 'Product return' })).toBeNull();
  expect(screen.queryByRole('link', { name: 'Product scrap' })).toBeNull();
  expect(
    within(screen.getByRole('region', { name: 'Delivery totals' })).getAllByText(
      /Loaded entries only/,
    ),
  ).toHaveLength(5);
  expect(
    (screen.getByRole('button', { name: 'Print history' }) as HTMLButtonElement).disabled,
  ).toBe(true);
  expect((screen.getByRole('button', { name: 'Export CSV' }) as HTMLButtonElement).disabled).toBe(
    true,
  );
});
