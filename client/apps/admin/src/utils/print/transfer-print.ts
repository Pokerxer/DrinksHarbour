import { transferReturnSummary } from '@/app/shared/purchases/invoice-return-summary';
import type { StockTransfer } from '@/services/stockTransfer.service';
import { linePackSize, packsLabel } from '@/app/shared/purchases/types';
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
function partyBox(ref: StockTransfer['sourceWarehouse'], heading: string): DocPartyBox {
  const wh = typeof ref === 'object' ? ref : null;
  if (!wh) return { heading, name: String(ref ?? '—') };
  return {
    heading,
    name: wh.code ? `${wh.name} (${wh.code})` : wh.name,
    lines: [warehouseStreetLine(wh), warehouseLocalityLine(wh), warehouseContactLine(wh)].filter(
      Boolean,
    ),
  };
}

const nameOf = (u?: { name?: string } | null) => u?.name ?? undefined;

export function buildTransferInvoice(transfer: StockTransfer, companyName: string): DocumentModel {
  const summary = transferReturnSummary(transfer);
  const currency = transfer.currency || 'NGN';
  // The source warehouse supplies the transfer and owns the document header;
  // the destination remains the buying entity in the parties section.
  const src = typeof transfer.sourceWarehouse === 'object' ? transfer.sourceWarehouse : null;
  const dst =
    typeof transfer.destinationWarehouse === 'object' ? transfer.destinationWarehouse : null;
  // Row money = net + tax only; delivery charge shares live in the totals block.
  const lineTotalOf = (it: StockTransfer['items'][number]) => {
    const net =
      (it.costPrice ?? 0) *
      Math.max(0, it.quantity - (it.returnedQty ?? 0)) *
      (1 - (it.discountRate ?? 0) / 100);
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
      {
        text: name,
        ...(item.returnedQty
          ? {
              sub: `${item.returnedQty} returned · ${Math.max(0, recv - item.returnedQty)} retained`,
            }
          : {}),
      },
      { text: packsLabel(item.quantity, linePackSize(item)) },
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
  const lastReal = [...(transfer.receipts ?? [])].reverse().find((r) => !r.shortagesClosed);

  return {
    kind: 'transfer',
    ...(summary.returned > 0
      ? {
          notice: {
            tone: 'info' as const,
            title: summary.fullyReturned ? 'Fully returned' : 'Adjusted after returns',
            body: `${summary.returned} units returned. ${summary.remaining} units remain on this invoice.`,
          },
        }
      : {}),
    companyName: src?.name || companyName,
    head: warehouseHeadOf(src),
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
        { label: 'Packs', align: 'center' },
        { label: 'Sent', align: 'center' },
        { label: 'Received', align: 'right' },
        { label: 'Unit Cost', align: 'right' },
        { label: 'Discount', align: 'right' },
        { label: 'Tax', align: 'right' },
        { label: 'Line Total', align: 'right' },
      ],
      rows,
    },
    miniTables: transfer.returns?.length
      ? [
          {
            title: `Returns (${transfer.returns.length})`,
            columns: [
              ['Date', 'left'],
              ['Returned by', 'left'],
              ['Products', 'left'],
              ['Value', 'right'],
            ],
            rows: transfer.returns.map((entry) => [
              { text: fmtDate(entry.returnedAt) },
              { text: typeof entry.returnedBy === 'object' ? entry.returnedBy?.name || '—' : '—' },
              {
                text: entry.lines
                  .map(
                    (line) =>
                      `${transfer.items[line.itemIndex]?.subProductName || 'Product'}: ${line.quantity}${line.note ? ` (${line.note})` : ''}`,
                  )
                  .join('; '),
              },
              { text: entry.refundedValue != null ? fmtAmt(entry.refundedValue, currency) : '—' },
            ]),
          },
        ]
      : undefined,
    totals: [
      ...(summary.returned > 0
        ? [
            { label: 'Original invoice', value: fmtAmt(summary.originalTotal, currency) },
            { label: 'Return credit', value: `− ${fmtAmt(summary.credit, currency)}` },
          ]
        : []),
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
                  0,
                ),
                currency,
              ),
            },
          ]
        : []),
      ...(transfer.deliveryCharge
        ? [
            {
              label: 'Delivery / Charges',
              value: fmtAmt(
                (() => {
                  const originalNet = transfer.items.reduce(
                    (sum, it) =>
                      sum + (it.costPrice ?? 0) * it.quantity * (1 - (it.discountRate ?? 0) / 100),
                    0,
                  );
                  const remainingNet = (transfer.subtotal ?? 0) - (transfer.discountAmount ?? 0);
                  return originalNet > 0
                    ? (transfer.deliveryCharge! * remainingNet) / originalNet
                    : 0;
                })(),
                currency,
              ),
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
