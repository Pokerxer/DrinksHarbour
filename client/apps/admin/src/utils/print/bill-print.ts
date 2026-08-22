import type { VendorBill } from '@/services/vendorBill.service';
import {
  BASE_STYLE,
  docHeader,
  docShell,
  esc,
  fmtAmt,
  fmtDate,
  itemsTable,
  metaGrid,
  moneyWords,
  notesSection,
  pageFooter,
  partyGrid,
  signaturesRow,
  totalsPanel,
  wordsBox,
} from './print-shared';

export function buildBillInvoice(
  bill: VendorBill,
  companyName: string
): string {
  const amountDue = Math.max(0, bill.totalAmount - bill.paidAmount);

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
        ? ` – ${item.sizeName}`
        : '';
      return `<tr>
        <td style="padding:7px 10px;border-bottom:1px solid #f3f4f6">${esc(name)}${esc(size)}<div style="font-size:10px;color:#9ca3af">${esc(item.sku ?? '')}</div></td>
        <td style="padding:7px 10px;border-bottom:1px solid #f3f4f6;text-align:center">${item.quantity}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #f3f4f6;text-align:right">${fmtAmt(item.unitPrice, bill.currency)}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #f3f4f6;text-align:right">${item.taxRate ?? 0}%</td>
        <td style="padding:7px 10px;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:600">${fmtAmt(item.amount, bill.currency)}</td>
      </tr>`;
    })
    .join('');

  const paymentsHtml =
    bill.payments && bill.payments.length
      ? `<div class="section">
          <div class="sec-title">Payments (${bill.payments.length})</div>
          <table style="margin-top:2px">
            <thead><tr>
              <th style="font-size:9px;color:#9ca3af;text-transform:uppercase;letter-spacing:.08em;padding:4px 8px 4px 0">Date</th>
              <th style="font-size:9px;color:#9ca3af;text-transform:uppercase;letter-spacing:.08em;padding:4px 8px">Method</th>
              <th style="font-size:9px;color:#9ca3af;text-transform:uppercase;letter-spacing:.08em;padding:4px 8px">Reference</th>
              <th style="font-size:9px;color:#9ca3af;text-transform:uppercase;letter-spacing:.08em;padding:4px 0 4px 8px;text-align:right">Amount</th>
            </tr></thead>
            <tbody>${bill.payments
              .map(
                (p) => `<tr>
                  <td style="padding:5px 8px 5px 0;font-size:12px;color:#374151">${fmtDate(p.date)}</td>
                  <td style="padding:5px 8px;font-size:12px;color:#374151;text-transform:capitalize">${esc((p.method ?? '—').replace(/_/g, ' '))}</td>
                  <td style="padding:5px 8px;font-size:12px;color:#374151">${esc(p.reference ?? '—')}</td>
                  <td style="padding:5px 0 5px 8px;font-size:12px;font-weight:600;text-align:right;color:#16a34a">${fmtAmt(p.amount, bill.currency)}</td>
                </tr>`
              )
              .join('')}</tbody>
          </table>
        </div>`
      : '';

  const body = `
  ${watermark}
  ${docHeader({
    companyName,
    department: 'Vendor Bill',
    docTitle: 'Vendor Bill',
    number: bill.billNumber,
    status: bill.status,
  })}

  ${partyGrid(
    {
      heading: 'Bill From (Vendor)',
      name: bill.vendorName,
    },
    { heading: 'Bill To (Buyer)', name: companyName }
  )}

  ${metaGrid([
    ['Bill Date', fmtDate(bill.billDate)],
    ['Due Date', fmtDate(bill.dueDate)],
    ['Currency', esc(bill.currency)],
    ['Reference', esc(bill.billNumber)],
  ])}

  ${itemsTable(
    [
      ['Product', 'left'],
      ['Qty', 'center'],
      ['Unit Price', 'right'],
      ['Tax', 'right'],
      ['Amount', 'right'],
    ],
    itemRows
  )}

  <div style="display:flex;justify-content:flex-end">
    <div>
      ${totalsPanel([
        { label: 'Subtotal', value: fmtAmt(bill.subtotal, bill.currency) },
        { label: 'Tax', value: fmtAmt(bill.taxAmount, bill.currency) },
        {
          label: 'Total',
          value: fmtAmt(bill.totalAmount, bill.currency),
          variant: 'grand',
        },
        ...(bill.paidAmount > 0
          ? [
              {
                label: 'Paid to date',
                value: `− ${fmtAmt(bill.paidAmount, bill.currency)}`,
                color: '#16a34a',
              },
              {
                label: 'Balance Due',
                value: fmtAmt(amountDue, bill.currency),
                variant: 'strong' as const,
                color: amountDue > 0 ? '#dc2626' : '#16a34a',
              },
            ]
          : []),
      ])}
      ${wordsBox(moneyWords(bill.totalAmount, bill.currency))}
    </div>
  </div>

  ${paymentsHtml}
  ${bill.terms ? notesSection('Payment Terms', bill.terms) : ''}
  ${bill.notes ? notesSection('Notes', bill.notes) : ''}

  ${signaturesRow([
    { role: 'Received & checked by (Buyer)' },
    { role: 'Vendor Authorised Signature' },
  ])}

  ${pageFooter(companyName, bill.billNumber)}`;

  return docShell({
    title: `Bill ${bill.billNumber}`,
    style: BASE_STYLE,
    watermark: '',
    body,
  });
}
