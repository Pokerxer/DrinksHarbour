import type { InvoiceOrder, InvoiceStore } from '../invoice';
import { buildA4Invoice } from './a4-invoice';
import type { DocumentModel } from './doc-model';
import type { POSOrderResponse } from '@/app/shared/point-of-sale/types';
export const posStore = (
  tenant?: { name: string; bankAccounts?: InvoiceStore['bankAccounts'] } | null
): InvoiceStore => ({
  name: tenant?.name || 'DRINKS HARBOUR',
  address: [],
  bankAccounts: tenant?.bankAccounts,
});
const money = (value: number) =>
  `NGN ${value.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export interface RefundDocument {
  receiptNumber?: string;
  refundedAt?: string;
  totalRefunded: number;
  paymentMethod?: string;
  reason?: string;
  items?: { orderItemIndex?: number; quantity: number; unitPrice?: number; amount?: number }[];
}
export function buildPOSRefund(
  order: InvoiceOrder,
  refund: RefundDocument,
  tenant?: { name: string } | null
): DocumentModel {
  const base = buildA4Invoice(order, posStore(tenant));
  return {
    ...base,
    docTitle: 'Return receipt',
    number: refund.receiptNumber || 'Return',
    status: 'refunded',
    watermark: undefined,
    meta: [
      ['Original invoice', base.number],
      ['Date', refund.refundedAt || ''],
      ['Refund via', refund.paymentMethod || ''],
    ],
    table: {
      columns: base.table.columns,
      rows: (refund.items ?? []).map((line) => {
        const item = order.items?.[line.orderItemIndex ?? -1];
        return [
          {
            text: item?.name || item?.product?.name || `Item ${(line.orderItemIndex ?? 0) + 1}`,
            sub: item?.variant,
          },
          { text: String(line.quantity) },
          { text: money(line.unitPrice ?? 0) },
          { text: money(line.amount ?? 0) },
        ];
      }),
    },
    totals: [{ label: 'Total refunded', value: money(refund.totalRefunded), variant: 'grand' }],
    sections: refund.reason ? [{ title: 'Reason', body: refund.reason }] : [],
    fileName: `return-${refund.receiptNumber || 'receipt'}.pdf`,
  };
}
export function buildPOSCheckout(
  order: POSOrderResponse,
  tenant?: { name: string } | null,
  customer?: InvoiceOrder['customer'],
  staff?: InvoiceOrder['posStaff']
) {
  const model = buildA4Invoice(
    {
      ...order,
      posStaff: staff,
      customer,
      items: order.items,
      notes: order.note,
      paymentDetails: { splitPayments: order.splitPayments, change: order.change },
    },
    posStore(tenant)
  );
  if (order.tipAmount)
    model.totals.splice(-1, 0, {
      label: 'Tip (included)',
      value: money(order.tipAmount),
      variant: 'normal',
    });
  if (order.roundingAmount)
    model.totals.splice(-1, 0, {
      label: 'Rounding (included)',
      value: money(order.roundingAmount),
      variant: 'normal',
    });
  if (order.tableName) model.meta.push(['Table', order.tableName]);
  return model;
}
