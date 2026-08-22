import type { StockTransfer } from '@/services/stockTransfer.service';
import {
  BASE_STYLE,
  docHeader,
  docShell,
  esc,
  fmtDate,
  itemsTable,
  metaGrid,
  notesSection,
  pageFooter,
  partyGrid,
  signaturesRow,
  totalsPanel,
} from './print-shared';

function whName(w: string | { _id: string; name: string; code: string }) {
  if (typeof w === 'string') return w;
  return w.code ? `${w.name} (${w.code})` : (w.name ?? '');
}

export function buildTransferInvoice(
  transfer: StockTransfer,
  companyName: string
): string {
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

  const watermark =
    transfer.status === 'completed'
      ? `<div style="position:fixed;top:40%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-size:80px;font-weight:900;color:rgba(34,197,94,0.12);pointer-events:none;white-space:nowrap">COMPLETED</div>`
      : transfer.status === 'cancelled'
        ? `<div style="position:fixed;top:40%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-size:80px;font-weight:900;color:rgba(239,68,68,0.12);pointer-events:none;white-space:nowrap">CANCELLED</div>`
        : '';

  const itemRows = transfer.items
    .map((item) => {
      const name = item.sizeName && !item.subProductName.includes(item.sizeName)
        ? `${item.subProductName} – ${item.sizeName}`
        : item.subProductName;
      const done = (item.transferredQty ?? 0) >= item.quantity;
      const pending = Math.max(0, item.quantity - (item.transferredQty ?? 0));
      return `<tr>
        <td style="padding:7px 10px;border-bottom:1px solid #f3f4f6">${esc(name)}<div style="font-size:10px;color:#9ca3af">${esc(item.sku || '')}</div></td>
        <td style="padding:7px 10px;border-bottom:1px solid #f3f4f6;text-align:center">${item.quantity}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:${done ? '700' : '400'};color:${done ? '#16a34a' : '#6b7280'}">${item.transferredQty ?? 0}${pending > 0 ? `<div style="font-size:10px;color:#b45309;font-weight:400">${pending} pending</div>` : ''}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #f3f4f6;text-align:right">${currency} ${(item.costPrice ?? 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</td>
      </tr>`;
    })
    .join('');

  const nameOf = (u?: { name?: string } | null) => u?.name ?? undefined;

  const body = `
  ${watermark}
  ${docHeader({
    companyName,
    department: 'Stock Transfer',
    docTitle: 'Stock Transfer',
    number: transfer.transferNumber,
    status: transfer.status,
  })}

  ${partyGrid(
    { heading: 'From Warehouse', name: whName(transfer.sourceWarehouse) },
    { heading: 'To Warehouse', name: whName(transfer.destinationWarehouse) }
  )}

  ${metaGrid([
    ['Created', fmtDate(transfer.createdAt)],
    ['Scheduled', fmtDate(transfer.scheduledDate)],
    ['Completed', fmtDate(transfer.completedDate)],
    ['Reference', esc(transfer.transferNumber)],
  ])}

  ${itemsTable(
    [
      ['Product', 'left'],
      ['Qty', 'center'],
      ['Transferred', 'right'],
      ['Unit Cost', 'right'],
    ],
    itemRows
  )}

  <div style="display:flex;justify-content:flex-end">
    ${totalsPanel([
      { label: 'Total Quantity', value: String(totalQty) },
      {
        label: 'Transferred',
        value: String(transferredQty),
        color: transferredQty >= totalQty ? '#16a34a' : '#b45309',
      },
      {
        label: 'Stock Value at Cost',
        value: `${currency} ${totalValue.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        variant: 'grand',
      },
    ])}
  </div>

  ${transfer.notes ? notesSection('Notes', transfer.notes) : ''}

  ${signaturesRow([
    { role: 'Dispatched by', name: nameOf(transfer.createdBy) },
    {
      role: 'Approved by',
      name: nameOf((transfer as any).approvedBy),
    },
    { role: 'Received by', name: nameOf(transfer.confirmedBy) },
  ])}

  ${pageFooter(companyName, transfer.transferNumber)}`;

  return docShell({
    title: `Transfer ${transfer.transferNumber}`,
    style: BASE_STYLE,
    watermark: '',
    body,
  });
}
