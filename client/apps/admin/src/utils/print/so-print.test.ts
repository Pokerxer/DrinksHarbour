import { describe, it, expect } from 'vitest';
import { inflateSync } from 'node:zlib';
import { buildSalesDoc, printableBankAccounts } from './so-print';
import { renderDocument } from './pdf-render';
import type { QuoteStatus, SalesOrder } from '@/services/salesOrder.service';

/** Inflate a PDF's page streams so drawn text is greppable. */
function pageStreams(raw: string): string {
  return Array.from(raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g))
    .map((match) => {
      try {
        return inflateSync(Buffer.from(match[1], 'latin1')).toString('latin1');
      } catch {
        return match[1];
      }
    })
    .join('\n');
}

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

describe('printableBankAccounts', () => {
  it('keeps a complete account and trims it', () => {
    expect(
      printableBankAccounts({
        issuerBankAccounts: [
          { bankName: '  GTBank ', accountName: ' DrinksHarbour Ltd ', accountNumber: '0123456789' },
        ],
      })
    ).toEqual([
      { bankName: 'GTBank', accountName: 'DrinksHarbour Ltd', accountNumber: '0123456789' },
    ]);
  });

  it('drops an account that cannot be paid into', () => {
    // A bank with no number, and a number with no bank, are both unusable on an
    // invoice — printing the label with nothing after it is the failure.
    expect(
      printableBankAccounts({
        issuerBankAccounts: [
          { bankName: 'Zenith', accountNumber: '' },
          { bankName: '', accountNumber: '999' },
          {},
        ],
      })
    ).toEqual([]);
  });

  it('treats an absent list as no accounts', () => {
    expect(printableBankAccounts({})).toEqual([]);
    expect(printableBankAccounts({ issuerBankAccounts: undefined })).toEqual([]);
  });
});

describe('sales documents — payment details', () => {
  const payable = {
    ...baseOrder,
    docType: 'order' as const,
    issuerBankAccounts: [
      { bankName: 'GTBank', accountName: 'DrinksHarbour Ltd', accountNumber: '0123456789' },
      { bankName: 'Zenith', accountName: 'DrinksHarbour Ltd', accountNumber: '9876543210' },
    ],
  };
  const payment = (doc: ReturnType<typeof buildSalesDoc>) =>
    doc.sections.find((s) => s.title === 'Payment Details');

  it('prints every remittance account on a sales order', () => {
    expect(payment(buildSalesDoc(payable, 'DrinksHarbour', 'sales-order'))?.body).toBe(
      [
        'Bank: GTBank',
        'Account Name: DrinksHarbour Ltd',
        'Account Number: 0123456789',
        '',
        'Bank: Zenith',
        'Account Name: DrinksHarbour Ltd',
        'Account Number: 9876543210',
      ].join('\n')
    );
  });

  it('separates a single account from a missing account name', () => {
    const doc = buildSalesDoc(
      { ...payable, issuerBankAccounts: [{ bankName: 'UBA', accountNumber: '3011223344' }] },
      'DrinksHarbour',
      'sales-order'
    );
    // No "Account Name:" line with nothing after it.
    expect(payment(doc)?.body).toBe('Bank: UBA\nAccount Number: 3011223344');
  });

  it('prints them on a pro-forma, which is issued for advance payment', () => {
    expect(payment(buildSalesDoc(payable, 'DrinksHarbour', 'proforma'))?.body).toContain(
      'Account Number: 0123456789'
    );
  });

  it('prints them on a quotation — a quote is commonly converted by paying it', () => {
    // Was deliberately excluded ("nothing is owed until accepted"). That made a
    // quotation with no payment section indistinguishable from a bank account
    // that had failed to save, which is how it was reported: a tenant's real,
    // valid account looked like it had not been saved at all.
    const doc = buildSalesDoc(
      { ...payable, docType: 'quotation', quoteStatus: 'sent' },
      'DrinksHarbour',
      'quotation'
    );
    expect(payment(doc)?.body).toContain('Account Number: 0123456789');
  });

  it('prints them on a quotation in every quote state', () => {
    // The block follows the account, not the lifecycle — no state should drop it.
    for (const quoteStatus of [
      'draft',
      'sent',
      'accepted',
      'declined',
      'expired',
    ] as QuoteStatus[]) {
      const doc = buildSalesDoc(
        { ...payable, docType: 'quotation', quoteStatus },
        'DrinksHarbour',
        'quotation'
      );
      expect(payment(doc)?.body, `quoteStatus=${quoteStatus}`).toContain(
        'Account Number: 0123456789'
      );
    }
  });

  it('omits them from a quotation only when the tenant has no usable account', () => {
    const doc = buildSalesDoc(
      { ...baseOrder, docType: 'quotation', quoteStatus: 'sent' },
      'DrinksHarbour',
      'quotation'
    );
    expect(payment(doc)).toBeUndefined();
  });

  it('omits the block entirely when the tenant has no account on file', () => {
    const doc = buildSalesDoc(baseOrder, 'DrinksHarbour', 'sales-order');
    expect(payment(doc)).toBeUndefined();
    // Notes and terms are untouched by the omission.
    expect(doc.sections.map((s) => s.title)).toEqual(['Notes']);
  });

  it('puts the account on the page, not just on the model', () => {
    const doc = renderDocument(buildSalesDoc(payable, 'DrinksHarbour', 'sales-order'));
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
    const bytes = doc.output('arraybuffer') as ArrayBuffer;
    expect(bytes.byteLength).toBeGreaterThan(1000);
    // Page content is a compressed stream — inflate it to prove the block is
    // really drawn, not merely present on the model. The renderer upper-cases
    // section headings, so the title is matched as it is actually printed.
    const content = pageStreams(doc.output());
    expect(content).toContain('PAYMENT DETAILS');
    expect(content).toContain('Bank: GTBank');
    expect(content).toContain('Account Number: 0123456789');
    expect(content).toContain('Account Number: 9876543210');
  });
});
