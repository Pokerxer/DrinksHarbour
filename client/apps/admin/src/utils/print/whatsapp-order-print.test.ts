import { describe, it, expect } from 'vitest';
import { buildWhatsappOrderDoc } from './whatsapp-order-print';
import type { Order } from '@/services/order.service';

const order = {
  _id: 'o1', orderNumber: 'DH2611140001', createdAt: '2026-11-14T09:00:00Z',
  subtotal: 57600, discountTotal: 0, shippingFee: 2500, totalAmount: 60100, currency: 'NGN',
  paymentStatus: 'paid', paymentMethod: 'bank_transfer',
  items: [{ productName: 'Lagar dos Perdigões Colheita Vinho Tinto', quantity: 2, priceAtPurchase: 28800, itemSubtotal: 57600, size: { displayName: '75cl (Standard)' }, tenant: { name: 'Wyn City' } }],
  shippingAddress: { fullName: 'Smoke Tester', email: 's@e.com', phone: '+234…', addressLine1: '1 Street', city: 'MC', state: 'FCT - Abuja', country: 'Nigeria' },
  printLines: [
    { lineType: 'section', name: 'Wines', description: '', productIndex: null },
    { lineType: 'product', name: '', description: 'chilled', productIndex: 0 },
    { lineType: 'note', name: '', description: 'deliver before Friday', productIndex: null },
  ],
} as unknown as Order;

describe('buildWhatsappOrderDoc', () => {
  it('renders sections, notes and product rows from printLines', () => {
    const doc = buildWhatsappOrderDoc(order, 'quotation');
    expect(doc.docTitle).toBe('Quotation');
    expect(doc.table.rows[0][0].text).toBe('Wines');                       // section header
    expect(doc.table.rows[1][0].sub).toContain('chilled');                  // per-line description
    expect(doc.table.rows[1][5].text).toContain('57,600');                  // line total
    expect(doc.table.rows[2][0].text).toBe('deliver before Friday');        // note row
    expect(doc.totals.at(-1)!.value).toContain('60,100');
  });
  it('invoice variant carries the payment block and paid status', () => {
    const doc = buildWhatsappOrderDoc(order, 'invoice');
    expect(doc.docTitle).toBe('Invoice');
    expect(doc.status).toBe('Paid');
    expect(doc.sections.some((s) => s.title === 'Payment Details')).toBe(true);
  });
  it('falls back to plain items when printLines is absent', () => {
    const doc = buildWhatsappOrderDoc({ ...order, printLines: null } as Order, 'quotation');
    expect(doc.table.rows.length).toBe(1);
    expect(doc.table.rows[0][0].text).toContain('Lagar dos Perdigões');
  });
});
