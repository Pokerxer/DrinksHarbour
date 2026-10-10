import { expect, it } from 'vitest';
import type { InventoryMovement } from '@/services/inventory.service';
import { buildMovementsDocument, movementsCSV } from './inventory-movement-export';
it('exports status and posted totals safely while retaining pending entries', () => {
  const rows = [
    {
      _id: 'a',
      createdAt: '2026-10-04',
      type: 'transfer_out',
      status: 'confirmed',
      quantity: 3,
      totalCost: 30,
      reference: '=1+1',
    },
    { _id: 'b', createdAt: '2026-10-04', type: 'reserved', status: 'confirmed', quantity: 99 },
    { _id: 'c', createdAt: '2026-10-04', type: 'purchase', status: 'pending', quantity: 99 },
  ] as InventoryMovement[];
  const doc = buildMovementsDocument(rows, 'Moves');
  expect(doc.table.rows).toHaveLength(3);
  expect(doc.totals).toContainEqual({ label: 'Posted out', value: '3' });
  expect(movementsCSV(rows)).toContain("'=1+1");
  expect(movementsCSV(rows)).toContain('pending');
  expect(movementsCSV(rows)).toContain('Not posted');
});
it('retains receipt supplier, SKU, batches and full notes in history exports', () => {
  const rows = [
    {
      _id: 'receipt',
      subProduct: { _id: 'p', name: 'Wine', sku: 'SKU-7' },
      type: 'received',
      category: 'in',
      status: 'confirmed',
      quantity: 3,
      createdAt: '2026-10-04',
      reference: 'GRN-1',
      supplierName: 'Vendor',
      batchNumber: 'B-7',
      lotNumber: 'L-7',
      unitCost: 10,
      reason: 'Purchase received',
      notes: 'Complete notes',
      expirationDate: '2027-10-04',
    },
  ] as InventoryMovement[];
  const csv = movementsCSV(rows);
  for (const value of [
    'Supplier',
    'SKU',
    'Unit cost',
    'Batch',
    'Lot',
    'Notes',
    'Vendor',
    'SKU-7',
    'B-7',
    'L-7',
    'Complete notes',
  ])
    expect(csv).toContain(value);
  const doc = buildMovementsDocument(rows, 'Goods receipt history');
  expect(doc.table.rows.flat().some((cell) => cell.sub?.includes('Vendor'))).toBe(true);
  expect(doc.table.rows.flat().some((cell) => cell.sub?.includes('B-7'))).toBe(true);
});
it('keeps delivery source and both linked sales references in history exports', () => {
  const rows = [
    {
      type: 'sold',
      category: 'out',
      status: 'confirmed',
      quantity: 3,
      createdAt: '2026-10-04',
      source: 'pos',
      relatedOrder: { _id: 'order', orderNumber: 'ORDER-7', receiptNumber: 'SALE-8' },
    },
  ] as InventoryMovement[];
  const csv = movementsCSV(rows);
  for (const text of ['Source', 'pos', 'Sales order', 'ORDER-7', 'Sales receipt', 'SALE-8'])
    expect(csv).toContain(text);
  expect(
    buildMovementsDocument(rows, 'Delivery history')
      .table.rows.flat()
      .some((cell) => cell.sub?.includes('pos')),
  ).toBe(true);
});
it('exports internal source and destination identities separately from the actual stock warehouse', () => {
  const rows = [
    {
      type: 'transfer_out',
      category: 'transfer',
      status: 'confirmed',
      quantity: 2,
      sourceWarehouse: { _id: 'origin', name: 'Depot' },
      destinationWarehouse: { _id: 'holding', name: 'City' },
      warehouse: { _id: 'origin', name: 'Depot' },
      createdAt: '2026-10-04',
    },
  ] as InventoryMovement[];
  const csv = movementsCSV(rows);
  for (const value of [
    'From warehouse',
    'To warehouse',
    'From warehouse ID',
    'To warehouse ID',
    'origin',
    'holding',
  ])
    expect(csv).toContain(value);
});
