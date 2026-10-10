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
const origin = { _id: 'origin', name: 'Depot' },
  holding = { _id: 'holding', name: 'City' };
const move = (id: string, extra: Partial<InventoryMovement> = {}) =>
  ({
    _id: id,
    subProduct: { _id: 'p', name: 'Wine', sku: 'SKU-1' },
    warehouse: holding,
    sourceWarehouse: origin,
    destinationWarehouse: holding,
    type: 'transfer_in',
    category: 'transfer',
    quantity: 10,
    totalCost: 100,
    status: 'confirmed',
    source: 'system',
    createdAt: '2026-10-04T12:00:00Z',
    reference: 'Transfer TRF-1',
    ...extra,
  }) as InventoryMovement;
const rows = [
  move('in'),
  move('out', { type: 'transfer_out', warehouse: origin }),
  move('return-in', {
    type: 'return',
    category: 'in',
    quantity: 2,
    totalCost: 20,
    sourceWarehouse: holding,
    destinationWarehouse: origin,
    warehouse: origin,
    reference: 'Return of transfer TRF-1',
    referenceType: 'return',
  }),
  move('return-out', {
    type: 'transfer_out',
    quantity: 2,
    totalCost: 20,
    sourceWarehouse: holding,
    destinationWarehouse: origin,
    reference: 'Return of transfer TRF-1',
  }),
  move('pending', { status: 'pending', quantity: 8 }),
];
it('loads internal return scope and shows separate in/out/return totals and full internal notes', async () => {
  vi.spyOn(inventoryService, 'getAllMovements').mockResolvedValue({
    movements: rows,
    total: 5,
    truncated: false,
  });
  const events: CustomEvent<DocumentExportRequest>[] = [];
  const listener = (e: Event) => events.push(e as CustomEvent<DocumentExportRequest>);
  window.addEventListener(DOCUMENT_EXPORT_EVENT, listener);
  try {
    render(<InventoryMovementsBrowser preset="internal" />);
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: 'Select line' })).toHaveLength(5),
    );
    expect(screen.getByRole('region', { name: 'Internal transfer totals' })).toBeTruthy();
    expect(screen.getByText('Returned in / out')).toBeTruthy();
    expect(screen.getByText('2 / 2')).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Stock balance' })).toBeTruthy();
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Print internal transfer note for this line' })[0],
    );
    expect(events[0].detail.models[0].table.columns.map((c) => c.label)).toContain('Unit cost');
    fireEvent.click(screen.getByRole('button', { name: 'Returns in' }));
    expect(screen.getAllByRole('button', { name: 'Select line' })).toHaveLength(1);
    expect(screen.getByRole('cell', { name: /Transfer return in/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Returns out' }));
    expect(screen.getAllByRole('button', { name: 'Select line' })).toHaveLength(1);
    expect(screen.getByRole('cell', { name: /Transfer return out/ })).toBeTruthy();
  } finally {
    window.removeEventListener(DOCUMENT_EXPORT_EVENT, listener);
  }
});
it('combines route filters with actual warehouse and saves and restores their IDs', async () => {
  vi.spyOn(inventoryService, 'getAllMovements').mockResolvedValue({
    movements: rows,
    total: 5,
    truncated: false,
  });
  render(<InventoryMovementsBrowser preset="internal" />);
  await waitFor(() =>
    expect(screen.getAllByRole('button', { name: 'Select line' })).toHaveLength(5),
  );
  fireEvent.change(screen.getByRole('combobox', { name: 'Filter from warehouse' }), {
    target: { value: 'holding' },
  });
  fireEvent.change(screen.getByRole('combobox', { name: 'Filter to warehouse' }), {
    target: { value: 'origin' },
  });
  expect(screen.getAllByRole('button', { name: 'Select line' })).toHaveLength(2);
  fireEvent.change(screen.getByRole('combobox', { name: 'Filter by warehouse' }), {
    target: { value: 'origin' },
  });
  expect(screen.getAllByRole('button', { name: 'Select line' })).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Group By' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save current search' }));
  fireEvent.change(screen.getByPlaceholderText('Name this search…'), {
    target: { value: 'City returns' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
  expect(screen.getAllByRole('button', { name: 'Select line' })).toHaveLength(5);
  fireEvent.click(screen.getByRole('button', { name: 'City returns' }));
  expect(
    (screen.getByRole('combobox', { name: 'Filter from warehouse' }) as HTMLSelectElement).value,
  ).toBe('holding');
  expect(screen.getAllByRole('button', { name: 'Select line' })).toHaveLength(1);
});
