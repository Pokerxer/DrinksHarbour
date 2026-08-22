import type { PurchaseOrder } from '@/app/shared/purchases/types';
import {
  BASE_STYLE,
  COMPANY,
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
} from './print-shared';

// A printed RFQ asks the vendor for prices — it does not state them. Lines are
// rendered with blank quote cells to fill in by hand, plus explicit response
// instructions so a paper RFQ is actionable on its own.
export function buildRFQInvoice(
  po: PurchaseOrder,
  companyName: string
): string {
  const itemRows = po.items
    .map((item, i) => {
      const name = (item as any).subProductName ?? item.productName ?? '—';
      const size = item.sizeName;
      const displayName =
        size && !name.includes(size) ? `${name} – ${size}` : name;
      const uom = (item as any).uom ? ` ${(item as any).uom}` : '';
      return `<tr>
        <td style="padding:7px 10px;border-bottom:1px solid #f3f4f6">${esc(displayName)}<div style="font-size:10px;color:#9ca3af">${esc(item.sku ?? '')}</div></td>
        <td style="padding:7px 10px;border-bottom:1px solid #f3f4f6;text-align:center">${item.quantity}<span style="font-size:10px;color:#9ca3af">${esc(uom)}</span></td>
        <td style="padding:7px 10px;border-bottom:1px solid #f3f4f6">&nbsp;</td>
        <td style="padding:7px 10px;border-bottom:1px solid #f3f4f6">&nbsp;</td>
      </tr>`;
    })
    .join('');

  const body = `
  ${docHeader({
    companyName,
    department: 'Purchase Department',
    docTitle: 'Request for Quotation',
    number: po.poNumber,
    status: po.rfqStatus ?? po.status,
  })}

  ${partyGrid(
    { heading: 'Quote To (Buyer)', name: companyName },
    {
      heading: 'Vendor / Supplier',
      name: po.vendorName ?? '—',
      lines: [
        (po as any).vendorReference
          ? `Vendor ref: ${(po as any).vendorReference}`
          : '',
      ],
    }
  )}

  ${metaGrid([
    ['Currency', esc(po.currency)],
    ['RFQ Date', fmtDate(po.createdAt)],
    ['Respond By', fmtDate(po.validUntil)],
    ['Expected Delivery', fmtDate(po.expectedArrival)],
  ])}

  ${itemsTable(
    ['Product', 'Requested Qty', 'Quoted Unit Price', 'Quoted Total'].map(
      (label, i) =>
        [label, i === 0 ? 'left' : i === 1 ? 'center' : 'right'] as [
          string,
          'left' | 'center' | 'right',
        ]
    ),
    itemRows
  )}

  <div class="section">
    <div class="sec-title">How to Respond</div>
    <div style="font-size:12px;color:#374151;line-height:1.6">
      Please return your completed quote before <strong>${fmtDate(po.validUntil)}</strong>,
      stating unit price, delivery lead time, and your payment conditions for each line.
      Quotes may be submitted by email to ${esc(COMPANY.email)} quoting ${esc(po.poNumber)}.
    </div>
  </div>

  ${po.termsConditions ? notesSection('Conditions of Purchase', po.termsConditions) : ''}
  ${po.notes ? notesSection('Notes', po.notes) : ''}

  ${signaturesRow([
    { role: 'Requested by' },
    { role: 'Vendor Quote & Stamp' },
  ])}

  ${pageFooter(companyName, po.poNumber)}`;

  return docShell({
    title: `RFQ ${po.poNumber}`,
    style: BASE_STYLE,
    body,
  });
}
