import { describe, it, expect } from 'vitest';
import {
  buildRFQInvoice,
  buildPOInvoice,
  buildBillInvoice,
  buildTransferInvoice,
  buildReturnInvoice,
} from './purchaseInvoice';
import { moneyWords } from './print/print-shared';
import type { PurchaseOrder } from '@/app/shared/purchases/types';
import type { VendorBill } from '@/services/vendorBill.service';
import type { StockTransfer } from '@/services/stockTransfer.service';
import type { VendorReturn } from '@/services/vendorReturn.service';

const rfq: PurchaseOrder = {
  _id: 'rfq-1',
  poNumber: 'RFQ-2026-0001',
  vendorName: 'Meads & Sons Distribution',
  currency: 'NGN',
  status: 'draft',
  type: 'rfq',
  createdAt: '2026-08-01T10:00:00.000Z',
  expectedArrival: '2026-09-01T00:00:00.000Z',
  validUntil: '2026-08-31T00:00:00.000Z',
  termsConditions: 'Quotes valid for 14 days. Delivery to Maitama store.',
  notes: 'Urgent restock before the Abuja weekend rush.',
  items: [
    {
      subProductId: 'sp-1',
      subProductName: 'Hennessy VS Cognac',
      sizeName: '70cl',
      sku: 'HNS-VS-070',
      quantity: 24,
      receivedQty: 0,
    },
    {
      subProductId: 'sp-2',
      subProductName: 'Moet Imperial Brut',
      sku: 'MOE-IMP-075',
      quantity: 12,
      receivedQty: 0,
    },
  ],
} as unknown as PurchaseOrder;

describe('buildRFQInvoice', () => {
  it('titles the document Request for Quotation with the RFQ number', () => {
    const html = buildRFQInvoice(rfq, 'DrinksHarbour');
    expect(html).toContain('Request for Quotation');
    expect(html).toContain('RFQ-2026-0001');
    expect(html).not.toContain('<title>Purchase Order');
  });

  it('addresses the vendor and shows the buyer', () => {
    const html = buildRFQInvoice(rfq, 'DrinksHarbour');
    expect(html).toContain('Meads &amp; Sons Distribution');
    expect(html).toContain('DrinksHarbour');
  });

  it('shows the quote validity window', () => {
    const html = buildRFQInvoice(rfq, 'DrinksHarbour');
    // 31 Aug 2026 in en-GB short format
    expect(html).toContain('31 Aug 2026');
  });

  it('lists requested lines without PO-only receiving columns', () => {
    const html = buildRFQInvoice(rfq, 'DrinksHarbour');
    expect(html).toContain('Hennessy VS Cognac');
    expect(html).toContain('HNS-VS-070');
    expect(html).not.toMatch(/Received/);
  });

  it('leaves blank quote columns for the vendor to fill in', () => {
    const html = buildRFQInvoice(rfq, 'DrinksHarbour');
    expect(html).toMatch(/Quoted Unit Price/);
    // No computed line totals — the RFQ asks for prices, it does not state them
    expect(html).not.toContain('totalCost');
  });

  it('breaks requested quantities into packs', () => {
    const packed = {
      ...rfq,
      items: [{ ...rfq.items[0], quantity: 31, packagingQty: 6 }], // 5 packs & 1 bottle
    } as unknown as PurchaseOrder;
    const html = buildRFQInvoice(packed, 'DrinksHarbour');
    expect(html).toContain('Packs');
    expect(html).toContain('5 packs &amp; 1 bottle');
  });

  it('includes terms and conditions when present', () => {
    const html = buildRFQInvoice(rfq, 'DrinksHarbour');
    expect(html).toContain('Quotes valid for 14 days');
  });

  it('includes notes when present', () => {
    const html = buildRFQInvoice(rfq, 'DrinksHarbour');
    expect(html).toContain('Urgent restock');
  });

  it('omits terms and notes sections when absent', () => {
    const bare = { ...rfq, termsConditions: undefined, notes: undefined };
    const html = buildRFQInvoice(bare as PurchaseOrder, 'DrinksHarbour');
    expect(html).not.toContain('Terms');
    expect(html).not.toContain('NOTES');
  });
});

