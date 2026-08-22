import type { VendorReturn } from '@/services/vendorReturn.service';
import {
  BASE_STYLE,
  docHeader,
  docShell,
  esc,
  fmtAmt,
  fmtDate,
  itemsTable,
  metaGrid,
  notesSection,
  pageFooter,
  partyGrid,
  signaturesRow,
  totalsPanel,
} from './print-shared';

export function buildReturnInvoice(
  ret: VendorReturn,
  companyName: string
): string {
  const itemRows = ret.items
    .map((item) => {
      const name = item.subProductName ?? '—';
      const size = item.sizeName;
      const displayName =
        size && !name.includes(size) ? `${name} – ${size}` : name;
      return `<tr>
        <td style="padding:7px 10px;border-bottom:1px solid #f3f4f6">${esc(displayName)}<div style="font-size:10px;color:#9ca3af">${esc(item.sku ?? '')}</div></td>
        <td style="padding:7px 10px;border-bottom:1px solid #f3f4f6;text-align:center;text-transform:capitalize">${esc((item.reason ?? '—').replace(/_/g, ' '))}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #f3f4f6;text-align:center">${item.quantity}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #f3f4f6;text-align:right">${fmtAmt(item.unitPrice, ret.currency)}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:600">${fmtAmt(item.amount, ret.currency)}</td>
      </tr>`;
    })
    .join('');

  const shipping =
    ret.shippingCarrier || ret.trackingNumber || ret.returnAddress
      ? `<div class="section">
          <div class="sec-title">Return Shipment</div>
          <div style="display:flex;gap:24px;flex-wrap:wrap;font-size:12px;color:#374151">
            ${ret.shippingCarrier ? `<div><span class="meta-label">Carrier</span><div>${esc(ret.shippingCarrier)}</div></div>` : ''}
            ${ret.trackingNumber ? `<div><span class="meta-label">Tracking</span><div style="font-family:monospace">${esc(ret.trackingNumber)}</div></div>` : ''}
            ${ret.returnAddress ? `<div style="flex:1;min-width:180px"><span class="meta-label">Return Address</span><div>${esc(ret.returnAddress)}</div></div>` : ''}
          </div>
        </div>`
      : '';

  const refund =
    (ret.refundStatus && ret.refundStatus !== 'none') || ret.refundAmount
      ? `<div class="section">
          <div class="sec-title">Refund</div>
          <div style="display:flex;gap:24px;flex-wrap:wrap;font-size:12px;color:#374151">
            ${ret.refundMethod ? `<div><span class="meta-label">Method</span><div style="text-transform:capitalize">${esc(ret.refundMethod.replace(/_/g, ' '))}</div></div>` : ''}
            ${ret.refundReference ? `<div><span class="meta-label">Reference</span><div>${esc(ret.refundReference)}</div></div>` : ''}
            ${ret.refundDate ? `<div><span class="meta-label">Date</span><div>${fmtDate(ret.refundDate)}</div></div>` : ''}
            <div><span class="meta-label">Status</span><div style="text-transform:capitalize;font-weight:700">${esc(ret.refundStatus ?? 'pending')}</div></div>
            <div><span class="meta-label">Amount</span><div style="font-weight:700;color:#16a34a">${fmtAmt(ret.refundAmount ?? 0, ret.currency)}</div></div>
          </div>
        </div>`
      : '';

  const body = `
  ${docHeader({
    companyName,
    department: 'Vendor Return',
    docTitle: 'Return Advice',
    number: ret.returnNumber,
    status: ret.status,
  })}

  ${partyGrid(
    { heading: 'Return To (Vendor)', name: ret.vendorName ?? '—' },
    {
      heading: 'Returned By (Buyer)',
      name: companyName,
      lines: [ret.poNumber ? `Against PO: ${ret.poNumber}` : ''],
    }
  )}

  ${metaGrid([
    ['Currency', esc(ret.currency)],
    ['Return Date', fmtDate(ret.returnDate)],
    ['PO Reference', esc((ret as any).poNumber ?? '—')],
    ['Bill Reference', esc(ret.billNumber ?? '—')],
  ])}

  ${itemsTable(
    [
      ['Product', 'left'],
      ['Reason', 'center'],
      ['Qty', 'center'],
      ['Unit Price', 'right'],
      ['Total', 'right'],
    ],
    itemRows
  )}

  <div style="display:flex;justify-content:flex-end">
    ${totalsPanel([
      { label: 'Subtotal', value: fmtAmt(ret.subtotal, ret.currency) },
      { label: 'Tax', value: fmtAmt(ret.taxAmount, ret.currency) },
      {
        label: 'Return Total',
        value: fmtAmt(ret.totalAmount, ret.currency),
        variant: 'grand',
      },
    ])}
  </div>

  ${shipping}
  ${refund}
  ${ret.reason ? notesSection('Return Reason', ret.reason.replace(/_/g, ' ')) : ''}
  ${ret.notes ? notesSection('Notes', ret.notes) : ''}

  ${signaturesRow([
    { role: 'Authorised by (Buyer)' },
    { role: 'Acknowledged by (Vendor)' },
  ])}

  ${pageFooter(companyName, ret.returnNumber)}`;

  return docShell({
    title: `Return ${ret.returnNumber}`,
    style: BASE_STYLE,
    body,
  });
}
