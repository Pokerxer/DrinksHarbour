import type { StockTransfer } from '@/services/stockTransfer.service';
import {
  fmtAmt,
  fmtDate,
  moneyWords,
  warehouseContactLine,
  warehouseHeadOf,
  warehouseLocalityLine,
  warehouseStreetLine,
} from './print-shared';
import type { DocumentModel, DocCell, DocPartyBox } from './doc-model';

// Same box shape as the PO's Buyer box: a populated warehouse ref prints its
// address/contact lines; bare ids collapse to their string form.
function partyBox(
  ref: StockTransfer['sourceWarehouse'],
  heading: string
): DocPartyBox {
  const wh = typeof ref === 'object' ? ref : null;
  if (!wh) return { heading, name: String(ref ?? '—') };
  return {
    heading,
    name: wh.code ? `${wh.name} (${wh.code})` : wh.name,
    lines: [
      warehouseStreetLine(wh),
      warehouseLocalityLine(wh),
      warehouseContactLine(wh),
    ].filter(Boolean),
  };
}

const nameOf = (u?: { name?: string } | null) => u?.name ?? undefined;

export function buildTransferInvoice(
  transfer: StockTransfer,
  companyName: string
): DocumentModel {
  const currency = transfer.currency || 'NGN';
  // The destination is the buying entity on paper: it owns the head block and
  // the Buyer box; the source warehouse ships as the Supplier.
  const dst =
    typeof transfer.destinationWarehouse === 'object'
      ? transfer.destinationWarehouse
      : null;
  // Row money = net + tax only; delivery charge shares live in the totals block.
  const lineTotalOf = (it: StockTransfer['items'][number]) => {
    const net =
      (it.costPrice ?? 0) * it.quantity * (1 - (it.discountRate ?? 0) / 100);
    const tax = net * ((it.taxRate ?? 0) / 100);
    return net + tax;
  };

  const rows: DocCell[][] = transfer.items.map((item) => {
    const name =
      item.sizeName && !item.subProductName.includes(item.sizeName)
        ? `${item.subProductName} – ${item.sizeName}`
        : item.subProductName;
    const recv = item.receivedQty ?? item.transferredQty ?? 0;
    const done = recv >= item.quantity;
    const pending = Math.max(0, item.quantity - recv);
    return [
      { text: name },
      { text: String(item.quantity) },
      done
        ? { text: String(recv), color: '#16a34a', strong: true }
        : {
            text: String(recv),
            sub: pending > 0 ? `${pending} pending` : undefined,
            color: '#6b7280',
          },
      { text: fmtAmt(item.costPrice ?? 0, currency) },
      { text: item.discountRate ? `${item.discountRate}%` : '—' },
      { text: item.taxRate ? `${item.taxRate}%` : '—' },
      { text: fmtAmt(lineTotalOf(item), currency), strong: true },
    ];
  });

  const shortfall = transfer.items.some((it) => (it.shortfallQty ?? 0) > 0);
  const lastReal = [...(transfer.receipts ?? [])]
    .reverse()
    .find((r) => !r.shortagesClosed);

  return {
    kind: 'transfer',
    companyName: dst?.name || companyName,
    head: warehouseHeadOf(dst),
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
      partyBox(transfer.destinationWarehouse, 'Buyer'),
      partyBox(transfer.sourceWarehouse, 'Supplier'),
    ],
    meta: [
      ['Created', fmtDate(transfer.createdAt)],
      ['Scheduled', fmtDate(transfer.scheduledDate)],
      ['Dispatched', fmtDate(transfer.dispatchedAt)],
      ['Received', fmtDate(lastReal?.receivedAt)],
      ['Completed', fmtDate(transfer.completedDate)],
      ['Reference', transfer.transferNumber],
    ],
    table: {
      columns: [
        { label: 'Product' },
        { label: 'Sent', align: 'center' },
        { label: 'Received', align: 'right' },
        { label: 'Unit Cost', align: 'right' },
        { label: 'Discount', align: 'right' },
        { label: 'Tax', align: 'right' },
        { label: 'Line Total', align: 'right' },
      ],
      rows,
    },
    totals: [
      { label: 'Subtotal', value: fmtAmt(transfer.subtotal ?? 0, currency) },
      ...(transfer.discountAmount
        ? [
            {
              label: 'Discount',
              value: `− ${fmtAmt(transfer.discountAmount, currency)}`,
            },
          ]
        : []),
      ...(transfer.taxAmount
        ? [{ label: 'Tax', value: fmtAmt(transfer.taxAmount, currency) }]
        : []),
      ...(transfer.closedWithShortage || shortfall
        ? [
            {
              label: 'Shortfall (not received)',
              color: '#b45309',
              value: fmtAmt(
                transfer.items.reduce(
                  (s, it) => s + (it.shortfallQty ?? 0) * (it.costPrice ?? 0),
                  0
                ),
                currency
              ),
            },
          ]
        : []),
      ...(transfer.deliveryCharge
        ? [
            {
              label: 'Delivery / Charges',
              value: fmtAmt(transfer.deliveryCharge, currency),
            },
          ]
        : []),
      {
        label: 'Total',
        value: fmtAmt(transfer.total ?? 0, currency),
        variant: 'grand',
      },
    ],
    words: moneyWords(transfer.total ?? 0, currency),
    sections: transfer.notes ? [{ title: 'Notes', body: transfer.notes }] : [],
    signatures: [
      { role: 'Dispatched by', name: nameOf(transfer.dispatchedBy ?? transfer.createdBy) },
      { role: 'Received by', name: nameOf(lastReal?.receivedBy ?? transfer.confirmedBy) },
    ],
    fileName: `Stock Transfer ${transfer.transferNumber}.pdf`,
  };
}
