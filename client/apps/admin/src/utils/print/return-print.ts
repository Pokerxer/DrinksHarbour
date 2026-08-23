import type { VendorReturn } from '@/services/vendorReturn.service';
import { fmtAmt, fmtDate } from './print-shared';
import type { DocumentModel, DocCell } from './doc-model';

export function buildReturnInvoice(
  ret: VendorReturn,
  companyName: string
): DocumentModel {
  const rows: DocCell[][] = ret.items.map((item) => {
    const name = item.subProductName ?? '—';
    const size = item.sizeName;
    const displayName =
      size && !name.includes(size) ? `${name} – ${size}` : name;
    return [
      { text: displayName },
      { text: (item.reason ?? '—').replace(/_/g, ' ') },
      { text: String(item.quantity) },
      { text: fmtAmt(item.unitPrice, ret.currency) },
      { text: fmtAmt(item.amount, ret.currency), strong: true },
    ];
  });

  const kvGroups: DocumentModel['kvGroups'] = [];
  if (ret.shippingCarrier || ret.trackingNumber || ret.returnAddress) {
    const items: [string, string][] = [];
    if (ret.shippingCarrier) items.push(['Carrier', ret.shippingCarrier]);
    if (ret.trackingNumber) items.push(['Tracking', ret.trackingNumber]);
    if (ret.returnAddress) items.push(['Return Address', ret.returnAddress]);
    kvGroups.push({ title: 'Return Shipment', items });
  }
  if ((ret.refundStatus && ret.refundStatus !== 'none') || ret.refundAmount) {
    const items: [string, string][] = [];
    if (ret.refundMethod)
      items.push(['Method', ret.refundMethod.replace(/_/g, ' ')]);
    if (ret.refundReference) items.push(['Reference', ret.refundReference]);
    if (ret.refundDate) items.push(['Date', fmtDate(ret.refundDate)]);
    items.push(['Status', ret.refundStatus ?? 'pending']);
    items.push(['Amount', fmtAmt(ret.refundAmount ?? 0, ret.currency)]);
    kvGroups.push({ title: 'Refund', items });
  }

  const sections: DocumentModel['sections'] = [];
  if (ret.reason)
    sections.push({
      title: 'Return Reason',
      body: ret.reason.replace(/_/g, ' '),
    });
  if (ret.notes) sections.push({ title: 'Notes', body: ret.notes });

  return {
    kind: 'return',
    companyName,
    department: 'Vendor Return',
    docTitle: 'Return Advice',
    number: ret.returnNumber,
    status: ret.status,
    parties: [
      { heading: 'Return To (Vendor)', name: ret.vendorName ?? '—' },
      {
        heading: 'Returned By (Buyer)',
        name: companyName,
        lines: [ret.poNumber ? `Against PO: ${ret.poNumber}` : ''],
      },
    ],
    meta: [
      ['Currency', ret.currency],
      ['Return Date', fmtDate(ret.returnDate)],
      ['PO Reference', (ret as any).poNumber ?? '—'],
      ['Bill Reference', ret.billNumber ?? '—'],
    ],
    table: {
      columns: [
        { label: 'Product' },
        { label: 'Reason', align: 'center' },
        { label: 'Qty', align: 'center' },
        { label: 'Unit Price', align: 'right' },
        { label: 'Total', align: 'right' },
      ],
      rows,
    },
    totals: [
      { label: 'Subtotal', value: fmtAmt(ret.subtotal, ret.currency) },
      { label: 'Tax', value: fmtAmt(ret.taxAmount, ret.currency) },
      {
        label: 'Return Total',
        value: fmtAmt(ret.totalAmount, ret.currency),
        variant: 'grand',
      },
    ],
    kvGroups,
    sections,
    signatures: [
      { role: 'Authorised by (Buyer)' },
      { role: 'Acknowledged by (Vendor)' },
    ],
    fileName: `Return Advice ${ret.returnNumber}.pdf`,
  };
}