describe('print documents — shared layout', () => {
  it('every document carries the company contact block', () => {
    const html = buildPOInvoice(
      { ...rfq, type: 'po', status: 'confirmed' } as unknown as PurchaseOrder,
      'DrinksHarbour'
    );
    expect(html).toContain('39 Gana St, Maitama');
    expect(html).toContain('accounts@drinksharbour.com');
  });

  it('tables repeat their header across printed pages and never split a row', () => {
    const html = buildRFQInvoice(rfq, 'DrinksHarbour');
    expect(html).toContain('table-header-group');
    expect(html).toContain('page-break-inside:avoid');
  });
});

describe('buildPOInvoice — detail', () => {
  const po = {
    ...rfq,
    _id: 'po-1',
    type: 'po',
    status: 'partially_received',
    paymentTerms: 'Net 30',
    approvedByName: 'Ada Obi',
    purchaseAgreement: { _id: 'ag-1', agreementNumber: 'AGR-001' },
    warehouse: { _id: 'w1', name: 'Maitama Store', code: 'MTM' },
    isBackorder: true,
    originalPO: 'po-orig',
    items: [
      {
        subProductId: 'sp-1',
        subProductName: 'Hennessy VS Cognac',
        sizeName: '70cl',
        sku: 'HNS-VS-070',
        uom: 'Units',
        quantity: 480,
        receivedQty: 200,
        unitCost: 10000,
        discount: 5,
        taxRate: 7.5,
      },
    ],
  } as unknown as PurchaseOrder;

  it('prints amounts with thousand separators and an outstanding column', () => {
    const html = buildPOInvoice(po, 'DrinksHarbour');
    expect(html).toContain('4,800,000.00');
    expect(html).toContain('10,000.00');
    expect(html).toContain('Outstanding');
    expect(html).toMatch(/>280</); // 480 − 200 still to arrive
  });

  it('shows the pack breakdown for each line', () => {
    const mixed = {
      ...po,
      items: [
        { ...po.items[0], quantity: 37, packagingQty: 6 }, // 6 packs & 1 bottle
      ],
    } as unknown as PurchaseOrder;
    const html = buildPOInvoice(mixed, 'DrinksHarbour');
    expect(html).toContain('Packs');
    expect(html).toContain('6 packs &amp; 1 bottle');
  });

  it('shows payment terms, destination warehouse and agreement reference', () => {
    const html = buildPOInvoice(po, 'DrinksHarbour');
    expect(html).toContain('Net 30');
    expect(html).toContain('Maitama Store');
    expect(html).toContain('AGR-001');
  });

  it('shows approval and backorder provenance when present', () => {
    const html = buildPOInvoice(po, 'DrinksHarbour');
    expect(html).toContain('Ada Obi');
    expect(html).toMatch(/Backorder/i);
  });

  it('states the total in words', () => {
    const html = buildPOInvoice(po, 'DrinksHarbour');
    expect(html).toContain('Four Million, Eight Hundred Thousand Naira Only');
  });
});

describe('buildBillInvoice — detail', () => {
  const bill = {
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
    amountDue: 2300000,
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
    ],
    payments: [
      {
        amount: 2000000,
        date: '2026-08-05T00:00:00.000Z',
        method: 'bank_transfer',
        reference: 'TRF-88991',
      },
    ],
  } as unknown as VendorBill;

  it('emphasises the balance due alongside subtotal/tax/total/paid', () => {
    const html = buildBillInvoice(bill, 'DrinksHarbour');
    expect(html).toContain('Balance Due');
    expect(html).toContain('2,300,000.00');
    expect(html).toContain('Subtotal');
  });

  it('lists the payment history', () => {
    const html = buildBillInvoice(bill, 'DrinksHarbour');
    expect(html).toContain('Payments');
    expect(html).toContain('TRF-88991');
    expect(html).toContain('2,000,000.00');
  });

  it('states the total in words and prints the payment terms', () => {
    const html = buildBillInvoice(bill, 'DrinksHarbour');
    expect(html).toContain('in words');
    expect(html).toContain('Four Million, Three Hundred Thousand Naira Only');
    expect(html).toContain('Net 30 from invoice date.');
  });
});

