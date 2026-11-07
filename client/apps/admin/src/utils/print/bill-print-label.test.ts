// DRI-14 — bill-print row label parity check (buildBillInvoice).
import { describe, it, expect } from 'vitest';
import { buildBillInvoice } from './bill-print';
import type { VendorBill } from '@/services/vendorBill.service';

const baseBill = {
  _id: 'b1', billNumber: 'BIL-2026-00001', vendorName: 'Legacy Wholesale',
  subtotal: 100, taxAmount: 0, totalAmount: 100, paidAmount: 0,
  currency: 'NGN', billDate: '2026-11-06', dueDate: '2026-11-20',
  status: 'confirmed', terms: '', notes: '', payments: [],
  items: [],
} as unknown as VendorBill;

function rowText(bill: VendorBill, index = 0): string {
  // The print row's first cell is the composed label.
  return (buildBillInvoice(bill, 'Harbour Co.').table.rows[index][0] as { text: string }).text;
}

describe('buildBillInvoice row labels', () => {
  it('renders legacy rows byte-identical to the stored sizeName snapshot', () => {
    const bill = {
      ...baseBill,
      items: [
        { subProductId: 'sp1', subProductName: 'Legacy Lager', sizeId: 'sz1', sizeName: 'Legacy Lager 750ml', quantity: 6, unitPrice: 100, taxRate: 0, amount: 600 },
      ],
    } as unknown as VendorBill;
    // Even when the GET payload includes a populated, colour-free Size object.
    const billWithPopulated = {
      ...bill,
      items: [
        { ...bill.items[0], sizeId: { _id: 'sz1', size: '750ml', displayName: 'Legacy Lager 750ml' } },
      ],
    } as unknown as VendorBill;
    expect(rowText(bill)).toBe('Legacy Lager – Legacy Lager 750ml');
    expect(rowText(billWithPopulated)).toBe('Legacy Lager – Legacy Lager 750ml');
  });

  it('composes colour/option identity for retail rows via the shared formatter', () => {
    const bill = {
      ...baseBill,
      items: [
        {
          subProductId: 'sp9', subProductName: 'Skyline Ankara Gown',
          // GET /vendor-bills/:id now carries the populated Size identity.
          sizeId: { _id: 'sz9', displayName: 'One-size gown — Emerald', colorName: 'Emerald', optionName: 'Emerald gown' },
          sizeName: 'One-size gown — Emerald · Emerald · Emerald gown',
          quantity: 4, unitPrice: 100, taxRate: 0, amount: 400,
        },
      ],
    } as unknown as VendorBill;
    expect(rowText(bill)).toBe('Skyline Ankara Gown – One-size gown — Emerald · Emerald · Emerald gown');
  });

  it('renders raw-enriched retail rows with the missing colour identity restored', () => {
    const bill = {
      ...baseBill,
      items: [
        {
          subProductId: 'sp9', subProductName: 'Nova Bluetooth Speaker',
          sizeId: { _id: 'sz9', displayName: 'Portable speaker', optionName: 'Sand speaker' },
          sizeName: 'Portable speaker', // server-enriched raw snapshot
          quantity: 4, unitPrice: 20, taxRate: 0, amount: 80,
        },
      ],
    } as unknown as VendorBill;
    expect(rowText(bill)).toBe('Nova Bluetooth Speaker – Portable speaker · Sand speaker');
  });
});
