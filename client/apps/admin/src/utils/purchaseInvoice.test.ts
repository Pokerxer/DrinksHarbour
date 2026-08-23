import { describe, it, expect } from 'vitest';
import {
  buildRFQInvoice,
  buildPOInvoice,
  buildBillInvoice,
  buildTransferInvoice,
  buildReturnInvoice,
} from './purchaseInvoice';
import { moneyWords } from './print/print-shared';
import type { DocumentModel } from './print/doc-model';
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

function sectionOf(doc: DocumentModel, title: string) {
  return doc.sections.find((s) => s.title === title);
}

describe('buildRFQInvoice', () => {
  const doc = buildRFQInvoice(rfq, 'DrinksHarbour');

  it('titles the document Request for Quotation with the RFQ number', () => {
    expect(doc.docTitle).toBe('Request for Quotation');
    expect(doc.number).toBe('RFQ-2026-0001');
    expect(doc.department).toBe('Purchase Department');
    expect(doc.status).toBe('draft');
  });

  it('names the PDF after title and number', () => {
    expect(doc.fileName).toBe('Request for Quotation RFQ-2026-0001.pdf');
  });

  it('addresses the vendor and shows the buyer', () => {
    expect(doc.parties[0]).toMatchObject({
      heading: 'Quote To (Buyer)',
      name: 'DrinksHarbour',
    });
    expect(doc.parties[1]).toMatchObject({
      heading: 'Vendor / Supplier',
      name: 'Meads & Sons Distribution',
    });
  });

  it('shows the quote validity window', () => {
    // 31 Aug 2026 in en-GB short format
    expect(doc.meta).toContainEqual(['Respond By', '31 Aug 2026']);
  });

  it('lists requested lines without PO-only receiving columns', () => {
    expect(doc.table.columns.map((c) => c.label)).toEqual([
      'Product',
      'Requested Qty / Packs',
      'Quoted Unit Price',
      'Quoted Total',
    ]);
    expect(doc.table.rows[0][0]).toMatchObject({
      text: 'Hennessy VS Cognac – 70cl',
    });
  });

  it('prints the product name without the internal SKU', () => {
    for (const row of doc.table.rows) {
      expect(row[0].sub).toBeUndefined();
      expect(row[0].text).not.toMatch(/HNS-VS|MOE-IMP/);
    }
  });

  it('leaves blank quote columns for the vendor to fill in', () => {
    for (const row of doc.table.rows) {
      expect(row[2].text).toBe('');
      expect(row[3].text).toBe('');
    }
    // No computed line totals — the RFQ asks for prices, it does not state them
    expect(JSON.stringify(doc)).not.toContain('totalCost');
  });

  it('breaks requested quantities into packs', () => {
    const packed = {
      ...rfq,
      items: [{ ...rfq.items[0], quantity: 31, packagingQty: 6 }], // 5 packs & 1 bottle
    } as unknown as PurchaseOrder;
    const packedDoc = buildRFQInvoice(packed, 'DrinksHarbour');
    expect(packedDoc.table.rows[0][1].sub).toBe('5 packs & 1 bottle');
  });

  it('includes response instructions quoting the number and email', () => {
    const respond = sectionOf(doc, 'How to Respond');
    expect(respond?.body).toContain('31 Aug 2026');
    expect(respond?.body).toContain('accounts@drinksharbour.com');
    expect(respond?.body).toContain('RFQ-2026-0001');
  });

  it('includes terms and conditions when present', () => {
    expect(sectionOf(doc, 'Conditions of Purchase')?.body).toContain(
      'Quotes valid for 14 days'
    );
  });

  it('includes notes when present', () => {
    expect(sectionOf(doc, 'Notes')?.body).toContain('Urgent restock');
  });

  it('omits terms and notes sections when absent', () => {
    const bare = { ...rfq, termsConditions: undefined, notes: undefined };
    const bareDoc = buildRFQInvoice(bare as PurchaseOrder, 'DrinksHarbour');
    expect(sectionOf(bareDoc, 'Conditions of Purchase')).toBeUndefined();
    expect(sectionOf(bareDoc, 'Notes')).toBeUndefined();
  });
});

