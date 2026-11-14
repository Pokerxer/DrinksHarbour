// WhatsApp order documents (quotation / invoice) mapped onto the shared
// DocumentModel pipeline. The order was taken over WhatsApp by platform staff
// (manual intake) and may carry `printLines` — the presentation layout the
// builder saved (sections / notes / per-line descriptions, with productIndex
// pointing into `items`). Sections and notes are presentation-only: they never
// affect the money, only how the document reads.
import type { Order, OrderItem } from '@/services/order.service';
import { orderService } from '@/services/order.service';
import type { DocumentModel, DocCell } from './doc-model';
import { fmtAmt, fmtDate, moneyWords } from './print-shared';
import { requestDocumentExport } from './document-export';

export type WhatsappDocVariant = 'quotation' | 'invoice';

/** One saved presentation line — mirrors Order.printLines on the server. */
export interface OrderPrintLine {
  lineType: 'product' | 'section' | 'note';
  name: string;
  description: string;
  productIndex: number | null;
}

/** Order plus the optional presentation layout (manual WhatsApp orders). */
export type PrintableOrder = Order & { printLines?: OrderPrintLine[] | null };

/** Line total: prefer the server-snapshotted subtotal, fall back to unit × qty. */
function lineTotal(item: OrderItem): number {
  return item.itemSubtotal ?? item.priceAtPurchase * item.quantity;
}

/**
 * Running subtotal per section line, keyed by its position in printLines —
 * the same walk the builder table does: product lines after a section count
 * into it until the next section starts.
 */
function sectionSubtotals(
  order: PrintableOrder
): Map<number, number> {
  const map = new Map<number, number>();
  if (!order.printLines) return map;
  let running: { at: number; total: number } | null = null;
  for (let i = 0; i < order.printLines.length; i++) {
    const pl = order.printLines[i];
    if (pl.lineType === 'section') {
      if (running) map.set(running.at, running.total);
      running = { at: i, total: 0 };
    } else if (pl.lineType === 'product' && running) {
      const item = order.items?.[pl.productIndex ?? -1];
      if (item) running.total += lineTotal(item);
    }
  }
  if (running) map.set(running.at, running.total);
  return map;
}

/** One product row: name (+ per-line note), size, qty, unit price, seller, total. */
function productRow(
  item: OrderItem,
  description: string | undefined,
  currency: string
): DocCell[] {
  const sub = description?.trim() || undefined;
  return [
    { text: item.productName || item.product?.name || '—', sub },
    { text: item.size?.displayName || '—' },
    { text: String(item.quantity) },
    { text: fmtAmt(item.priceAtPurchase, currency) },
    { text: item.tenant?.name || '—' },
    { text: fmtAmt(lineTotal(item), currency), strong: true },
  ];
}

/**
 * Build the printable document. With printLines the table renders sections
 * (with running subtotals), interleaved notes and per-line descriptions;
 * without it the items list prints plainly.
 */
export function buildWhatsappOrderDoc(
  order: PrintableOrder,
  variant: WhatsappDocVariant
): DocumentModel {
  const isInvoice = variant === 'invoice';
  const customer = order.shippingAddress ?? {};
  const paid = order.paymentStatus === 'paid';
  const currency = order.currency ?? 'NGN';
  const items = order.items ?? [];

  // ── Rows ─────────────────────────────────────────────────────────────────
  const rows: DocumentModel['table']['rows'] = [];
  if (order.printLines?.length) {
    const subtotals = sectionSubtotals(order);
    order.printLines.forEach((pl, i) => {
      if (pl.lineType === 'section') {
        const sub = subtotals.get(i);
        rows.push([
          { text: pl.name || 'Section', strong: true },
          ...Array.from({ length: 4 }, () => ({ text: '' })),
          { text: sub ? fmtAmt(sub, currency) : '' },
        ]);
      } else if (pl.lineType === 'note') {
        rows.push([
          { text: pl.description || pl.name || '', sub: 'Note' },
          ...Array.from({ length: 5 }, () => ({ text: '' })),
        ]);
      } else {
        const item = items[pl.productIndex ?? -1];
        if (item) rows.push(productRow(item, pl.description, currency));
      }
    });
  } else {
    for (const item of items) rows.push(productRow(item, undefined, currency));
  }

  // ── Totals ───────────────────────────────────────────────────────────────
  const totals: DocumentModel['totals'] = [
    { label: `Items Total (${items.length})`, value: fmtAmt(order.subtotal, currency) },
    ...(order.discountTotal > 0
      ? [{ label: 'Discount', value: `−${fmtAmt(order.discountTotal, currency)}`, color: '#dc2626' }]
      : []),
    ...(order.shippingFee > 0
      ? [{ label: 'Delivery', value: fmtAmt(order.shippingFee, currency) }]
      : []),
    { label: 'Total', value: fmtAmt(order.totalAmount, currency), variant: 'grand' },
  ];

  // ── Sections ─────────────────────────────────────────────────────────────
  const sections: DocumentModel['sections'] = [];
  if (isInvoice) {
    sections.push({
      title: 'Payment Details',
      body: paid
        ? `Payment received — thank you.\nReference: ${order.paymentDetails?.reference ?? order.invoice?.paymentReference ?? '—'}\nMethod: ${order.paymentDetails?.channel || order.paymentMethod}`
        : 'Pay securely online via the invoice link sent to you (Kora Pay — card or bank transfer), or reply to this message to arrange payment.',
    });
  }
  sections.push({
    title: 'Order Source',
    body: 'Order taken via WhatsApp by the DrinksHarbour team.',
  });

  const parties: DocumentModel['parties'] = [
    {
      heading: 'From',
      name: 'DrinksHarbour',
      lines: ['drinksharbour.com', 'support@drinksharbour.com'],
    },
    {
      heading: isInvoice ? 'Bill To (Customer)' : 'Prepared For',
      name: customer.fullName || 'Customer',
      lines: [
        customer.addressLine1 ?? '',
        [customer.city, customer.state, customer.country].filter(Boolean).join(', '),
        customer.phone ?? '',
        customer.email ?? '',
      ].filter(Boolean),
    },
  ];

  return {
    kind: isInvoice ? 'invoice' : 'quotation',
    companyName: 'DrinksHarbour',
    department: 'Marketplace Orders',
    docTitle: isInvoice ? 'Invoice' : 'Quotation',
    number: order.orderNumber,
    status: isInvoice ? (paid ? 'Paid' : 'Unpaid') : 'Order Placed',
    parties,
    meta: [
      ['Order Date', fmtDate(order.createdAt)],
      ['Currency', currency],
      ['Source', 'WhatsApp'],
    ],
    table: {
      columns: [
        { label: 'Product' },
        { label: 'Size' },
        { label: 'Qty', align: 'center' },
        { label: 'Unit Price', align: 'right' },
        { label: 'Sold By', align: 'left' },
        { label: 'Total', align: 'right' },
      ],
      rows,
    },
    totals,
    words: moneyWords(order.totalAmount, currency),
    sections,
    signatures: [
      { role: 'Authorised by (DrinksHarbour)' },
      { role: 'Accepted by (Customer)' },
    ],
    fileName: `${isInvoice ? 'Invoice' : 'Quotation'} ${order.orderNumber}.pdf`,
  };
}

/** Fetch the order and hand the document to the globally hosted export dialog. */
export async function printOrderDocuments(
  orderId: string,
  token: string,
  variant: WhatsappDocVariant
): Promise<void> {
  const order = await orderService.getOrder(token, orderId);
  requestDocumentExport(buildWhatsappOrderDoc(order, variant));
}
