// utils/print/transfer-print-lines.test.ts
// Presentation lines ('section'/'note') print as styled rows — never as
// zero-quantity product stats in the transfer document table.
import { expect, it } from 'vitest';
import { buildTransferInvoice } from './transfer-print';
import type { StockTransfer } from '@/services/stockTransfer.service';

it('prints section headings and notes between product rows', () => {
  const transfer = {
    transferNumber: 'TRF-2',
    sourceWarehouse: 's',
    destinationWarehouse: 'd',
    currency: 'NGN',
    status: 'draft',
    items: [
      { lineType: 'section', name: 'Beer crates', quantity: 0, costPrice: 0 },
      {
        lineType: 'product',
        subProductName: 'Wine',
        quantity: 10,
        costPrice: 100,
      },
      { lineType: 'note', description: 'Seal crates before dispatch' },
    ],
  } as unknown as StockTransfer;
  const doc = buildTransferInvoice(transfer, 'DrinksHarbour');
  const rows = doc.table?.rows ?? [];
  // Section heading on its own row, product row in between, note last.
  expect(rows).toHaveLength(3);
  expect(rows[0][0]).toMatchObject({ text: 'Beer crates', strong: true });
  expect(rows[1][0]).toMatchObject({ text: 'Wine' });
  // Product rows keep their 8 cells; presentation rows stay 8-wide too (the
  // print renderer zips rows against the column list).
  expect(rows[0]).toHaveLength(8);
  expect(rows[2][0]).toMatchObject({
    text: 'Seal crates before dispatch',
    color: '#6b7280',
  });
  // Presentation lines contribute no money.
  expect(JSON.stringify(rows)).not.toContain('1000');
});
