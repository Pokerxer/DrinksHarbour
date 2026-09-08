import { expect, it, vi, afterEach } from 'vitest';
import { buildA4Invoice } from '../a4-invoice';
import { requestDocumentExport, DOCUMENT_EXPORT_EVENT } from '../document-export';
afterEach(() => vi.unstubAllGlobals());
it('A4 invoices preserve stored totals, refunds and payment data', () => {
  const m = buildA4Invoice(
    {
      orderNumber: 'POS-12',
      totalAmount: 950,
      subtotal: 1000,
      discountTotal: 50,
      refunds: [{ totalRefunded: 200 }],
      paymentMethod: 'cash',
      items: [{ name: 'Wine', quantity: 2, priceAtPurchase: 500, itemSubtotal: 1000 }],
    },
    { name: 'My Tenant', address: ['Tenant address'] }
  );
  expect(m.companyName).toBe('MY TENANT');
  expect(m.totals.some((t) => t.value.includes('950.00'))).toBe(true);
  expect(m.totals.some((t) => t.value.includes('200.00'))).toBe(true);
  expect(m.table.rows[0][0].text).toBe('Wine');
});
it('legacy export requests carry all selected documents to the shared dialog', () => {
  const target = new EventTarget();
  vi.stubGlobal('window', target);
  const receive = vi.fn();
  target.addEventListener(DOCUMENT_EXPORT_EVENT, receive);
  const model = buildA4Invoice({ orderNumber: 'POS-12' }, { name: 'Tenant' });
  requestDocumentExport([model, model]);
  expect((receive.mock.calls[0][0] as CustomEvent).detail.models).toHaveLength(2);
});
import { buildHistoryDocument } from '../history-document';
import { buildStockDoc } from '../stock-print';
it('credit notes preserve the selected refund rather than the whole order total', () => {
  const doc = buildHistoryDocument(
    { orderNumber: 'ORDER-1', total: 900, items: [{ name: 'Wine' }] },
    'return',
    'Tenant',
    {
      receiptNumber: 'REFUND-1',
      totalRefunded: 120,
      items: [{ orderItemIndex: 0, quantity: 1, amount: 120, unitPrice: 120 }],
    }
  );
  expect(doc.kind).toBe('return');
  expect(doc.number).toBe('REFUND-1');
  expect(doc.totals[0].value).toContain('120.00');
  expect(doc.totals[0].value).not.toContain('900');
});
it('stock exports keep separate locations and only include valuation when requested', () => {
  const rows = [
    {
      _id: '1',
      warehouseId: 'w',
      warehouseName: 'Store',
      subProductId: 's',
      productName: 'Wine',
      sku: 'SKU',
      sizeId: 'size',
      sizeName: '750ml',
      currentQuantity: 2,
      reservedQuantity: 1,
      costPrice: 50,
      minStockLevel: 0,
      earliestExpiry: null,
    },
  ];
  const stock = buildStockDoc(rows, 'Stock', false);
  expect(stock.kind).toBe('stock');
  expect(stock.table.columns.some((c) => c.label === 'Unit cost')).toBe(false);
  expect(buildStockDoc(rows, 'Valuation', true).totals.at(-1)?.value).toContain('100.00');
});
import { withDocumentIssuer } from '../document-issuer';
it('uses tenant contact details for legacy platform fallbacks and preserves warehouse issuers', () => {
  const model = buildA4Invoice({ orderNumber: 'POS-1' });
  const tenant = { name: 'Tenant shop', contactEmail: 'shop@example.test' };
  const branded = withDocumentIssuer(model, tenant);
  expect(branded.companyName).toBe('Tenant shop');
  expect(branded.head?.email).toBe('shop@example.test');
  expect(branded.head?.address).toBeUndefined();
  const warehouse = {
    ...model,
    companyName: 'Maitama warehouse',
    head: { address: 'Warehouse address' },
  };
  expect(withDocumentIssuer(warehouse, tenant)).toBe(warehouse);
});
it('keeps size, per-line returns and delivery details when migrating history invoices', () => {
  const doc = buildA4Invoice({
    orderNumber: 'POS-7',
    total: 200,
    items: [{ name: 'Water', quantity: 2, size: { displayName: '330 ml' } }],
    refunds: [{ totalRefunded: 100, items: [{ orderItemIndex: 0, quantity: 1 }] }],
    shipping: { address: 'Delivery street', city: 'Abuja' },
    notes: 'Call on arrival',
  });
  expect(doc.table.rows[0][0].sub).toContain('330 ml');
  expect(doc.table.rows[0][0].sub).toContain('1 refunded');
  expect(doc.parties.some((p) => p.lines?.some((line) => line.includes('Delivery street')))).toBe(
    true
  );
  expect(doc.sections.some((s) => s.body === 'Call on arrival')).toBe(true);
});
