import { warehouseLabelOf } from '@/services/purchaseOrder.service';
import type { PurchaseOrder } from '@/app/shared/purchases/types';
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

export function buildPOInvoice(po: PurchaseOrder, companyName: string): string {
  const lineOf = (it: (typeof po.items)[number]) =>
    it.totalCost ??
    ((it as any).unitCost ?? it.unitPrice ?? 0) * it.quantity;
  const totalCost = po.items.reduce((s, it) => s + lineOf(it), 0);

  const itemRows = po.items
    .map((item) => {
      const name = (item as any).subProductName ?? item.productName ?? '—';
      const size = (item as any).sizeName;
      const displayName =
        size && !name.includes(size) ? `${name} – ${size}` : name;
      const unitCost = (item as any).unitCost ?? item.unitPrice ?? 0;
      const uom = (item as any).uom ? ` ${(item as any).uom}` : '';
      const received = item.receivedQty ?? 0;
      const returned = (item as any).returnedQty ?? 0;
      const outstanding = Math.max(0, item.quantity - received - returned);
      return `<tr>
        <td style="padding:7px 10px;border-bottom:1px solid #f3f4f6">${esc(displayName)}<div style="font-size:10px;color:#9ca3af">${esc(item.sku ?? '')}</div></td>
        <td style="padding:7px 10px;border-bottom:1px solid #f3f4f6;text-align:center">${item.quantity}<span style="font-size:10px;color:#9ca3af">${esc(uom)}</span></td>
        <td style="padding:7px 10px;border-bottom:1px solid #f3f4f6;text-align:right;color:${received >= item.quantity ? '#16a34a' : '#6b7280'}">${received}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #f3f4f6;text-align:right;color:${outstanding > 0 ? '#b45309' : '#9ca3af'}">${outstanding}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #f3f4f6;text-align:right">${fmtAmt(unitCost, po.currency)}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:600">${fmtAmt(lineOf(item), po.currency)}</td>
      </tr>`;
    })
    .join('');

  const agreement =
    typeof po.purchaseAgreement === 'object' && po.purchaseAgreement?._id
      ? po.purchaseAgreement
      : null;

  const metaCells: [string, string][] = [
    ['Currency', esc(po.currency)],
    ['Order Date', fmtDate(po.confirmationDate ?? po.createdAt)],
    ['Expected Arrival', fmtDate(po.expectedArrival)],
    ['Payment Terms', esc((po as any).paymentTerms || '—')],
    ['Deliver To', esc(warehouseLabelOf(po.warehouse) || '—')],
  ];
  if ((po as any).validUntil)
    metaCells.push(['Valid Until', fmtDate((po as any).validUntil)]);

  const totals = totalsPanel([
    {
      label: `Items Total (${po.items.length} line${po.items.length === 1 ? '' : 's'})`,
      value: fmtAmt(totalCost, po.currency),
      variant: 'grand',
    },
  ]);

  const body = `
  ${docHeader({
    companyName,
    department: 'Purchase Order',
    docTitle: 'Purchase Order',
    number: po.poNumber,
    status: po.status,
  })}
  ${
    po.isBackorder
      ? `<div class="section" style="margin-top:-8px;margin-bottom:14px;background:#fffbeb;border-color:#fcd34d"><div class="sec-title" style="color:#92400e">Backorder</div><div style="font-size:12px;color:#78350f">Reorder against an earlier purchase order — original PO: ${esc(String((po as any).originalPO ?? '—'))}</div></div>`
      : ''
  }

  ${partyGrid(
    {
      heading: 'Buyer',
      name: companyName,
      lines: ['Deliver to the destination stated above'],
    },
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

  <div style="margin-bottom:16px">${metaGrid(metaCells)}</div>

  ${itemsTable(
    [
      ['Product', 'left'],
      ['Ordered', 'center'],
      ['Received', 'right'],
      ['Outstanding', 'right'],
      ['Unit Price', 'right'],
      ['Total', 'right'],
    ],
    itemRows
  )}

  <div style="display:flex;justify-content:flex-end">
    <div>
      ${totals}
      ${wordsBox(moneyWords(totalCost, po.currency))}
    </div>
  </div>

  ${agreement ? notesSection('Call-off Agreement', `${agreement.agreementNumber ?? ''}${agreement.name ? ` — ${agreement.name}` : ''} (${String(po.agreementType ?? '').replace(/_/g, ' ') || 'blanket'})`) : ''}
  ${(po as any).termsConditions ? notesSection('Conditions of Purchase', (po as any).termsConditions) : ''}
  ${po.notes ? notesSection('Notes', po.notes) : ''}

  ${signaturesRow([
    {
      role: 'Authorised by (Buyer)',
      name:
        (po as any).approvedByName ||
        undefined,
    },
    { role: 'Acknowledged by (Vendor)' },
  ])}

  ${pageFooter(companyName, po.poNumber)}`;

  return docShell({
    title: `Purchase Order ${po.poNumber}`,
    style: BASE_STYLE,
    body,
  });
}