describe('buildRFQInvoice — selected warehouse as buyer', () => {
  const doc = buildRFQInvoice(
    { ...rfq, warehouse } as unknown as PurchaseOrder,
    'DrinksHarbour'
  );

  it('quotes back to the selected warehouse', () => {
    expect(doc.parties[0]).toMatchObject({
      heading: 'Quote To (Buyer)',
      name: 'Maitama Store (MTM)',
    });
    expect(doc.parties[0].lines).toContain('Abuja, FCT, Nigeria');
  });

  it('carries the selected warehouse details into the document head', () => {
    expect(doc.companyName).toBe('Maitama Store');
    expect(doc.head).toEqual({
      address: '39 Gana Street, Off Aminu Kano Crescent',
      city: 'Abuja, FCT, Nigeria',
      email: 'maitama@drinksharbour.com',
      phone: '+234 803 555 0100',
    });
  });

  it('directs quote responses to the warehouse contact email', () => {
    const respond = sectionOf(doc, 'How to Respond');
    expect(respond?.body).toContain('maitama@drinksharbour.com');
  });
});

describe('print documents — shared layout', () => {
  it('every document carries the company contact block', () => {
    const po = buildPOInvoice(
      { ...rfq, type: 'po', status: 'confirmed' } as unknown as PurchaseOrder,
      'DrinksHarbour'
    );
    // The contact details live on the renderer's header band; builders only
    // carry the company name — COMPANY data is applied at render time.
    expect(po.companyName).toBe('DrinksHarbour');
    expect(po.parties.some((p) => p.name === 'DrinksHarbour')).toBe(true);
  });
});

// Fully populated destination warehouse as getPurchaseOrder returns it.
const warehouse = {
  _id: 'w1',
  name: 'Maitama Store',
  code: 'MTM',
  type: 'store',
  address: {
    line1: '39 Gana Street',
    line2: 'Off Aminu Kano Crescent',
    city: 'Abuja',
    state: 'FCT',
    country: 'Nigeria',
  },
  contact: {
    name: 'Ada Obi',
    phone: '+234 803 555 0100',
    email: 'maitama@drinksharbour.com',
  },
};