describe('buildTransferInvoice — detail', () => {
  const transfer = {
    transferNumber: 'TRF-2026-007',
    sourceWarehouse: { name: 'Central Warehouse', code: 'CWH' },
    destinationWarehouse: { name: 'Maitama Store', code: 'MTM' },
    status: 'confirmed',
    currency: 'NGN',
    scheduledDate: '2026-08-10T00:00:00.000Z',
    createdAt: '2026-08-01T00:00:00.000Z',
    totalValue: 1200000,
    createdBy: { name: 'Bola Ade' },
    approvedBy: { name: 'Ada Obi' },
    items: [
      {
        subProductName: 'Moet Imperial Brut',
        sizeName: '75cl',
        sku: 'MOE-IMP-075',
        quantity: 60,
        transferredQty: 60,
        costPrice: 20000,
      },
    ],
  } as unknown as StockTransfer;

  it('names who prepared and who approved the movement', () => {
    const html = buildTransferInvoice(transfer, 'DrinksHarbour');
    expect(html).toContain('Bola Ade');
    expect(html).toContain('Ada Obi');
  });

  it('flags lines that are still pending', () => {
    const partial = {
      ...transfer,
      items: [{ ...transfer.items[0], transferredQty: 40 }],
    } as unknown as StockTransfer;
    const html = buildTransferInvoice(partial, 'DrinksHarbour');
    expect(html).toContain('20 pending');
  });
});

describe('buildReturnInvoice — detail', () => {
  const ret = {
    returnNumber: 'RET-2026-003',
    vendorName: 'Meads & Sons Distribution',
    poNumber: 'PO-2026-0100',
    currency: 'NGN',
    status: 'shipped',
    returnDate: '2026-08-06T00:00:00.000Z',
    reason: 'damaged_in_transit',
    subtotal: 240000,
    taxAmount: 0,
    totalAmount: 240000,
    refundAmount: 240000,
    refundStatus: 'processing',
    refundMethod: 'bank_transfer',
    refundReference: 'RFD-77120',
    shippingCarrier: 'GIG Logistics',
    trackingNumber: 'GIG-99182733',
    returnAddress: '39 Gana St, Maitama, Abuja',
    items: [
      {
        subProductName: 'Moet Imperial Brut',
        sizeName: '75cl',
        sku: 'MOE-IMP-075',
        reason: 'damaged_in_transit',
        quantity: 2,
        unitPrice: 120000,
        amount: 240000,
      },
    ],
  } as unknown as VendorReturn;

  it('shows the shipment details for the physical return', () => {
    const html = buildReturnInvoice(ret, 'DrinksHarbour');
    expect(html).toContain('GIG Logistics');
    expect(html).toContain('GIG-99182733');
    expect(html).toContain('39 Gana St, Maitama, Abuja');
  });

  it('shows the refund trail', () => {
    const html = buildReturnInvoice(ret, 'DrinksHarbour');
    expect(html).toContain('RFD-77120');
    expect(html).toContain('bank transfer');
  });
});

describe('moneyWords', () => {
  it('spells whole naira amounts', () => {
    expect(moneyWords(4800000, 'NGN')).toBe(
      'Four Million, Eight Hundred Thousand Naira Only'
    );
    expect(moneyWords(150000, 'NGN')).toBe(
      'One Hundred Fifty Thousand Naira Only'
    );
  });

  it('spells the minor unit when present', () => {
    expect(moneyWords(1250.5, 'NGN')).toBe(
      'One Thousand, Two Hundred Fifty Naira, Fifty Kobo Only'
    );
    expect(moneyWords(0.99, 'USD')).toBe('Ninety-Nine Cents Only');
  });

  it('handles zero and single digits', () => {
    expect(moneyWords(0, 'NGN')).toBe('Zero Naira Only');
    expect(moneyWords(7, 'GBP')).toBe('Seven Pounds Only');
  });

  it('falls back to the currency code for unknown currencies', () => {
    expect(moneyWords(5, 'XXX')).toBe('Five XXX Only');
  });
});
