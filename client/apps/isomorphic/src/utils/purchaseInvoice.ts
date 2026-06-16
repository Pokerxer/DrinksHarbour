import type { VendorBill } from '@/services/vendorBill.service';
import type { PurchaseOrder } from '@/app/shared/purchases/types';
import type { StockTransfer } from '@/services/stockTransfer.service';

function fmtDate(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function fmtAmt(n: number | undefined, currency: string) {
  return `${currency} ${(n ?? 0).toFixed(2)}`;
}

const BASE_STYLE = `
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{height:100%;background:#fff}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:13px;color:#111;padding:20px 28px}
  table{width:100%;border-collapse:collapse}
  th{font-weight:600;text-align:left}
  @media print{@page{size:A4;margin:12mm 14mm}body{padding:0}}
`;

function headerBand(left: string, right: string, company: string) {
  return `<div style="background:linear-gradient(135deg,#b20202 0%,#8a0101 100%);color:#fff;padding:16px 22px;border-radius:6px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center">
    <div>
      <div style="font-size:18px;font-weight:700;letter-spacing:0.5px">${company}</div>
      <div style="font-size:11px;opacity:0.8;margin-top:2px">Purchase Department</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:14px;font-weight:600">${left}</div>
      <div style="font-size:11px;opacity:0.8;margin-top:2px">${right}</div>
    </div>
  </div>`;
}

function footerRow(company: string) {
  return `<div style="margin-top:24px;padding-top:10px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;font-size:10px;color:#9ca3af">
    <span>${company} — Confidential</span>
    <span>Generated ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
  </div>`;
}

function openPrint(html: string): void {
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const win = window.open(
    url,
    '_blank',
    'width=900,height=1100,scrollbars=yes'
  );
  if (win) win.focus();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function buildBillInvoice(bill: VendorBill, companyName: string): string {
  const amountDue = bill.totalAmount - bill.paidAmount;
  const statusUpper = bill.status.toUpperCase();
  const watermark =
    bill.status === 'paid'
      ? `<div style="position:fixed;top:40%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-size:80px;font-weight:900;color:rgba(34,197,94,0.12);pointer-events:none;white-space:nowrap">PAID</div>`
      : bill.status === 'overdue'
        ? `<div style="position:fixed;top:40%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-size:80px;font-weight:900;color:rgba(239,68,68,0.12);pointer-events:none;white-space:nowrap">OVERDUE</div>`
        : '';

  const itemRows = bill.items
    .map((item) => {
      const name = item.subProductName ?? '—';
      const size = item.sizeName
        ? ` <span style="color:#9ca3af;font-size:11px">(${item.sizeName})</span>`
        : '';
      const sku = item.sku
        ? `<div style="font-size:10px;color:#9ca3af">${item.sku}</div>`
        : '';
      return `<tr>
        <td style="padding:7px 10px;border-bottom:1px solid #f3f4f6">${name}${size}${sku}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #f3f4f6;text-align:right">${item.quantity}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #f3f4f6;text-align:right">${fmtAmt(item.unitPrice, bill.currency)}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #f3f4f6;text-align:right">${item.taxRate ?? 0}%</td>
        <td style="padding:7px 10px;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:600">${fmtAmt(item.amount, bill.currency)}</td>
      </tr>`;
    })
    .join('');

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Bill ${bill.billNumber}</title><style>${BASE_STYLE}</style></head><body>
  ${watermark}
  ${headerBand(bill.billNumber, `Status: ${statusUpper}`, companyName)}

  <div style="display:flex;gap:16px;margin-bottom:14px">
    <div style="flex:1;border:1px solid #e5e7eb;border-radius:6px;padding:10px 14px">
      <div style="font-size:10px;color:#9ca3af;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.5px">Bill From</div>
      <div style="font-weight:600;color:#111">${bill.vendorName}</div>
    </div>
    <div style="flex:1;border:1px solid #e5e7eb;border-radius:6px;padding:10px 14px">
      <div style="font-size:10px;color:#9ca3af;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.5px">Bill To</div>
      <div style="font-weight:600;color:#111">${companyName}</div>
    </div>
  </div>

  <div style="display:flex;gap:10px;margin-bottom:14px">
    ${[
      ['Bill Date', fmtDate(bill.billDate)],
      ['Due Date', fmtDate(bill.dueDate)],
      ['Currency', bill.currency],
      ['Reference', bill.billNumber],
    ]
      .map(
        ([l, v]) =>
          `<div style="flex:1;border:1px solid #e5e7eb;border-radius:6px;padding:8px 12px"><div style="font-size:10px;color:#9ca3af">${l}</div><div style="font-weight:600;color:#111;margin-top:2px">${v}</div></div>`
      )
      .join('')}
  </div>

  <table style="margin-bottom:4px">
    <thead>
      <tr style="background:#b20202">
        <th style="padding:8px 10px;color:#fff;font-size:11px">Product</th>
        <th style="padding:8px 10px;color:#fff;font-size:11px;text-align:right">Qty</th>
        <th style="padding:8px 10px;color:#fff;font-size:11px;text-align:right">Unit Price</th>
        <th style="padding:8px 10px;color:#fff;font-size:11px;text-align:right">Tax</th>
        <th style="padding:8px 10px;color:#fff;font-size:11px;text-align:right">Amount</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <div style="display:flex;justify-content:flex-end;margin-bottom:16px">
    <div style="min-width:220px">
      <div style="display:flex;justify-content:space-between;padding:5px 0;color:#6b7280;font-size:12px"><span>Subtotal</span><span>${fmtAmt(bill.subtotal, bill.currency)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:5px 0;color:#6b7280;font-size:12px"><span>Tax</span><span>${fmtAmt(bill.taxAmount, bill.currency)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:8px 0;border-top:2px solid #111;font-size:14px;font-weight:700"><span>Total</span><span>${fmtAmt(bill.totalAmount, bill.currency)}</span></div>
      ${
        bill.paidAmount > 0
          ? `<div style="display:flex;justify-content:space-between;padding:5px 0;color:#16a34a;font-size:12px"><span>Paid</span><span>− ${fmtAmt(bill.paidAmount, bill.currency)}</span></div>
             <div style="display:flex;justify-content:space-between;padding:6px 0;border-top:1px solid #e5e7eb;font-weight:600;color:${amountDue > 0 ? '#dc2626' : '#16a34a'}"><span>Balance Due</span><span>${amountDue > 0 ? fmtAmt(amountDue, bill.currency) : 'PAID'}</span></div>`
          : ''
      }
    </div>
  </div>

  ${bill.notes ? `<div style="border:1px solid #e5e7eb;border-radius:6px;padding:10px 14px;margin-bottom:12px"><div style="font-size:10px;color:#9ca3af;margin-bottom:4px">NOTES</div><div style="font-size:12px;color:#374151">${bill.notes}</div></div>` : ''}

  ${footerRow(companyName)}
  <script>window.addEventListener('load',function(){window.print();});</script>
  </body></html>`;
}

export function printBillInvoice(bill: VendorBill, companyName: string): void {
  openPrint(buildBillInvoice(bill, companyName));
}

export function buildPOInvoice(po: PurchaseOrder, companyName: string): string {
  const totalCost = po.items.reduce(
    (s, it) =>
      s +
      (it.totalCost ??
        ((it as any).unitCost ?? it.unitPrice ?? 0) * it.quantity),
    0
  );

  const itemRows = po.items
    .map((item) => {
      const name = (item as any).subProductName ?? item.productName ?? '—';
      const size = (item as any).sizeName;
      const displayName =
        size && !name.includes(size) ? `${name} – ${size}` : name;
      const unitCost = (item as any).unitCost ?? item.unitPrice ?? 0;
      const total = item.totalCost ?? unitCost * item.quantity;
      return `<tr>
        <td style="padding:7px 10px;border-bottom:1px solid #f3f4f6">${displayName}<div style="font-size:10px;color:#9ca3af">${item.sku ?? ''}</div></td>
        <td style="padding:7px 10px;border-bottom:1px solid #f3f4f6;text-align:right">${item.quantity}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #f3f4f6;text-align:right"><span style="color:${item.receivedQty >= item.quantity ? '#16a34a' : '#6b7280'}">${item.receivedQty}</span></td>
        <td style="padding:7px 10px;border-bottom:1px solid #f3f4f6;text-align:right">${fmtAmt(unitCost, po.currency)}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:600">${fmtAmt(total, po.currency)}</td>
      </tr>`;
    })
    .join('');

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>PO ${po.poNumber}</title><style>${BASE_STYLE}</style></head><body>
  ${headerBand(po.poNumber, `Status: ${po.status.toUpperCase()}`, companyName)}

  <div style="display:flex;gap:16px;margin-bottom:14px">
    <div style="flex:1;border:1px solid #e5e7eb;border-radius:6px;padding:10px 14px">
      <div style="font-size:10px;color:#9ca3af;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.5px">Vendor</div>
      <div style="font-weight:600;color:#111">${po.vendorName ?? '—'}</div>
    </div>
    <div style="flex:1;border:1px solid #e5e7eb;border-radius:6px;padding:10px 14px">
      <div style="font-size:10px;color:#9ca3af;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.5px">Ship To</div>
      <div style="font-weight:600;color:#111">${companyName}</div>
    </div>
  </div>

  <div style="display:flex;gap:10px;margin-bottom:14px">
    ${[
      ['Currency', po.currency],
      ['Order Date', fmtDate(po.createdAt)],
      ['Expected Arrival', fmtDate(po.expectedArrival)],
      ['Vendor Ref', (po as any).vendorReference ?? '—'],
    ]
      .map(
        ([l, v]) =>
          `<div style="flex:1;border:1px solid #e5e7eb;border-radius:6px;padding:8px 12px"><div style="font-size:10px;color:#9ca3af">${l}</div><div style="font-weight:600;color:#111;margin-top:2px">${v}</div></div>`
      )
      .join('')}
  </div>

  <table style="margin-bottom:4px">
    <thead>
      <tr style="background:#b20202">
        <th style="padding:8px 10px;color:#fff;font-size:11px">Product</th>
        <th style="padding:8px 10px;color:#fff;font-size:11px;text-align:right">Ordered</th>
        <th style="padding:8px 10px;color:#fff;font-size:11px;text-align:right">Received</th>
        <th style="padding:8px 10px;color:#fff;font-size:11px;text-align:right">Unit Price</th>
        <th style="padding:8px 10px;color:#fff;font-size:11px;text-align:right">Total</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
    <tfoot>
      <tr style="background:#f9fafb">
        <td colspan="4" style="padding:10px;text-align:right;font-weight:700">Total</td>
        <td style="padding:10px;text-align:right;font-weight:700;font-size:14px">${fmtAmt(totalCost, po.currency)}</td>
      </tr>
    </tfoot>
  </table>

  ${
    po.notes
      ? `<div style="border:1px solid #e5e7eb;border-radius:6px;padding:10px 14px;margin-top:12px;margin-bottom:12px"><div style="font-size:10px;color:#9ca3af;margin-bottom:4px">NOTES</div><div style="font-size:12px;color:#374151">${po.notes}</div></div>`
      : ''
  }

  <div style="display:flex;gap:16px;margin-top:28px">
    <div style="flex:1;border-top:1px solid #d1d5db;padding-top:6px">
      <div style="font-size:10px;color:#9ca3af">Authorised Signature</div>
    </div>
    <div style="flex:1;border-top:1px solid #d1d5db;padding-top:6px">
      <div style="font-size:10px;color:#9ca3af">Vendor Acknowledgement</div>
    </div>
  </div>

  ${footerRow(companyName)}
  <script>window.addEventListener('load',function(){window.print();});</script>
  </body></html>`;
}

export function printPOInvoice(po: PurchaseOrder, companyName: string): void {
  openPrint(buildPOInvoice(po, companyName));
}

// ─── Stock Transfer Invoice ───────────────────────────────────────────────────

function whName(
  w: string | { _id: string; name: string; code: string }
): string {
  if (typeof w === 'string') return w;
  return `${w.name} (${w.code})`;
}

export function buildTransferInvoice(transfer: StockTransfer, companyName: string): string {
  const totalQty = transfer.items.reduce((s, it) => s + it.quantity, 0);
  const transferredQty = transfer.items.reduce(
    (s, it) => s + it.transferredQty,
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
      const name = item.sizeName
        ? `${item.subProductName} – ${item.sizeName}`
        : item.subProductName;
      const done = item.transferredQty >= item.quantity;
      return `<tr>
        <td style="padding:7px 10px;border-bottom:1px solid #f3f4f6">${name}<div style="font-size:10px;color:#9ca3af">${item.sku || ''}</div></td>
        <td style="padding:7px 10px;border-bottom:1px solid #f3f4f6;text-align:right">${item.quantity}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #f3f4f6;text-align:right"><span style="color:${done ? '#16a34a' : '#6b7280'}">${item.transferredQty}</span></td>
      </tr>`;
    })
    .join('');

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Transfer ${transfer.transferNumber}</title><style>${BASE_STYLE}</style></head><body>
  ${watermark}
  ${headerBand(transfer.transferNumber, `Status: ${transfer.status.toUpperCase()}`, companyName)}

  <div style="display:flex;gap:16px;margin-bottom:14px">
    <div style="flex:1;border:1px solid #e5e7eb;border-radius:6px;padding:10px 14px">
      <div style="font-size:10px;color:#9ca3af;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.5px">From Warehouse</div>
      <div style="font-weight:600;color:#111">${whName(transfer.sourceWarehouse)}</div>
    </div>
    <div style="flex:1;border:1px solid #e5e7eb;border-radius:6px;padding:10px 14px">
      <div style="font-size:10px;color:#9ca3af;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.5px">To Warehouse</div>
      <div style="font-weight:600;color:#111">${whName(transfer.destinationWarehouse)}</div>
    </div>
  </div>

  <div style="display:flex;gap:10px;margin-bottom:14px">
    ${[
      ['Created', fmtDate(transfer.createdAt)],
      ['Scheduled', fmtDate(transfer.scheduledDate)],
      ['Completed', fmtDate(transfer.completedDate)],
      ['Reference', transfer.transferNumber],
    ]
      .map(
        ([l, v]) =>
          `<div style="flex:1;border:1px solid #e5e7eb;border-radius:6px;padding:8px 12px"><div style="font-size:10px;color:#9ca3af">${l}</div><div style="font-weight:600;color:#111;margin-top:2px">${v}</div></div>`
      )
      .join('')}
  </div>

  <table style="margin-bottom:4px">
    <thead>
      <tr style="background:#b20202">
        <th style="padding:8px 10px;color:#fff;font-size:11px">Product</th>
        <th style="padding:8px 10px;color:#fff;font-size:11px;text-align:right">Qty Requested</th>
        <th style="padding:8px 10px;color:#fff;font-size:11px;text-align:right">Qty Transferred</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
    <tfoot>
      <tr style="background:#f9fafb">
        <td style="padding:10px;text-align:right;font-weight:700">Total</td>
        <td style="padding:10px;text-align:right;font-weight:700;font-size:14px">${totalQty}</td>
        <td style="padding:10px;text-align:right;font-weight:700;font-size:14px;color:${transferredQty === totalQty ? '#16a34a' : '#6b7280'}">${transferredQty}</td>
      </tr>
    </tfoot>
  </table>

  ${
    transfer.notes
      ? `<div style="border:1px solid #e5e7eb;border-radius:6px;padding:10px 14px;margin-top:12px;margin-bottom:12px"><div style="font-size:10px;color:#9ca3af;margin-bottom:4px">NOTES</div><div style="font-size:12px;color:#374151">${transfer.notes}</div></div>`
      : ''
  }

  <div style="display:flex;gap:16px;margin-top:28px">
    <div style="flex:1;border-top:1px solid #d1d5db;padding-top:6px">
      <div style="font-size:10px;color:#9ca3af">Dispatched by</div>
    </div>
    <div style="flex:1;border-top:1px solid #d1d5db;padding-top:6px">
      <div style="font-size:10px;color:#9ca3af">Received by</div>
    </div>
  </div>

  ${footerRow(companyName)}
  <script>window.addEventListener('load',function(){window.print();});</script>
  </body></html>`;
}

export function printTransferInvoice(transfer: StockTransfer, companyName: string): void {
  openPrint(buildTransferInvoice(transfer, companyName));
}
