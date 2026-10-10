import { expect, it } from 'vitest';
import { buildTransferInvoice } from './transfer-print';
import type { StockTransfer } from '@/services/stockTransfer.service';
it('transfer advice shows returned units and uses net line and delivery amounts', () => {
  const transfer = {
    transferNumber: 'TRF-1',
    sourceWarehouse: 's',
    destinationWarehouse: 'd',
    currency: 'NGN',
    status: 'completed',
    deliveryCharge: 100,
    subtotal: 600,
    discountAmount: 0,
    taxAmount: 60,
    total: 720,
    items: [
      {
        subProductName: 'Wine',
        quantity: 10,
        receivedQty: 10,
        transferredQty: 10,
        returnedQty: 4,
        costPrice: 100,
        taxRate: 10,
      },
    ],
  } as StockTransfer;
  const doc = buildTransferInvoice(transfer, 'DrinksHarbour');
  expect(JSON.stringify(doc.table?.rows)).toContain('4 returned');
  expect(doc.table?.rows[0].at(-1)?.text).toContain('660');
  expect(doc.totals?.find((t) => t.label === 'Delivery / Charges')?.value).toContain('60');
});
