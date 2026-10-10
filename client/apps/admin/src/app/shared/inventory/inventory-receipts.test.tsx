// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { inventoryService, type InventoryMovement } from '@/services/inventory.service';
import InventoryReceipts from './inventory-receipts';
import { PRESETS } from './inventory-movements-presets';
import { DOCUMENT_EXPORT_EVENT, type DocumentExportRequest } from '@/utils/print/document-export';
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { token: 't' } }, status: 'authenticated' }),
}));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});
const receipt = (id: string, extra: Partial<InventoryMovement> = {}) =>
  ({
    _id: id,
    subProduct: { _id: id, name: `Product ${id}`, sku: `SKU-${id}` },
    warehouse: { _id: 'city', name: 'City' },
    type: 'received',
    category: 'in',
    quantity: 3,
    quantityBefore: 2,
    quantityAfter: 5,
    status: 'confirmed',
    unitCost: 10,
    totalCost: 30,
    createdAt: '2026-10-04T12:00:00Z',
    source: 'system',
    ...extra,
  }) as InventoryMovement;
it('classifies actual received purchase-order lines and opening stock exclusively', () => {
  const purchase = receipt('po', {
    relatedPurchaseOrder: 'purchase-id',
    referenceType: 'purchase_order',
  });
  expect(PRESETS.receipts.tabs.find((t) => t.key === 'purchase')!.match!(purchase)).toBe(true);
  const opening = receipt('import', {
    reference: 'bulk-import',
    referenceType: 'purchase_order',
    notes: 'Bulk import opening stock',
  });
  const openingTab = PRESETS.receipts.tabs.find((t) => t.key === 'opening');
  expect(openingTab?.match?.(opening)).toBe(true);
  expect(PRESETS.receipts.tabs.find((t) => t.key === 'purchase')!.match!(opening)).toBe(false);
  expect(PRESETS.receipts.tabs.filter((t) => t.match?.(purchase))).toHaveLength(1);
});
it('shows supplier and balances, pending units separately and prints the exact receipt', async () => {
  const rows = [
    receipt('po', {
      supplierName: 'Acme',
      relatedPurchaseOrder: 'po-id',
      batchNumber: 'B-7',
      notes: 'Full receipt notes',
    }),
    receipt('pending', { status: 'pending', quantity: 8, totalCost: 80 }),
    receipt('cancelled', { status: 'cancelled', quantity: 7, totalCost: 70 }),
  ];
  vi.spyOn(inventoryService, 'getAllMovements').mockResolvedValue({
    movements: rows,
    total: 3,
    truncated: false,
  });
  const events: CustomEvent<DocumentExportRequest>[] = [];
  const listen = (e: Event) => events.push(e as CustomEvent<DocumentExportRequest>);
  window.addEventListener(DOCUMENT_EXPORT_EVENT, listen);
  try {
    render(<InventoryReceipts />);
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: 'Select line' })).toHaveLength(3),
    );
    expect(screen.getByRole('columnheader', { name: /Supplier/ })).toBeTruthy();
    expect(screen.getByRole('cell', { name: 'Acme' })).toBeTruthy();
    expect(screen.getByText('Units received')).toBeTruthy();
    expect(screen.getByText('Awaiting receipt')).toBeTruthy();
    expect(screen.getByText('8 units · 1 pending line')).toBeTruthy();
    expect(screen.getByRole('cell', { name: '2 → 5' })).toBeTruthy();
    const purchaseRow = screen.getByRole('cell', { name: 'Acme' }).closest('tr')!;
    fireEvent.click(
      within(purchaseRow).getByRole('button', { name: 'Print goods receipt note for this line' }),
    );
    expect(events[0].detail.models[0].table.columns.map((c) => c.label)).toContain('Unit cost');
    expect(events[0].detail.models[0].sections).toContainEqual({
      title: 'Notes',
      body: 'Full receipt notes',
    });
    fireEvent.click(within(purchaseRow).getByRole('button', { name: 'Select line' }));
    fireEvent.click(screen.getByRole('button', { name: 'Print Goods Receipt Note' }));
    expect(events[1].detail.models[0].sections).toContainEqual({
      title: 'Notes',
      body: 'Full receipt notes',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Purchases' }));
    expect(screen.getByRole('button', { name: 'Deselect line' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Select line' })).toBeNull();
    const row = screen.getByRole('cell', { name: 'Acme' }).closest('tr')!;
    fireEvent.click(within(row).getByRole('button', { name: /View receipt/ }));
    expect(screen.getByRole('link', { name: 'Open purchase document' }).getAttribute('href')).toBe(
      '/purchases/po-id',
    );
  } finally {
    window.removeEventListener(DOCUMENT_EXPORT_EVENT, listen);
  }
});
it('combines products, supplier and status and clears receipt filters without losing the incoming scope', async () => {
  vi.spyOn(inventoryService, 'getAllMovements').mockResolvedValue({
    movements: [
      receipt('a', { supplierName: 'Acme' }),
      receipt('b', { supplierName: 'Acme', status: 'pending' }),
      receipt('c', { supplierName: 'Other' }),
    ],
    total: 3,
    truncated: false,
  });
  render(<InventoryReceipts />);
  await waitFor(() =>
    expect(screen.getAllByRole('button', { name: 'Select line' })).toHaveLength(3),
  );
  fireEvent.focus(screen.getByRole('searchbox', { name: 'Search products' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Product a · SKU-a' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Product b · SKU-b' }));
  fireEvent.change(screen.getByRole('combobox', { name: 'Filter by supplier' }), {
    target: { value: 'Acme' },
  });
  fireEvent.change(screen.getByRole('combobox', { name: 'Filter by status' }), {
    target: { value: 'confirmed' },
  });
  await waitFor(() =>
    expect(screen.getAllByRole('button', { name: 'Select line' })).toHaveLength(1),
  );
  expect(screen.getByRole('link', { name: 'Product a' })).toBeTruthy();
  expect(screen.queryByRole('link', { name: 'Product b' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
  await waitFor(() =>
    expect(screen.getAllByRole('button', { name: 'Select line' })).toHaveLength(3),
  );
});
it('shows unavailable receipt totals after a failed refresh rather than reporting zero received', async () => {
  const fetch = vi
    .spyOn(inventoryService, 'getAllMovements')
    .mockResolvedValue({ movements: [receipt('a')], total: 1, truncated: false });
  render(<InventoryReceipts />);
  await waitFor(() => expect(screen.getByRole('link', { name: 'Product a' })).toBeTruthy());
  fetch.mockRejectedValueOnce(new Error('Receipt history unavailable'));
  fireEvent.click(screen.getByRole('button', { name: 'Refresh list' }));
  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toContain('Receipt history unavailable'),
  );
  const totals = screen.getByRole('region', { name: 'Receipt totals' });
  expect(within(totals).getAllByText('—')).toHaveLength(5);
  expect(screen.queryByRole('link', { name: 'Product a' })).toBeNull();
});
