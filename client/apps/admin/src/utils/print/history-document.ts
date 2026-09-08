import type { InventoryMovement } from '@/services/inventory.service';
import type { PurchaseOrder } from '@/app/shared/purchases/types';
import type { InvoiceOrder } from '../invoice';
import type { DocumentModel } from './doc-model';
import { buildA4Invoice } from './a4-invoice';
import { buildPOInvoice } from './po-print';
import { fmtAmt, fmtDate } from './print-shared';
export interface HistoryRefund {
  receiptNumber?: string;
  refundedAt?: string;
  totalRefunded?: number;
  reason?: string;
  paymentMethod?: string;
  items?: {
    orderItemIndex: number;
    quantity: number;
    unitPrice?: number;
    amount?: number;
    reason?: string;
    discPct?: number;
  }[];
}
export function buildHistoryDocument(
  order: InvoiceOrder | PurchaseOrder,
  type: 'pos' | 'online' | 'purchase' | 'return' | 'po_return',
  tenantName: string,
  refund?: HistoryRefund,
  movement?: InventoryMovement
): DocumentModel {
  if (type === 'purchase') return buildPOInvoice(order as PurchaseOrder, tenantName);
  if (type === 'pos' || type === 'online')
    return buildA4Invoice(order as InvoiceOrder, { name: tenantName });
  if (type === 'return') {
    const invoice = buildA4Invoice(order as InvoiceOrder, { name: tenantName });
    const items = (order as InvoiceOrder).items ?? [];
    return {
      ...invoice,
      kind: 'return',
      docTitle: 'Credit note',
      department: 'Returns',
      number: refund?.receiptNumber ?? movement?.reference ?? invoice.number,
      status: 'refunded',
      watermark: undefined,
      meta: [
        ['Original invoice', invoice.number],
        ['Return date', fmtDate(refund?.refundedAt)],
        ['Payment method', refund?.paymentMethod ?? ''],
      ],
      table: {
        columns: [
          { label: 'Product' },
          { label: 'Quantity', align: 'right' },
          { label: 'Unit price', align: 'right' },
          { label: 'Credit', align: 'right' },
        ],
        rows: (refund?.items ?? []).map((row) => [
          {
            text:
              items[row.orderItemIndex]?.product?.name ||
              items[row.orderItemIndex]?.name ||
              `Item ${row.orderItemIndex + 1}`,
            sub: [row.reason, row.discPct ? `${row.discPct}% discount` : '']
              .filter(Boolean)
              .join(' | '),
          },
          { text: String(row.quantity) },
          { text: fmtAmt(row.unitPrice ?? 0, 'NGN') },
          { text: fmtAmt(-(row.amount ?? 0), 'NGN') },
        ]),
      },
      totals: [
        {
          label: 'Credit total',
          value: fmtAmt(-(refund?.totalRefunded ?? 0), 'NGN'),
          variant: 'grand',
        },
      ],
      sections: refund?.reason ? [{ title: 'Return reason', body: refund.reason }] : [],
      fileName: `Credit-note-${refund?.receiptNumber ?? invoice.number}.pdf`,
    };
  }
  const po = order as PurchaseOrder;
  const invoice = buildPOInvoice(po, tenantName);
  if (!movement) throw new Error('Return movement is required');
  const size = movement.size;
  const idOf = (value: unknown): string =>
    typeof value === 'string'
      ? value
      : value && typeof value === 'object' && '_id' in value
        ? String(value._id)
        : '';
  const candidates = po.items as Array<
    PurchaseOrder['items'][number] & { unitCost?: number; subProductName?: string }
  >;
  const matching =
    candidates.find((item) => {
      const sameProduct = idOf(item.subProductId) === idOf(movement.subProduct);
      const sameSize =
        Boolean(size?._id && idOf(item.sizeId) === size._id) ||
        Boolean(size?.displayName && item.sizeName === size.displayName);
      return sameProduct && (sameSize || !size);
    }) ?? (candidates.length === 1 ? candidates[0] : undefined);
  const unitCost = movement.unitCost ?? matching?.unitCost ?? matching?.unitPrice ?? 0;
  const product = typeof movement.subProduct === 'object' ? movement.subProduct : undefined;
  return {
    ...invoice,
    kind: 'return',
    docTitle: 'Supplier credit note',
    department: 'Returns',
    status: movement.status,
    watermark: undefined,
    number: movement.reference || po.poNumber,
    meta: [
      ['Original PO', po.poNumber],
      ['Return date', fmtDate(movement.createdAt)],
    ],
    table: {
      columns: [
        { label: 'Product' },
        { label: 'Qty', align: 'right' },
        { label: 'Unit cost', align: 'right' },
        { label: 'Credit', align: 'right' },
      ],
      rows: [
        [
          {
            text:
              matching?.subProductName ||
              matching?.productName ||
              product?.name ||
              'Returned product',
            sub: size?.displayName || matching?.sizeName,
          },
          { text: String(movement.quantity) },
          { text: fmtAmt(unitCost, po.currency) },
          { text: fmtAmt(-movement.quantity * unitCost, po.currency) },
        ],
      ],
    },
    totals: [
      {
        label: 'Credit total',
        value: fmtAmt(-movement.quantity * unitCost, po.currency),
        variant: 'grand',
      },
    ],
    sections: [{ title: 'Return reason', body: movement.reason || movement.notes || '' }],
    miniTables: [],
    kvGroups: [],
    words: undefined,
    fileName: `Supplier-credit-${po.poNumber}.pdf`,
  };
}
