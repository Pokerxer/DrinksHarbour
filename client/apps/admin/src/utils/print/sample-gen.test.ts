// Visual verification harness: builds a real PDF per document type into
// /tmp/invoice-preview so the layout can be inspected by eye. It asserts only
// that rendering succeeds — the layout itself is judged from the files.
import { it, expect } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { buildRFQInvoice } from './rfq-print';
import { buildPOInvoice } from './po-print';
import { buildBillInvoice } from './bill-print';
import { buildTransferInvoice } from './transfer-print';
import { buildReturnInvoice } from './return-print';
import { renderDocument } from './pdf-render';

const rfq: any = {
  _id: 'rfq-1',
  poNumber: 'RFQ-2026-0001',
  vendorName: 'Meads & Sons Distribution',
  vendorReference: 'MSD-4471',
  currency: 'NGN',
  status: 'draft',
  type: 'rfq',
  createdAt: '2026-08-01T10:00:00.000Z',
  expectedArrival: '2026-09-01T00:00:00.000Z',
  validUntil: '2026-08-31T00:00:00.000Z',
  termsConditions:
    'Quotes valid for 14 days. Delivery to Maitama store. All prices must be inclusive of VAT where applicable.',
  notes: 'Urgent restock before the Abuja weekend rush.',
  items: [
    {
      subProductId: 'sp-1',
      subProductName: 'Hennessy VS Cognac',
      sizeName: '70cl',
      sku: 'HNS-VS-070',
      quantity: 24,
      packagingQty: 6,
      packaging: 'case',
      receivedQty: 0,
    },
    {
      subProductId: 'sp-2',
      subProductName: 'Moet Imperial Brut',
      sizeName: '75cl',
      sku: 'MOE-IMP-075',
      quantity: 12,
      packagingQty: 6,
      packaging: 'case',
      receivedQty: 0,
    },
    {
      subProductId: 'sp-3',
      subProductName: 'Jameson Irish Whiskey',
      sizeName: '70cl',
      sku: 'JAM-IRW-070',
      quantity: 36,
      packagingQty: 12,
      packaging: 'case',
      receivedQty: 0,
    },
    {
      subProductId: 'sp-4',
      subProductName: 'Chivas Regal 12 Year',
      sizeName: '75cl',
      sku: 'CHV-12Y-075',
      quantity: 18,
      packagingQty: 6,
      packaging: 'case',
      receivedQty: 0,
    },
    {
      subProductId: 'sp-5',
      subProductName: 'Cloudy Bay Sauvignon Blanc',
      sizeName: '75cl',
      sku: 'CLB-SB-075',
      quantity: 48,
      packagingQty: 6,
      packaging: 'case',
      receivedQty: 0,
    },
    {
      subProductId: 'sp-6',
      subProductName: 'Heineken Lager',
      sizeName: '65cl',
      sku: 'HNK-LGR-065',
      quantity: 120,
      packagingQty: 24,
      packaging: 'crate',
      receivedQty: 0,
    },
  ],
};

const po: any = {
  ...rfq,
  _id: 'po-1',
  poNumber: 'PO-2026-0100',
  type: 'po',
  status: 'partially_received',
  paymentTerms: 'Net 30',
  approvedByName: 'Ada Obi',
  warehouse: { _id: 'w1', name: 'Maitama Store', code: 'MTM' },
  isBackorder: true,
  originalPO: 'PO-2026-0088',
  confirmationDate: '2026-08-02T09:00:00.000Z',
  items: [
    {
      subProductId: 'sp-1',
      subProductName: 'Hennessy VS Cognac',
      sizeName: '70cl',
      sku: 'HNS-VS-070',
      uom: 'Units',
      quantity: 480,
      packagingQty: 6,
      packaging: 'case',
      receivedQty: 480,
      unitCost: 42000,
      taxRate: 7.5,
    },
    {
      subProductId: 'sp-2',
      subProductName: 'Moet Imperial Brut',
      sizeName: '75cl',
      sku: 'MOE-IMP-075',
      uom: 'Units',
      quantity: 240,
      packagingQty: 6,
      packaging: 'case',
      receivedQty: 96,
      returnedQty: 0,
      unitCost: 68500,
      taxRate: 7.5,
    },
    {
      subProductId: 'sp-3',
      subProductName: 'Jameson Irish Whiskey',
      sizeName: '70cl',
      sku: 'JAM-IRW-070',
      uom: 'Units',
      quantity: 600,
      packagingQty: 12,
      packaging: 'case',
      receivedQty: 0,
      unitCost: 18500,
      taxRate: 7.5,
    },
    {
      subProductId: 'sp-5',
      subProductName: 'Cloudy Bay Sauvignon Blanc',
      sizeName: '75cl',
      sku: 'CLB-SB-075',
      uom: 'Units',
      quantity: 96,
      packagingQty: 6,
      packaging: 'case',
      receivedQty: 60,
      unitCost: 32000,
      taxRate: 7.5,
    },
  ],
};

