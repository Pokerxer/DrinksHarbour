import { deriveInvoiceData, DEFAULT_STORE, type InvoiceOrder, type InvoiceStore } from '../invoice';
import type { DocumentModel } from './doc-model';
export function buildA4Invoice(
  order: InvoiceOrder,
  store: InvoiceStore = DEFAULT_STORE
): DocumentModel {
  const d = deriveInvoiceData(order, store);
  const returned = new Map<number, number>();
  for (const refund of order.refunds ?? []) {
    for (const line of refund.items ?? []) {
      returned.set(line.orderItemIndex, (returned.get(line.orderItemIndex) ?? 0) + line.quantity);
    }
  }
  const delivery = [order.shipping?.address, order.shipping?.city, order.shipping?.state]
    .filter(Boolean)
    .join(', ');
  const money = (n: number) =>
    `NGN ${n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return {
    kind: 'invoice',
    companyName: d.storeName,
    head: { address: d.address.join(', ') },
    department: 'Sales',
    docTitle: 'Invoice',
    number: d.receiptRef,
    status: d.statusLabel.toLowerCase(),
    watermark: order.isVoided ? 'VOID' : undefined,
    parties: [
      {
        heading: 'Customer',
        name: d.customerName,
        lines: [d.customerPhone, delivery].filter(Boolean),
      },
    ],
    meta: [
      ['Date', d.dateStr],
      ['Payment', d.payLabel],
      ...(d.cashier ? [['Cashier', d.cashier] as [string, string]] : []),
      ...(d.hasOrderNum ? [['Order', d.orderNumber ?? ''] as [string, string]] : []),
    ],
    table: {
      columns: [
        { label: 'Product' },
        { label: 'Qty', align: 'right' },
        { label: 'Unit price', align: 'right' },
        { label: 'Amount', align: 'right' },
      ],
      rows: d.items.map((item, index) => [
        {
          text: item.product?.name || item.name || 'Product',
          sub: [
            item.variant || item.size?.displayName || item.size?.size,
            (item.refundedQty ?? returned.get(index))
              ? `${item.refundedQty ?? returned.get(index)} refunded`
              : '',
          ]
            .filter(Boolean)
            .join(' | '),
        },
        { text: String(item.quantity ?? 0) },
        { text: money(item.priceAtPurchase ?? 0) },
        { text: money(item.itemSubtotal ?? (item.quantity ?? 0) * (item.priceAtPurchase ?? 0)) },
      ]),
    },
    totals: [
      { label: 'Subtotal', value: money(d.subtotal), variant: 'normal' },
      ...(d.discount
        ? [{ label: 'Discount', value: money(-d.discount), variant: 'normal' as const }]
        : []),
      { label: 'Total', value: money(d.amount), variant: 'grand' },
      ...(d.totalRefunded
        ? [{ label: 'Refunded', value: money(d.totalRefunded), variant: 'normal' as const }]
        : []),
      ...(d.change
        ? [{ label: 'Change', value: money(d.change), variant: 'normal' as const }]
        : []),
    ],
    sections: [
      ...d.bankAccounts.map((bank) => ({
        title: bank.bankName,
        body: [bank.accountName, bank.accountNumber].filter(Boolean).join(' | '),
      })),
      ...(order.notes ? [{ title: 'Notes', body: order.notes }] : []),
    ],
    signatures: [],
    fileName: `Invoice-${d.receiptRef.replace(/[^a-zA-Z0-9_-]/g, '-')}.pdf`,
  };
}
