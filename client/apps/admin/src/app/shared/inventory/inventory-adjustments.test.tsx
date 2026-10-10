// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { inventoryService, type InventoryMovement } from '@/services/inventory.service';
import Browser from './inventory-movements-browser';
import { DOCUMENT_EXPORT_EVENT, type DocumentExportRequest } from '@/utils/print/document-export';
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { token: 't' } }, status: 'authenticated' }),
}));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});
const row = (id: string, extra: Partial<InventoryMovement> = {}) =>
  ({
    _id: id,
    subProduct: { _id: id, name: `Wine ${id}`, sku: `SKU-${id}` },
    warehouse: { _id: 'city', name: 'City' },
    createdAt: '2026-10-05T10:00:00Z',
    type: 'adjustment_in',
    category: 'in',
    status: 'confirmed',
    quantity: 5,
    quantityBefore: 2,
    quantityAfter: 7,
    unitCost: 10,
    totalCost: 50,
    source: 'manual',
    reason: 'Stock count correction',
    notes: 'Full correction notes',
    ...extra,
  }) as InventoryMovement;
it('loads all correction categories, shows actual totals/reasons/balances and prints full documents', async () => {
  const fetch = vi
    .spyOn(inventoryService, 'getAllMovements')
    .mockResolvedValue({
      movements: [
        row('a'),
        row('b', {
          type: 'adjustment_out',
          category: 'out',
          quantity: 3,
          quantityBefore: 7,
          quantityAfter: 4,
          totalCost: 30,
        }),
        row('pending', { status: 'pending', quantity: 8 }),
      ],
      total: 3,
      truncated: false,
    });
  const listener = vi.fn();
  window.addEventListener(DOCUMENT_EXPORT_EVENT, listener);
  try {
    render(<Browser preset="adjustments" />);
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: 'Select line' })).toHaveLength(3),
    );
    expect(fetch.mock.calls[0][1]).toMatchObject({ scope: 'adjustments', category: undefined });
    expect(screen.getByRole('region', { name: 'Adjustment totals' }).textContent).toContain(
      'Net stock change',
    );
    expect(screen.getByText('8 units · 1 pending correction')).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: /Reason/ })).toBeTruthy();
    const correction = screen.getByRole('link', { name: 'Wine a' }).closest('tr')!;
    expect(within(correction).getByRole('cell', { name: '2 → 7' })).toBeTruthy();
    fireEvent.click(
      within(correction).getByRole('button', {
        name: 'Print stock adjustment report for this line',
      }),
    );
    const model = (listener.mock.calls[0][0] as CustomEvent<DocumentExportRequest>).detail
      .models[0];
    expect(model.sections).toContainEqual({ title: 'Notes', body: 'Full correction notes' });
    expect(model.meta).toContainEqual(['Stock balance', '2 → 7']);
    fireEvent.click(screen.getByRole('button', { name: 'Print history' }));
    expect(
      (listener.mock.calls[1][0] as CustomEvent<DocumentExportRequest>).detail.models[0].docTitle,
    ).toBe('Stock adjustment history');
    fireEvent.click(screen.getByRole('button', { name: 'Decreases' }));
    expect(screen.getAllByRole('button', { name: 'Select line' })).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Wine b' })).toBeTruthy();
  } finally {
    window.removeEventListener(DOCUMENT_EXPORT_EVENT, listener);
  }
});
it('combines product alternatives with source/status and shows unavailable totals on refresh failure', async () => {
  const fetch = vi
    .spyOn(inventoryService, 'getAllMovements')
    .mockResolvedValue({
      movements: [row('a'), row('b', { source: 'system' })],
      total: 2,
      truncated: false,
    });
  render(<Browser preset="adjustments" />);
  await waitFor(() =>
    expect(screen.getAllByRole('button', { name: 'Select line' })).toHaveLength(2),
  );
  fireEvent.change(screen.getByRole('textbox', { name: 'Search movements' }), {
    target: { value: 'SKU-a, SKU-b' },
  });
  fireEvent.change(screen.getByRole('combobox', { name: 'Filter by source' }), {
    target: { value: 'system' },
  });
  fireEvent.change(screen.getByRole('combobox', { name: 'Filter by status' }), {
    target: { value: 'confirmed' },
  });
  expect(screen.getAllByRole('button', { name: 'Select line' })).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
  expect(screen.getAllByRole('button', { name: 'Select line' })).toHaveLength(2);
  fetch.mockRejectedValueOnce(new Error('Adjustments unavailable'));
  fireEvent.click(screen.getByRole('button', { name: 'Refresh list' }));
  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toContain('Adjustments unavailable'),
  );
  expect(screen.getByRole('region', { name: 'Adjustment totals' }).textContent).toContain(
    'Adjustment totals unavailable',
  );
});
