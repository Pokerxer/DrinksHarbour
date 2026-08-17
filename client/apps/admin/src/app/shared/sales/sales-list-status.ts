// What state the orders list says a document is in.
//
// One module so the table, the spreadsheet view and the CSV export cannot
// disagree about the same order. Previously each derived status on its own and
// all three collapsed every order to the constant "Sales Order" — a cancelled
// order and a live one rendered identically.
//
// Pure and formatting-free: money comes back as numbers so the caller applies
// its own currency formatter. Vitest runs `environment: 'node'` here — there is
// no jsdom, so nothing renderable may live in this file.

import type {
  SalesOrder,
  OrderStatus,
  QuoteStatus,
} from '@/services/salesOrder.service';

export type BadgeTone =
  | 'gray'
  | 'blue'
  | 'amber'
  | 'emerald'
  | 'violet'
  | 'red';

export interface StatusBadge {
  label: string;
  tone: BadgeTone;
}

// Every value the schema's orderStatus enum can hold gets its own label. A
// missing orderStatus means the order was never confirmed — that is 'draft',
// not "unknown", and it must not share a pill with 'cancelled'.
const ORDER_STATUS: Record<OrderStatus, StatusBadge> = {
  draft: { label: 'Draft', tone: 'gray' },
  confirmed: { label: 'Confirmed', tone: 'blue' },
  partially_fulfilled: { label: 'Partially Fulfilled', tone: 'amber' },
  fulfilled: { label: 'Fulfilled', tone: 'emerald' },
  cancelled: { label: 'Cancelled', tone: 'red' },
};

const QUOTE_STATUS: Record<QuoteStatus, StatusBadge> = {
  draft: { label: 'Draft', tone: 'gray' },
  sent: { label: 'Sent', tone: 'blue' },
  accepted: { label: 'Accepted', tone: 'emerald' },
  rejected: { label: 'Rejected', tone: 'red' },
  expired: { label: 'Expired', tone: 'amber' },
  converted: { label: 'Converted', tone: 'violet' },
};

export function docStatusBadge(so: SalesOrder): StatusBadge {
  if (so.docType === 'order') {
    return ORDER_STATUS[so.orderStatus as OrderStatus] ?? ORDER_STATUS.draft;
  }
  return QUOTE_STATUS[so.quoteStatus as QuoteStatus] ?? QUOTE_STATUS.draft;
}

export interface PaymentBadge extends StatusBadge {
  /** What has actually been collected. For 'partial' this is what the till took. */
  paid: number;
  /** What is still owed. Never negative, even if the order was overpaid. */
  outstanding: number;
}

// paymentStatus stopped being binary when the POS gained the ability to fulfil
// part of a sales order: 'partial' means amountPaid holds what the till took,
// NOT the order total. Anything that treats the enum as unpaid/paid reports a
// receivable that has already been partly settled — or erases one that has not.
export function paymentBadge(so: SalesOrder): PaymentBadge {
  const total = so.total ?? 0;
  const paid = Math.max(0, so.amountPaid ?? 0);
  const outstanding = Math.max(0, total - paid);

  switch (so.paymentStatus) {
    case 'paid':
      return { label: 'Paid', tone: 'emerald', paid, outstanding };
    case 'partial':
      return { label: 'Partial', tone: 'amber', paid, outstanding };
    default:
      // 'unpaid', or an order written before the field existed. Either way
      // nothing has been collected — never infer payment from silence.
      return { label: 'Unpaid', tone: 'gray', paid: 0, outstanding: total };
  }
}

export function invoiceStatusText(so: SalesOrder): string {
  return so.relatedInvoice ? 'Invoiced' : 'Not Invoiced';
}

// Tailwind cannot see a class name built at runtime, so each tone is a literal.
export const TONE_CLASS: Record<BadgeTone, string> = {
  gray: 'bg-gray-100 text-gray-600',
  blue: 'bg-blue-100 text-blue-700',
  amber: 'bg-amber-100 text-amber-700',
  emerald: 'bg-emerald-100 text-emerald-700',
  violet: 'bg-violet-100 text-violet-700',
  red: 'bg-red-100 text-red-700',
};
