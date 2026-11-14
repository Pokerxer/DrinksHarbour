import type { POItem, PurchaseOrder } from '@/app/shared/purchases/types';
import { lineTypeOf } from '@/app/shared/purchases/purchases-create-lines';
import {
  linePackSize,
  packNounOf,
  packsLabel,
} from '@/app/shared/purchases/types';
import { COMPANY, fmtAmt, fmtDate, warehouseContactLine, warehouseHeadOf, warehouseLocalityLine, warehouseStreetLine } from './print-shared';
import { warehouseLabelOf } from '@/services/purchaseOrder.service';
import type { DocCell, DocumentModel } from './doc-model';

function quotedAmounts(item: POItem) {
  const savedUnitPrice = item.unitCost ?? item.unitPrice;
  const unitPrice = Number.isFinite(savedUnitPrice) ? savedUnitPrice : undefined;
  const savedTotal = Number.isFinite(item.totalCost) ? item.totalCost : undefined;
  // The purchase model defaults both amounts to zero for an unpriced request.
  if (!unitPrice && !savedTotal) return {};

  return {
    unitPrice: unitPrice ?? (savedTotal != null && item.quantity > 0
      ? savedTotal / item.quantity
      : undefined),
    lineTotal: savedTotal ?? (unitPrice == null ? undefined : unitPrice * item.quantity),
  };
}

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

  let quotedTotal: number | undefined;
  const money = (amount: number | undefined) =>
    amount == null ? '' : fmtAmt(amount, po.currency);
  const rows: DocCell[][] = po.items.map((item) => {
    const type = lineTypeOf(item);
    if (type !== 'product') {
      const text = type === 'section' ? item.name : item.description;
      return [{ text: text ?? '', strong: type === 'section' }, { text: '' }, { text: '' }, { text: '' }];
    }

    const name = item.subProductName ?? item.productName ?? '—';
    const size = item.sizeName;
    const displayName = size && !name.includes(size) ? `${name} – ${size}` : name;
    const uom = item.uom ? ` ${item.uom}` : '';
    const packs = packsLabel(
      item.quantity,
      linePackSize(item),
      packNounOf(item.packaging)
    );
    const { unitPrice, lineTotal } = quotedAmounts(item);
    if (lineTotal != null) quotedTotal = (quotedTotal ?? 0) + lineTotal;
    return [
      { text: displayName },
      { text: `${item.quantity}${uom}`, sub: packs },
      { text: money(unitPrice) },
      { text: money(lineTotal), strong: lineTotal != null },
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
        lines: [po.vendorReference ? `Vendor ref: ${po.vendorReference}` : ''],
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
    totals: quotedTotal == null
      ? []
      : [{ label: 'Quoted Total', value: money(quotedTotal), variant: 'grand' }],
    sections,
    signatures: [{ role: 'Requested by' }, { role: 'Vendor Quote & Stamp' }],
    fileName: `Request for Quotation ${po.poNumber}.pdf`,
  };
}
