// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { InventoryMovement } from '@/services/inventory.service';
import MoveDetail from './inventory-movements-detail';
import { DOCUMENT_EXPORT_EVENT, type DocumentExportRequest } from '@/utils/print/document-export';
afterEach(cleanup);
it('opens the shared printable document and original purchase, with unavailable costs consistent in both tabs', () => {
  const listener = vi.fn();
  window.addEventListener(DOCUMENT_EXPORT_EVENT, listener);
  const move = {
    _id: 'm',
    subProduct: { _id: 'p', name: 'Wine' },
    quantity: 3,
    type: 'received',
    category: 'in',
    status: 'pending',
    createdAt: '2026-10-04T10:00:00Z',
    relatedPurchaseOrder: 'po-id',
  } as InventoryMovement;
  render(<MoveDetail move={move} docTitle="Stock receipt" onClose={() => {}} />);
  expect(screen.getByRole('link', { name: 'Open purchase document' }).getAttribute('href')).toBe(
    '/purchases/po-id',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Print stock receipt' }));
  const event = listener.mock.calls[0][0] as CustomEvent<DocumentExportRequest>;
  expect(event.detail.models[0].watermark).toBe('PENDING');
  expect(event.detail.models[0].totals[0].value).toBe('—');
  fireEvent.click(screen.getByRole('tab', { name: 'Document' }));
  expect(screen.getByText('Not posted')).toBeTruthy();
  expect(screen.getByText('Recorded value')).toBeTruthy();
  window.removeEventListener(DOCUMENT_EXPORT_EVENT, listener);
});
it('uses posted transfer direction, links the product and warehouse, and preserves notes in the document', () => {
  const move = {
    _id: 'transfer',
    subProduct: { _id: 'p', name: 'Wine', sku: 'WINE-X' },
    warehouse: { _id: 'city', name: 'Wyn City' },
    sourceWarehouse: { _id: 'depot', name: 'Depot' },
    destinationWarehouse: { _id: 'city', name: 'Wyn City' },
    type: 'transfer_out',
    category: 'transfer',
    quantity: 3,
    quantityBefore: 10,
    quantityAfter: 7,
    status: 'confirmed',
    createdAt: '2026-10-04T10:00:00Z',
    performedAt: '2026-10-03T10:00:00Z',
    notes: 'Handle carefully\nKeep upright',
    unitCost: 100,
    totalCost: 250,
  } as InventoryMovement;
  render(<MoveDetail move={move} docTitle="Stock moves report" onClose={() => {}} />);
  expect(screen.getByText('-3')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Wine' }).getAttribute('href')).toBe('/sub-products/p');
  expect(screen.getByRole('link', { name: 'Wyn City' }).getAttribute('href')).toBe(
    '/warehouses/city/analysis',
  );
  fireEvent.click(screen.getByRole('tab', { name: 'Document' }));
  expect(screen.getByText('Handle carefully Keep upright', { exact: false })).toBeTruthy();
  expect(screen.getByText('10 → 7')).toBeTruthy();
});
it('reservations show zero posted change, pending balances remain unposted, and selecting another movement resets the tab', () => {
  const pending = {
    _id: 'pending',
    type: 'purchase',
    category: 'in',
    quantity: 8,
    quantityBefore: 0,
    quantityAfter: 8,
    status: 'pending',
    createdAt: '2026-10-04T10:00:00Z',
  } as InventoryMovement;
  const { rerender } = render(
    <MoveDetail move={pending} docTitle="Stock moves report" onClose={() => {}} />,
  );
  expect(screen.getByText('Not posted')).toBeTruthy();
  expect(screen.queryByText('+8')).toBeNull();
  fireEvent.click(screen.getByRole('tab', { name: 'Document' }));
  rerender(
    <MoveDetail
      move={{ ...pending, _id: 'reserved', type: 'reserved', status: 'confirmed' }}
      docTitle="Stock moves report"
      onClose={() => {}}
    />,
  );
  expect(screen.getByRole('tab', { name: 'Details' }).getAttribute('aria-selected')).toBe('true');
  expect(screen.getByText('Posted change')).toBeTruthy();
  expect(screen.queryByText('+8')).toBeNull();
});
it('supports keyboard tabs, prints the document data and closes the panel', () => {
  const close = vi.fn(),
    listener = vi.fn();
  window.addEventListener(DOCUMENT_EXPORT_EVENT, listener);
  const move = {
    _id: 'import',
    subProduct: { _id: 'p', name: 'Wine' },
    type: 'received',
    category: 'in',
    quantity: 30,
    quantityBefore: 0,
    quantityAfter: 30,
    status: 'confirmed',
    createdAt: '2026-10-04T10:00:00Z',
    reference: 'bulk-import',
    source: 'system',
    notes: 'Bulk import opening stock',
    unitCost: 66121.67,
    totalCost: 1983650.1,
    relatedPurchaseOrder: 'po',
    relatedOrder: 'order',
  } as InventoryMovement;
  render(<MoveDetail move={move} docTitle="Stock movement" onClose={close} />);
  expect(screen.getByRole('link', { name: 'Open purchase document' })).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Open order invoice' })).toBeTruthy();
  fireEvent.keyDown(screen.getByRole('tab', { name: 'Details' }), { key: 'ArrowRight' });
  expect(screen.getByRole('tab', { name: 'Document' }).getAttribute('aria-selected')).toBe('true');
  expect(screen.getByText('Bulk import opening stock')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Print / PDF' }));
  const model = (listener.mock.calls[0][0] as CustomEvent<DocumentExportRequest>).detail.models[0];
  expect(model.table.rows[0][1].text).toBe('30');
  expect(model.meta).toContainEqual(['Stock change', '+30']);
  expect(model.meta).toContainEqual(['Stock balance', '0 → 30']);
  expect(model.totals[0].value).toContain('1,983,650.10');
  expect(model.sections).toContainEqual({ title: 'Notes', body: 'Bulk import opening stock' });
  fireEvent.click(screen.getByRole('button', { name: 'Close details' }));
  expect(close).toHaveBeenCalledOnce();
  window.removeEventListener(DOCUMENT_EXPORT_EVENT, listener);
});
