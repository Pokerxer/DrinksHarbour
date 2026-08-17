// What state the orders list claims an order is in.
//
// `DocTypeBadge` returned a green "Sales Order" pill for every row whose
// docType was 'order' and never read `orderStatus`. On /sales/orders every row
// is an order, so draft, confirmed, partially_fulfilled, fulfilled and
// CANCELLED all rendered identically — a cancelled order was indistinguishable
// from a live one. Payment state was not rendered at all, so after
// paymentStatus gained 'partial' the money a POS sale had already taken was
// invisible on the list.
//
// Both failures are the same shape: a plausible cell, never an error. So these
// tests assert on the badge descriptor that reaches the cell, per state.

import { describe, expect, test } from 'vitest';
import {
  docStatusBadge,
  paymentBadge,
  invoiceStatusText,
} from './sales-list-status';
import type { SalesOrder } from '@/services/salesOrder.service';

function order(over: Partial<SalesOrder> = {}): SalesOrder {
  return {
    _id: 'so1',
    soNumber: 'SO2026081600001',
    docType: 'order',
    currency: 'NGN',
    items: [],
    subtotal: 0,
    discountTotal: 0,
    total: 40000,
    fulfillments: [],
    ...over,
  } as SalesOrder;
}

function quotation(over: Partial<SalesOrder> = {}): SalesOrder {
  return order({ docType: 'quotation', ...over });
}

describe('docStatusBadge — an order', () => {
  test('a cancelled order does not read as a live one', () => {
    const badge = docStatusBadge(order({ orderStatus: 'cancelled' }));

    expect(badge.label).toBe('Cancelled');
    expect(badge.tone).toBe('red');
  });

  test('a partially fulfilled order says so', () => {
    expect(
      docStatusBadge(order({ orderStatus: 'partially_fulfilled' })).label
    ).toBe('Partially Fulfilled');
  });

  test('each order state gets its own label', () => {
    const labels = (
      [
        'draft',
        'confirmed',
        'partially_fulfilled',
        'fulfilled',
        'cancelled',
      ] as const
    ).map((orderStatus) => docStatusBadge(order({ orderStatus })).label);

    expect(new Set(labels).size).toBe(labels.length);
    expect(labels).toEqual([
      'Draft',
      'Confirmed',
      'Partially Fulfilled',
      'Fulfilled',
      'Cancelled',
    ]);
  });

  test('an order with no orderStatus yet reads as Draft, not as a generic pill', () => {
    expect(docStatusBadge(order({ orderStatus: undefined })).label).toBe(
      'Draft'
    );
  });
});

describe('docStatusBadge — a quotation', () => {
  test('each quote state gets its own label', () => {
    const labels = (
      ['draft', 'sent', 'accepted', 'rejected', 'expired', 'converted'] as const
    ).map((quoteStatus) => docStatusBadge(quotation({ quoteStatus })).label);

    expect(new Set(labels).size).toBe(labels.length);
  });

  test('an expired quotation is not shown as a plain draft', () => {
    expect(docStatusBadge(quotation({ quoteStatus: 'expired' })).label).toBe(
      'Expired'
    );
  });
});

describe('paymentBadge', () => {
  test('a partial payment reports what the till actually took, not the order total', () => {
    const badge = paymentBadge(
      order({ total: 40000, paymentStatus: 'partial', amountPaid: 12000 })
    );

    expect(badge.label).toBe('Partial');
    expect(badge.paid).toBe(12000);
    expect(badge.outstanding).toBe(28000);
    expect(badge.tone).toBe('amber');
  });

  test('a partial order is never rendered as unpaid', () => {
    const badge = paymentBadge(
      order({ paymentStatus: 'partial', amountPaid: 12000 })
    );

    expect(badge.label).not.toBe('Unpaid');
  });

  test('a paid order owes nothing', () => {
    const badge = paymentBadge(
      order({ total: 40000, paymentStatus: 'paid', amountPaid: 40000 })
    );

    expect(badge.label).toBe('Paid');
    expect(badge.outstanding).toBe(0);
    expect(badge.tone).toBe('emerald');
  });

  test('an unpaid order owes the whole total', () => {
    const badge = paymentBadge(
      order({ total: 40000, paymentStatus: 'unpaid' })
    );

    expect(badge.label).toBe('Unpaid');
    expect(badge.paid).toBe(0);
    expect(badge.outstanding).toBe(40000);
  });

  test('an order that predates the paymentStatus field is treated as unpaid, not as paid', () => {
    expect(paymentBadge(order({ paymentStatus: undefined })).label).toBe(
      'Unpaid'
    );
  });

  test('a partial with no amountPaid recorded reports zero taken, never the total', () => {
    const badge = paymentBadge(
      order({ total: 40000, paymentStatus: 'partial', amountPaid: undefined })
    );

    expect(badge.paid).toBe(0);
    expect(badge.outstanding).toBe(40000);
  });

  test('an overpayment never reports a negative amount outstanding', () => {
    const badge = paymentBadge(
      order({ total: 40000, paymentStatus: 'paid', amountPaid: 45000 })
    );

    expect(badge.outstanding).toBe(0);
  });
});

describe('invoiceStatusText', () => {
  test('an order with a linked invoice reads as invoiced', () => {
    expect(
      invoiceStatusText(
        order({ relatedInvoice: 'inv1' } as Partial<SalesOrder>)
      )
    ).toBe('Invoiced');
  });

  test('an order with no linked invoice reads as not invoiced', () => {
    expect(invoiceStatusText(order())).toBe('Not Invoiced');
  });
});