const bill: any = {
  billNumber: 'BILL-2026-0042',
  vendorName: 'Meads & Sons Distribution',
  currency: 'NGN',
  billDate: '2026-08-01T00:00:00.000Z',
  dueDate: '2026-08-31T00:00:00.000Z',
  status: 'partial',
  subtotal: 4000000,
  taxAmount: 300000,
  totalAmount: 4300000,
  paidAmount: 2000000,
  terms: 'Net 30 from invoice date.',
  notes: 'Please reference the bill number on payment.',
  items: [
    {
      subProductName: 'Hennessy VS Cognac',
      sizeName: '70cl',
      sku: 'HNS-VS-070',
      quantity: 200,
      unitPrice: 20000,
      taxRate: 7.5,
      amount: 4300000,
    },
    {
      subProductName: 'Moet Imperial Brut',
      sizeName: '75cl',
      sku: 'MOE-IMP-075',
      quantity: 60,
      unitPrice: 68500,
      taxRate: 7.5,
      amount: 4110000,
    },
  ],
  payments: [
    {
      amount: 2000000,
      date: '2026-08-05T00:00:00.000Z',
      method: 'bank_transfer',
      reference: 'TRF-88991',
    },
  ],
};

// A paid bill exercises the watermark path; the long PO exercises pagination
// and the repeating header band / footer.
const paidBill: any = {
  ...bill,
  billNumber: 'BILL-2026-0043',
  status: 'paid',
  paidAmount: 4300000,
  payments: [
    {
      amount: 2000000,
      date: '2026-08-05T00:00:00.000Z',
      method: 'bank_transfer',
      reference: 'TRF-88991',
    },
    {
      amount: 2300000,
      date: '2026-08-19T00:00:00.000Z',
      method: 'cash',
      reference: 'RCPT-00212',
    },
  ],
};

const longPo: any = {
  ...po,
  poNumber: 'PO-2026-0101',
  items: Array.from({ length: 34 }, (_, i) => ({
    ...po.items[i % po.items.length],
    subProductId: `sp-long-${i}`,
    sku: `SKU-${String(i + 1).padStart(4, '0')}`,
  })),
};

const transfer: any = {
  transferNumber: 'TRF-2026-0017',
  currency: 'NGN',
  status: 'in_transit',
  createdAt: '2026-08-10T00:00:00.000Z',
  scheduledDate: '2026-08-12T00:00:00.000Z',
  sourceWarehouse: { _id: 'w1', name: 'Maitama Store', code: 'MTM' },
  destinationWarehouse: { _id: 'w2', name: 'Wuse II Outlet', code: 'WUS' },
  notes: 'Move slow-moving champagne stock ahead of the Wuse launch weekend.',
  createdBy: { name: 'Ada Obi' },
  confirmedBy: null,
  items: [
    {
      subProductName: 'Moet Imperial Brut',
      sizeName: '75cl',
      sku: 'MOE-IMP-075',
      quantity: 60,
      transferredQty: 60,
      costPrice: 68500,
    },
    {
      subProductName: 'Veuve Clicquot Yellow Label',
      sizeName: '75cl',
      sku: 'VCQ-YL-075',
      quantity: 40,
      transferredQty: 12,
      costPrice: 82000,
    },
    {
      subProductName: 'Hennessy VS Cognac',
      sizeName: '70cl',
      sku: 'HNS-VS-070',
      quantity: 24,
      transferredQty: 0,
      costPrice: 42000,
    },
  ],
};

const vendorReturn: any = {
  returnNumber: 'RET-2026-0009',
  currency: 'NGN',
  status: 'approved',
  vendorName: 'Meads & Sons Distribution',
  returnDate: '2026-08-15T00:00:00.000Z',
  poNumber: 'PO-2026-0100',
  billNumber: 'BILL-2026-0042',
  subtotal: 1370000,
  taxAmount: 102750,
  totalAmount: 1472750,
  reason: 'damaged_in_transit',
  notes:
    'Three cases arrived with broken seals; photographs sent to the vendor.',
  shippingCarrier: 'GIG Logistics',
  trackingNumber: 'GIG-771254',
  returnAddress: '12 Kudirat Abiola Way, Ikeja, Lagos',
  refundMethod: 'bank_transfer',
  refundReference: 'RF-00341',
  refundDate: '2026-08-20T00:00:00.000Z',
  refundStatus: 'pending',
  refundAmount: 1472750,
  items: [
    {
      subProductName: 'Moet Imperial Brut',
      sizeName: '75cl',
      sku: 'MOE-IMP-075',
      quantity: 20,
      unitPrice: 68500,
      amount: 1370000,
      reason: 'damaged_in_transit',
    },
  ],
};

it('writes sample PDFs', () => {
  const outDir = '/tmp/invoice-preview';
  mkdirSync(outDir, { recursive: true });
  const docs: [string, ReturnType<typeof renderDocument>][] = [
    ['sample-rfq', renderDocument(buildRFQInvoice(rfq, 'DrinksHarbour'))],
    ['sample-po', renderDocument(buildPOInvoice(po, 'DrinksHarbour'))],
    ['sample-po-long', renderDocument(buildPOInvoice(longPo, 'DrinksHarbour'))],
    ['sample-bill', renderDocument(buildBillInvoice(bill, 'DrinksHarbour'))],
    [
      'sample-bill-paid',
      renderDocument(buildBillInvoice(paidBill, 'DrinksHarbour')),
    ],
    [
      'sample-transfer',
      renderDocument(buildTransferInvoice(transfer, 'DrinksHarbour')),
    ],
    [
      'sample-return',
      renderDocument(buildReturnInvoice(vendorReturn, 'DrinksHarbour')),
    ],
  ];
  for (const [name, doc] of docs) {
    writeFileSync(
      `${outDir}/${name}.pdf`,
      Buffer.from(doc.output('arraybuffer'))
    );
    console.log(`wrote ${outDir}/${name}.pdf pages=${doc.getNumberOfPages()}`);
  }
  expect(docs).toHaveLength(7);
});
