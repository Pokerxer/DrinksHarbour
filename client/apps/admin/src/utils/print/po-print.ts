import { warehouseLabelOf } from '@/services/purchaseOrder.service';
import type { PurchaseOrder } from '@/app/shared/purchases/types';
import {
  linePackSize,
  packNounOf,
  packsLabel,
} from '@/app/shared/purchases/types';
import { fmtAmt, fmtDate, moneyWords } from './print-shared';
import type { DocumentModel, DocCell } from './doc-model';

export function buildPOInvoice(
  po: PurchaseOrder,
  companyName: string
): DocumentModel {
  const lineOf = (it: (typeof po.items)[number]) =>
    it.totalCost ?? ((it as any).unitCost ?? it.unitPrice ?? 0) * it.quantity;
  const totalCost = po.items.reduce((s, it) => s + lineOf(it), 0);

  const rows: DocCell[][] = po.items.map((item) => {
    const name = (item as any).subProductName ?? item.productName ?? '—';
    const size = (item as any).sizeName;
    const displayName =
      size && !name.includes(size) ? `${name} – ${size}` : name;
    const unitCost = (item as any).unitCost ?? item.unitPrice ?? 0;
    const uom = (item as any).uom ? ` ${(item as any).uom}` : '';
    const received = item.receivedQty ?? 0;
    const returned = (item as any).returnedQty ?? 0;
    const outstanding = Math.max(0, item.quantity - received - returned);
    const packs = packsLabel(
      item.quantity,
      linePackSize(item as any),
      packNounOf((item as any).packaging)
    );
    return [
      { text: displayName },
      { text: `${item.quantity}${uom}` },
      { text: packs },
      received >= item.quantity
        ? { text: String(received), color: '#16a34a' }
        : { text: String(received), color: '#6b7280' },
      outstanding > 0
        ? { text: String(outstanding), color: '#b45309' }
        : { text: '0', color: '#9ca3af' },
      { text: fmtAmt(unitCost, po.currency) },
      { text: fmtAmt(lineOf(item), po.currency), strong: true },
    ];
  });

  const agreement =
    typeof po.purchaseAgreement === 'object' && po.purchaseAgreement?._id
      ? po.purchaseAgreement
      : null;

  const meta: [string, string][] = [
    ['Currency', po.currency],
    ['Order Date', fmtDate(po.confirmationDate ?? po.createdAt)],
    ['Expected Arrival', fmtDate(po.expectedArrival)],
    ['Payment Terms', (po as any).paymentTerms || '—'],
    ['Deliver To', warehouseLabelOf(po.warehouse) || '—'],
  ];
  if ((po as any).validUntil)
    meta.push(['Valid Until', fmtDate((po as any).validUntil)]);

  const sections: DocumentModel['sections'] = [];
  if (agreement)
    sections.push({
      title: 'Call-off Agreement',
      body:
        `${agreement.agreementNumber ?? ''}` +
        `${agreement.name ? ` — ${agreement.name}` : ''} ` +
        `(${String(po.agreementType ?? '').replace(/_/g, ' ') || 'blanket'})`,
    });
  if ((po as any).termsConditions)
    sections.push({
      title: 'Conditions of Purchase',
      body: (po as any).termsConditions,
    });
  if (po.notes) sections.push({ title: 'Notes', body: po.notes });

  return {
    kind: 'po',
    companyName,
    department: 'Purchase Order',
    docTitle: 'Purchase Order',
    number: po.poNumber,
    status: po.status,
    notice: po.isBackorder
      ? {
          tone: 'warn',
          title: 'Backorder',
          body:
            'Reorder against an earlier purchase order — original PO: ' +
            String((po as any).originalPO ?? '—'),
        }
      : undefined,
    parties: [
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
      },
    ],
    meta,
    table: {
      columns: [
        { label: 'Product' },
        { label: 'Ordered', align: 'center' },
        { label: 'Packs', align: 'center' },
        { label: 'Received', align: 'right' },
        { label: 'Outstanding', align: 'right' },
        { label: 'Unit Price', align: 'right' },
        { label: 'Total', align: 'right' },
      ],
      rows,
    },
    totals: [
      {
        label: `Items Total (${po.items.length} line${po.items.length === 1 ? '' : 's'})`,
        value: fmtAmt(totalCost, po.currency),
        variant: 'grand',
      },
    ],
    words: moneyWords(totalCost, po.currency),
    sections,
    signatures: [
      {
        role: 'Authorised by (Buyer)',
        name: (po as any).approvedByName || undefined,
      },
      { role: 'Acknowledged by (Vendor)' },
    ],
    fileName: `Purchase Order ${po.poNumber}.pdf`,
  };
}
