import type { StockTransfer } from '@/services/stockTransfer.service';
import { fmtAmt, fmtDate } from './print-shared';
import type { DocumentModel, DocCell } from './doc-model';

function whName(w: string | { _id: string; name: string; code: string }): string {
  if (typeof w === 'string') return w;
  return w.code ? `${w.name} (${w.code})` : (w.name ?? '');
}

export function buildTransferInvoice(
  transfer: StockTransfer,
  companyName: string
): DocumentModel {
  const currency = transfer.currency || 'NGN';
  const totalQty = transfer.items.reduce((s, it) => s + it.quantity, 0);
  const transferredQty = transfer.items.reduce(
    (s, it) => s + (it.transferredQty ?? 0),
    0
  );
  const totalValue =
    transfer.totalValue ??
    transfer.items.reduce(
      (s, it) => s + (it.costPrice ?? 0) * it.quantity,
      0
    );

  const rows: DocCell[][] = transfer.items.map((item) => {
    const name =
      item.sizeName && !item.subProductName.includes(item.sizeName)
        ? `${item.subProductName} – ${item.sizeName}`
        : item.subProductName;
    const done = (item.transferredQty ?? 0) >= item.quantity;
    const pending = Math.max(0, item.quantity - (item.transferredQty ?? 0));
    return [
      { text: name },
      { text: String(item.quantity) },
      done
        ? { text: String(item.transferredQty ?? 0), color: '#16a34a', strong: true }
        : {
            text: String(item.transferredQty ?? 0),
            sub: pending > 0 ? `${pending} pending` : undefined,
            color: '#6b7280',
          },
      { text: fmtAmt(item.costPrice ?? 0, currency) },
    ];
  });

  const nameOf = (u?: { name?: string } | null) => u?.name ?? undefined;

  return {
    kind: 'transfer',
    companyName,
    department: 'Stock Transfer',
    docTitle: 'Stock Transfer',
    number: transfer.transferNumber,
    status: transfer.status,
    watermark:
      transfer.status === 'completed'
        ? 'COMPLETED'
        : transfer.status === 'cancelled'
          ? 'CANCELLED'
          : undefined,
    parties: [
      { heading: 'From Warehouse', name: whName(transfer.sourceWarehouse) },
      { heading: 'To Warehouse', name: whName(transfer.destinationWarehouse) },
    ],
    meta: [
      ['Created', fmtDate(transfer.createdAt)],
      ['Scheduled', fmtDate(transfer.scheduledDate)],
      ['Completed', fmtDate(transfer.completedDate)],
      ['Reference', transfer.transferNumber],
    ],
    table: {
      columns: [
        { label: 'Product' },
        { label: 'Qty', align: 'center' },
        { label: 'Transferred', align: 'right' },
        { label: 'Unit Cost', align: 'right' },
      ],
      rows,
    },
    totals: [
      { label: 'Total Quantity', value: String(totalQty) },
      {
        label: 'Transferred',
        value: String(transferredQty),
        color: transferredQty >= totalQty ? '#16a34a' : '#b45309',
      },
      {
        label: 'Stock Value at Cost',
        value: fmtAmt(totalValue, currency),
        variant: 'grand',
      },
    ],
    sections: transfer.notes ? [{ title: 'Notes', body: transfer.notes }] : [],
    signatures: [
      { role: 'Dispatched by', name: nameOf(transfer.createdBy) },
      { role: 'Approved by', name: nameOf((transfer as any).approvedBy) },
      { role: 'Received by', name: nameOf(transfer.confirmedBy) },
    ],
    fileName: `Stock Transfer ${transfer.transferNumber}.pdf`,
  };
}