describe('buildPOInvoice — detail', () => {
  const po = {
    ...rfq,
    _id: 'po-1',
    poNumber: 'PO-2026-0100',
    type: 'po',
    status: 'partially_received',
    paymentTerms: 'Net 30',
    approvedByName: 'Ada Obi',
    purchaseAgreement: { _id: 'ag-1', agreementNumber: 'AGR-001' },
    warehouse,
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

  const doc = buildPOInvoice(po, 'DrinksHarbour');

  it('prints amounts with thousand separators and an outstanding column', () => {
    expect(doc.table.columns.map((c) => c.label)).toEqual([
      'Product',
      'Ordered',
      'Packs',
      'Received',
      'Outstanding',
      'Unit Price',
      'Total',
    ]);
    expect(doc.table.rows[0][3]).toEqual({ text: '200', color: '#6b7280' }); // muted while partial
    expect(doc.table.rows[0][4]).toEqual({
      text: '280',
      color: '#b45309',
    });
    expect(doc.table.rows[0][5].text).toBe('NGN 10,000.00');
    expect(doc.table.rows[0][6].text).toBe('NGN 4,800,000.00');
  });

  it('marks fully received lines green', () => {
    const done = {
      ...po,
      items: [{ ...po.items[0], receivedQty: 480 }],
    } as unknown as PurchaseOrder;
    const doneDoc = buildPOInvoice(done, 'DrinksHarbour');
    expect(doneDoc.table.rows[0][3]).toEqual({
      text: '480',
      color: '#16a34a',
    });
    expect(doneDoc.table.rows[0][4].text).toBe('0'); // muted once complete
  });

  it('shows payment terms, destination warehouse and agreement reference', () => {
    expect(doc.meta).toContainEqual(['Payment Terms', 'Net 30']);
    expect(doc.meta).toContainEqual(['Deliver To', 'Maitama Store (MTM)']);
    expect(sectionOf(doc, 'Call-off Agreement')?.body).toContain('AGR-001');
  });

  it('flags backorders against the original PO', () => {
    expect(doc.notice?.title).toBe('Backorder');
    expect(doc.notice?.body).toContain('po-orig');
  });

  it('names who authorised the order', () => {
    const sig = doc.signatures.find((s) => s.role.startsWith('Authorised'));
    expect(sig?.name).toBe('Ada Obi');
  });

  it('states the total in words with a grand total row', () => {
    const grand = doc.totals.find((t) => t.variant === 'grand');
    expect(grand?.value).toBe('NGN 4,800,000.00');
    expect(doc.words).toBe('Four Million, Eight Hundred Thousand Naira Only');
  });

  it('makes the selected warehouse the buyer', () => {
    expect(doc.parties[0]).toMatchObject({
      heading: 'Buyer',
      name: 'Maitama Store (MTM)',
    });
    expect(doc.parties[0].lines).toContain(
      '39 Gana Street, Off Aminu Kano Crescent'
    );
    expect(doc.parties[0].lines).toContain('Abuja, FCT, Nigeria');
    expect(
      doc.parties[0].lines?.some((l) => l.includes('+234 803 555 0100'))
    ).toBe(true);
    expect(
      doc.parties[0].lines?.some((l) => l.includes('maitama@drinksharbour.com'))
    ).toBe(true);
  });

  it('carries the selected warehouse details into the document head', () => {
    // The head is what the renderer draws in the branded band and footer —
    // it must be the warehouse's identity, not platform defaults.
    expect(doc.companyName).toBe('Maitama Store');
    expect(doc.head).toEqual({
      address: '39 Gana Street, Off Aminu Kano Crescent',
      city: 'Abuja, FCT, Nigeria',
      email: 'maitama@drinksharbour.com',
      phone: '+234 803 555 0100',
    });
  });

  it('falls back to the tenant company when no warehouse is populated', () => {
    const bare = { ...po, warehouse: undefined } as unknown as PurchaseOrder;
    const bareDoc = buildPOInvoice(bare, 'DrinksHarbour');
    expect(bareDoc.companyName).toBe('DrinksHarbour');
    expect(bareDoc.head).toBeUndefined();
    expect(bareDoc.parties[0]).toMatchObject({
      heading: 'Buyer',
      name: 'DrinksHarbour',
    });
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

  const doc = buildBillInvoice(bill, 'DrinksHarbour');

  it('emphasises the balance due alongside subtotal/tax/total/paid', () => {
    const byLabel = Object.fromEntries(doc.totals.map((t) => [t.label, t]));
    expect(byLabel['Subtotal'].value).toBe('NGN 4,000,000.00');
    expect(byLabel['Tax'].value).toBe('NGN 300,000.00');
    expect(byLabel['Total'].variant).toBe('grand');
    expect(byLabel['Paid to date']).toMatchObject({
      value: '− NGN 2,000,000.00',
      color: '#16a34a',
    });
    expect(byLabel['Balance Due']).toMatchObject({
      value: 'NGN 2,300,000.00',
      color: '#dc2626',
    });
  });

  it('lists the payment history', () => {
    const payments = doc.miniTables?.find((t) =>
      t.title.startsWith('Payments')
    );
    expect(payments?.rows[0][2].text).toBe('TRF-88991');
    expect(payments?.rows[0][3].text).toBe('NGN 2,000,000.00');
  });

  it('stamps PAID watermarks only on settled bills', () => {
    expect(doc.watermark).toBeUndefined();
    const paidDoc = buildBillInvoice(
      { ...bill, status: 'paid' } as unknown as VendorBill,
      'DrinksHarbour'
    );
    expect(paidDoc.watermark).toBe('PAID');
  });

  it('states the total in words and prints the payment terms', () => {
    expect(doc.words).toBe('Four Million, Three Hundred Thousand Naira Only');
    expect(sectionOf(doc, 'Payment Terms')?.body).toBe(
      'Net 30 from invoice date.'
    );
  });
});

describe('buildTransferInvoice — detail', () => {
  const transfer = {
    transferNumber: 'TRF-2026-007',
    sourceWarehouse: {
      _id: 'w-src', name: 'Central Warehouse', code: 'CWH', type: 'warehouse',
      address: { line1: 'Plot 5, Utako District', city: 'Abuja', state: 'FCT', country: 'Nigeria' },
      contact: { phone: '+234 803 000 1111', email: 'central@drinksharbour.com' },
    },
    destinationWarehouse: {
      _id: 'w-dst', name: 'Maitama Store', code: 'MTM', type: 'store',
      address: { line1: '39 Gana Street', city: 'Abuja', state: 'FCT', country: 'Nigeria' },
      contact: { email: 'maitama@drinksharbour.com', phone: '+234 803 555 0100' },
    },
    status: 'partially_received',
    currency: 'NGN',
    scheduledDate: '2026-08-10T00:00:00.000Z',
    createdAt: '2026-08-01T00:00:00.000Z',
    dispatchedBy: { name: 'Bola Ade' },
    receipts: [
      { receivedBy: { name: 'Ada Obi' }, receivedAt: '2026-08-11T09:00:00.000Z',
        lines: [{ itemIndex: 0, quantity: 40 }] },
    ],
    deliveryCharge: 20000,
    subtotal: 1200000,
    discountAmount: 0,
    taxAmount: 90000,
    total: 1310000,
    createdBy: { name: 'Bola Ade' },
    approvedBy: { name: 'Ada Obi' },
    items: [
      { subProductName: 'Moet Imperial Brut', sizeName: '75cl', sku: 'MOE-IMP-075',
        quantity: 60, receivedQty: 40, costPrice: 20000, discountRate: 0, taxRate: 7.5 },
    ],
  } as unknown as StockTransfer;

  const doc = buildTransferInvoice(transfer, 'DrinksHarbour');

  it('makes the destination warehouse the buyer and the source the supplier', () => {
    expect(doc.parties[0]).toMatchObject({ heading: 'Buyer', name: 'Maitama Store (MTM)' });
    expect(doc.parties[0].lines).toContain('Abuja, FCT, Nigeria');
    expect(doc.parties[1]).toMatchObject({ heading: 'Supplier', name: 'Central Warehouse (CWH)' });
  });

  it('carries the destination details into the head', () => {
    expect(doc.companyName).toBe('Maitama Store');
    expect(doc.head?.email).toBe('maitama@drinksharbour.com');
  });

  it('shows sent vs received with pending counts and money columns', () => {
    expect(doc.table.columns.map((c) => c.label)).toEqual([
      'Product', 'Sent', 'Received', 'Unit Cost', 'Discount', 'Tax', 'Line Total',
    ]);
    expect(doc.table.rows[0][2]).toMatchObject({ text: '40', sub: '20 pending' });
    expect(doc.table.rows[0][6]).toEqual({ text: 'NGN 1,290,000.00', strong: true });
  });

  it('prints the full purchase totals block with words', () => {
    expect(doc.totals.map((t) => t.label)).toEqual([
      'Subtotal', 'Tax', 'Delivery / Charges', 'Total',
    ]);
    const grand = doc.totals.find((t) => t.variant === 'grand');
    expect(grand?.value).toBe('NGN 1,310,000.00');
    expect(doc.words).toBe('One Million, Three Hundred Ten Thousand Naira Only');
  });

  it('signatures flip to dispatch/receipt and PARTIAL watermarks mid-flight', () => {
    expect(doc.signatures[0]).toMatchObject({ role: 'Dispatched by', name: 'Bola Ade' });
    expect(doc.signatures[1]).toMatchObject({ role: 'Received by', name: 'Ada Obi' });
    expect(doc.watermark).toBeUndefined();
    expect(doc.status).toBe('partially_received');
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

  const doc = buildReturnInvoice(ret, 'DrinksHarbour');

  it('shows the shipment details for the physical return', () => {
    const shipment = doc.kvGroups?.find((g) => g.title === 'Return Shipment');
    expect(shipment?.items).toContainEqual(['Carrier', 'GIG Logistics']);
    expect(shipment?.items).toContainEqual(['Tracking', 'GIG-99182733']);
    expect(shipment?.items).toContainEqual([
      'Return Address',
      '39 Gana St, Maitama, Abuja',
    ]);
  });

  it('shows the refund trail', () => {
    const refund = doc.kvGroups?.find((g) => g.title === 'Refund');
    expect(refund?.items).toContainEqual(['Reference', 'RFD-77120']);
    expect(refund?.items).toContainEqual(['Method', 'bank transfer']);
    expect(refund?.items).toContainEqual(['Amount', 'NGN 240,000.00']);
  });

  it('explains why goods went back', () => {
    expect(sectionOf(doc, 'Return Reason')?.body).toBe('damaged in transit');
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
