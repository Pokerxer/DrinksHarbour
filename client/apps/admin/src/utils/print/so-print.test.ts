import { describe, it, expect } from 'vitest';
import { buildSalesDoc } from './so-print';
import { renderDocument } from './pdf-render';
import type { SalesOrder } from '@/services/salesOrder.service';

const baseOrder: SalesOrder = {
  _id: 'so1',
  soNumber: 'QT-2026-0007',
  docType: 'quotation',
  currency: 'NGN',
  items: [
    {
      _id: 'l1',
      name: 'Hennessy VS – 70cl',
      sku: 'HNS-VS-070',
      quantity: 25,
      packSize: 12,
      uom: 'Cases',
      unitPrice: 18000,
      discount: 5,
      discountType: 'percentage',
      taxRate: 7.5,
      lineTotal: 427500,
      fulfilledQty: 0,
      postedQty: 0,
      returnedQty: 0,
    },
    {
      _id: 'l2',
      lineType: 'section',
      name: 'Spirits',
      quantity: 0,
      unitPrice: 0,
      discount: 0,
      lineTotal: 0,
      fulfilledQty: 0,
      postedQty: 0,
      returnedQty: 0,
    },
    {
      _id: 'l3',
      lineType: 'note',
      description: 'Deliver before 6pm',
      quantity: 0,
      unitPrice: 0,
      discount: 0,
      lineTotal: 0,
      fulfilledQty: 0,
      postedQty: 0,
      returnedQty: 0,
    },
  ],
  subtotal: 450000,
  discountTotal: 22500,
  taxTotal: 32062.5,
  total: 482062.5,
  customerSnapshot: { name: 'Ada Obi', phone: '+2348035550100' },
  invoiceAddress: { street: '1 Market Rd', city: 'Abuja', state: 'FCT' },
  deliveryAddress: { street: '9 Dock St', city: 'Lagos' },
  quoteStatus: 'draft',
  fulfillments: [],
};

const warehouse = {
  _id: 'wh1',
  name: 'Maitama Store',
  code: 'MAI',
  type: 'store',
  address: {
    line1: '39 Gana Street',
    city: 'Abuja',
    state: 'FCT',
    country: 'Nigeria',
  },
  contact: { phone: '+234 803 555 0100', email: 'maitama@drinksharbour.com' },
};

describe('buildSalesDoc', () => {
  it('makes the selected warehouse the issuing entity on paper', () => {
    const model = buildSalesDoc(
      { ...baseOrder, warehouseId: warehouse },
      'DrinksHarbour',
      'quotation'
    );
    expect(model.companyName).toBe('Maitama Store');
    expect(model.head?.address).toBe('39 Gana Street');
    expect(model.parties[0]).toMatchObject({
      heading: 'Fulfil From (Seller)',
      name: 'Maitama Store',
    });
    // The fulfilment warehouse surfaces in the meta strip too.
    expect(model.meta).toContainEqual(['Fulfil From', 'Maitama Store']);
  });

  it('falls back to the tenant company when the warehouse ref is a bare id', () => {
    const model = buildSalesDoc(
      { ...baseOrder, warehouseId: 'wh1' },
      'DrinksHarbour',
      'quotation'
    );
    expect(model.companyName).toBe('DrinksHarbour');
    expect(model.head).toBeUndefined();
  });

  it('renders product rows with pack breakdowns and folds notes into sections', () => {
    const model = buildSalesDoc(baseOrder, 'DrinksHarbour', 'quotation');
    const productRow = model.table.rows.find((r) => r[0].text.includes('Hennessy'))!;
    expect(productRow[1].text).toBe('25');
    expect(productRow[1].sub).toContain('2 packs & 1 bottle');
    // Section lines become group headers; note lines never render as table rows.
    expect(model.table.rows.some((r) => r[0].text === 'Spirits')).toBe(true);
    expect(model.table.rows.some((r) => r[0].text.includes('6pm'))).toBe(false);
    const notes = model.sections.find((s) => s.title === 'Notes');
    expect(notes?.body).toContain('Deliver before 6pm');
  });

  it('carries totals, amount-in-words and a distinct title per variant', () => {
    // Variant tracks the document kind in the app: quotations/proformas are
    // printed from quotation docs, sales-order from order docs.
    const cases = [
      ['quotation', 'quotation', 'Quotation'],
      ['proforma', 'quotation', 'Pro-Forma Invoice'],
      ['sales-order', 'order', 'Sales Order'],
    ] as const;
    for (const [variant, docType, title] of cases) {
      const model = buildSalesDoc(
        { ...baseOrder, docType },
        'DrinksHarbour',
        variant
      );
      expect(model.docTitle).toBe(title);
      expect(model.totals.at(-1)).toMatchObject({
        label: 'Total',
        value: 'NGN 482,062.50',
        variant: 'grand',
      });
      expect(model.words).toBe(
        'Four Hundred Eighty-Two Thousand, Sixty-Two Naira, Fifty Kobo Only'
      );
    }
  });

  it('produces a real PDF through renderDocument', () => {
    const doc = renderDocument(buildSalesDoc(baseOrder, 'DrinksHarbour', 'proforma'));
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
    const bytes = doc.output('arraybuffer') as ArrayBuffer;
    expect(bytes.byteLength).toBeGreaterThan(1000);
    const raw = Buffer.from(bytes).toString('latin1');
    expect(raw.startsWith('%PDF-')).toBe(true);
    expect(raw).toContain('/Title (Pro-Forma Invoice QT-2026-0007)');
  });
});
