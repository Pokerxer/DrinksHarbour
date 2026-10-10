// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
const rows = Array.from(
  { length: 51 },
  (_, i) =>
    ({
      _id: String(i),
      subProduct: {
        _id: i === 50 ? 'b' : 'a',
        sku: i === 50 ? 'SKU-B' : 'SKU-A',
        name: i === 50 ? 'Beer' : 'Château',
      },
      warehouse: { _id: 'city', name: 'City' },
      quantity: 1,
      type: 'received',
      category: 'in',
      status: 'confirmed',
      totalCost: 10,
      createdAt: new Date(Date.UTC(2026, 9, 4, 12, 0, 51 - i)).toISOString(),
    }) as InventoryMovement,
);
it('sorts all matching rows before pagination and resets the view to newest first', async () => {
  vi.spyOn(inventoryService, 'getAllMovements').mockResolvedValue({
    movements: rows,
    total: 51,
    truncated: false,
  });
  render(<InventoryMovementsBrowser preset="moves" />);
  await waitFor(() =>
    expect(screen.getAllByRole('button', { name: 'Select line' })).toHaveLength(50),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
  expect(screen.getAllByRole('button', { name: 'Select line' })).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Sort by Product' }));
  await waitFor(() =>
    expect(screen.getAllByRole('button', { name: 'Select line' })).toHaveLength(50),
  );
  expect(screen.getAllByRole('link')[0].textContent).toBe('Beer');
  expect(
    screen
      .getByRole('button', { name: 'Sort by Product' })
      .closest('th')!
      .getAttribute('aria-sort'),
  ).toBe('ascending');
  fireEvent.change(screen.getByRole('textbox', { name: 'Search movements' }), {
    target: { value: 'missing, sku-b' },
  });
  expect(screen.getAllByRole('button', { name: 'Select line' })).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
  await waitFor(() =>
    expect(screen.getAllByRole('button', { name: 'Select line' })).toHaveLength(50),
  );
  expect(screen.getAllByRole('link')[0].textContent).toBe('Château');
  expect(
    screen
      .getByRole('button', { name: 'Sort by Recorded date' })
      .closest('th')!
      .getAttribute('aria-sort'),
  ).toBe('descending');
});
it('prints all matching records and keeps checked records across pages', async () => {
  vi.spyOn(inventoryService, 'getAllMovements').mockResolvedValue({
    movements: rows,
    total: 51,
    truncated: false,
  });
  const listener = vi.fn();
  window.addEventListener(DOCUMENT_EXPORT_EVENT, listener);
  const { container } = render(<InventoryMovementsBrowser preset="moves" />);
  await waitFor(() =>
    expect(
      container.querySelectorAll<HTMLButtonElement>('button[aria-label="Select line"]'),
    ).toHaveLength(50),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Print history' }));
  const event = listener.mock.calls[0][0] as CustomEvent<DocumentExportRequest>;
  expect(event.detail.models[0].table.rows).toHaveLength(51);
  fireEvent.click(
    container.querySelectorAll<HTMLButtonElement>('button[aria-label="Select line"]')[0],
  );
  fireEvent.click(container.querySelector<HTMLButtonElement>('button[aria-label="Next page"]')!);
  fireEvent.click(screen.getByRole('button', { name: 'Select line' }));
  expect(screen.getByRole('button', { name: 'Print 2 Lines' })).toBeTruthy();
  fireEvent.change(screen.getByRole('textbox', { name: 'Search movements' }), {
    target: { value: 'sku-b, missing' },
  });
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Print Stock Moves Report' })).toBeTruthy(),
  );
  expect(screen.getByRole('link', { name: 'Beer' }).getAttribute('href')).toBe('/sub-products/b');
  window.removeEventListener(DOCUMENT_EXPORT_EVENT, listener);
});
it('disables complete-history exports if loading is capped and clears failed refresh totals', async () => {
  const fetch = vi
    .spyOn(inventoryService, 'getAllMovements')
    .mockResolvedValue({ movements: rows, total: 10001, truncated: true });
  render(<InventoryMovementsBrowser preset="moves" />);
  await waitFor(() => expect(screen.getByText(/Narrow the date range/)).toBeTruthy());
  expect(
    (screen.getByRole('button', { name: 'Print history' }) as HTMLButtonElement).disabled,
  ).toBe(true);
  fetch.mockRejectedValueOnce(new Error('History unavailable'));
  fireEvent.click(screen.getByRole('button', { name: 'Refresh list' }));
  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toContain('History unavailable'),
  );
  expect(screen.queryByRole('link', { name: 'Château' })).toBeNull();
});
it('combines multiple products with warehouse/status filters and restores a saved view', async () => {
  vi.spyOn(inventoryService, 'getAllMovements').mockResolvedValue({
    movements: [rows[0], rows[50]],
    total: 2,
    truncated: false,
  });
  render(<InventoryMovementsBrowser preset="moves" />);
  await waitFor(() =>
    expect(screen.getAllByRole('button', { name: 'Select line' })).toHaveLength(2),
  );
  fireEvent.focus(screen.getByRole('searchbox', { name: 'Search products' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Château · SKU-A' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Beer · SKU-B' }));
  fireEvent.change(screen.getByRole('combobox', { name: 'Filter by warehouse' }), {
    target: { value: 'city' },
  });
  fireEvent.change(screen.getByRole('combobox', { name: 'Filter by status' }), {
    target: { value: 'confirmed' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Group By' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save current search' }));
  fireEvent.change(screen.getByPlaceholderText('Name this search…'), {
    target: { value: 'City products' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  const stored = JSON.parse(localStorage.getItem('dh-inventory-moves-searches')!)[0];
  expect(stored).toMatchObject({ products: 'a,b', warehouse: 'city', status: 'confirmed' });
  fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
  fireEvent.click(screen.getByRole('button', { name: 'City products' }));
  expect(
    (screen.getByRole('combobox', { name: 'Filter by warehouse' }) as HTMLSelectElement).value,
  ).toBe('city');
  expect(
    (screen.getByRole('combobox', { name: 'Filter by status' }) as HTMLSelectElement).value,
  ).toBe('confirmed');
  expect(screen.getByRole('button', { name: 'Remove Beer · SKU-B' })).toBeTruthy();
});
