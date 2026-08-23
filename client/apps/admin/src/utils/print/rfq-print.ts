import type { PurchaseOrder } from '@/app/shared/purchases/types';
import {
  linePackSize,
  packNounOf,
  packsLabel,
} from '@/app/shared/purchases/types';
import { COMPANY, fmtDate, warehouseContactLine, warehouseHeadOf, warehouseLocalityLine, warehouseStreetLine } from './print-shared';
import { warehouseLabelOf } from '@/services/purchaseOrder.service';
import type { DocumentModel } from './doc-model';

// An RFQ asks the vendor for prices — it does not state them. Lines are
// rendered with blank quote cells to fill in by hand, plus explicit response
// instructions so a paper RFQ is actionable on its own.
export function buildRFQInvoice(
  po: PurchaseOrder,
  companyName: string
): DocumentModel {
  // Same rule as the PO: the selected destination warehouse is the buyer.
  const warehouse =
    typeof po.warehouse === 'object' && po.warehouse?._id
      ? po.warehouse
      : null;
  const head = warehouseHeadOf(warehouse);
  const identityName = warehouse?.name || companyName;
  const quoteToBox = warehouse
    ? {
        heading: 'Quote To (Buyer)',
        name: warehouseLabelOf(po.warehouse),
        lines: [
          warehouseStreetLine(warehouse),
          warehouseLocalityLine(warehouse),
          warehouseContactLine(warehouse),
        ].filter(Boolean),
      }
    : { heading: 'Quote To (Buyer)', name: companyName };

  const displayNameOf = (item: PurchaseOrder['items'][number]) => {
    const name = (item as any).subProductName ?? item.productName ?? '—';
    const size = item.sizeName;
    return size && !name.includes(size) ? `${name} – ${size}` : name;
  };

  const rows = po.items.map((item) => {
    const uom = (item as any).uom ? ` ${(item as any).uom}` : '';
    const packs = packsLabel(
      item.quantity,
      linePackSize(item as any),
      packNounOf((item as any).packaging)
    );
    return [
      { text: displayNameOf(item) },
      { text: `${item.quantity}${uom}`, sub: packs },
      { text: '' },
      { text: '' },
    ];
  });

  const sections: DocumentModel['sections'] = [];
  const respondEmail = warehouse?.contact?.email || COMPANY.email;
  sections.push({
    title: 'How to Respond',
    body:
      `Please return your completed quote before ${fmtDate(po.validUntil)}, ` +
      `stating unit price, delivery lead time, and your payment conditions for each line. ` +
      `Quotes may be submitted by email to ${respondEmail} quoting ${po.poNumber}.`,
  });
  if (po.termsConditions)
    sections.push({
      title: 'Conditions of Purchase',
      body: po.termsConditions,
    });
  if (po.notes) sections.push({ title: 'Notes', body: po.notes });

  return {
    kind: 'rfq',
    companyName: identityName,
    head,
    department: 'Purchase Department',
    docTitle: 'Request for Quotation',
    number: po.poNumber,
    status: po.rfqStatus ?? po.status,
    parties: [
      quoteToBox,
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
    meta: [
      ['Currency', po.currency],
      ['RFQ Date', fmtDate(po.createdAt)],
      ['Respond By', fmtDate(po.validUntil)],
      ['Expected Delivery', fmtDate(po.expectedArrival)],
    ],
    table: {
      columns: [
        { label: 'Product' },
        { label: 'Requested Qty / Packs', align: 'center' },
        { label: 'Quoted Unit Price', align: 'right' },
        { label: 'Quoted Total', align: 'right' },
      ],
      rows,
    },
    totals: [],
    sections,
    signatures: [{ role: 'Requested by' }, { role: 'Vendor Quote & Stamp' }],
    fileName: `Request for Quotation ${po.poNumber}.pdf`,
  };
}
