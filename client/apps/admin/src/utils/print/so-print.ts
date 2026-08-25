import type { SalesOrder, SalesLineItem } from '@/services/salesOrder.service';
import { packsLabel } from '@/app/shared/purchases/types';
import {
  fmtAmt,
  fmtDate,
  moneyWords,
  warehouseContactLine,
  warehouseHeadOf,
  warehouseLocalityLine,
  warehouseStreetLine,
} from './print-shared';
import type { DocumentModel, DocCell, DocPartyBox } from './doc-model';

export type SalesDocVariant = 'quotation' | 'proforma' | 'sales-order';

const QUOTE_STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  sent: 'Sent',
  accepted: 'Accepted',
  rejected: 'Rejected',
  expired: 'Expired',
  converted: 'Converted',
};
const ORDER_STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  confirmed: 'Confirmed',
  partially_fulfilled: 'Partially Fulfilled',
  fulfilled: 'Fulfilled',
  cancelled: 'Cancelled',
};
const PAYMENT_TERMS_LABEL: Record<string, string> = {
  immediate: 'Immediate',
  net_7: 'Net 7 days',
  net_15: 'Net 15 days',
  net_30: 'Net 30 days',
  net_45: 'Net 45 days',
  net_60: 'Net 60 days',
  end_of_month: 'End of Month',
};

function isSection(i: SalesLineItem) {
  return i.lineType === 'section';
}
function isNote(i: SalesLineItem) {
  return i.lineType === 'note';
}

/** Same address-lines shape as the PO's warehouse ref (print-shared helpers). */
type WhRef = NonNullable<SalesOrder['warehouseId']> & object;

/**
 * Build a branded sales document (Quotation / Pro-Forma Invoice / Sales Order)
 * in the same DocumentModel shape the purchase documents use. The selected
 * fulfilment warehouse is the issuing entity on paper — its name leads and its
 * address/contact fill the head block and Seller box — mirroring how a PO
 * presents its destination warehouse as the buyer. A bare warehouse id or no
 * warehouse falls back to the tenant company.
 */
export function buildSalesDoc(
  so: SalesOrder,
  companyName: string,
  variant: SalesDocVariant
): DocumentModel {
  const warehouse =
    so.warehouseId && typeof so.warehouseId === 'object' && so.warehouseId._id
      ? (so.warehouseId as WhRef)
      : null;
  const head = warehouseHeadOf(warehouse);
  const identityName = warehouse?.name || companyName;
  const sellerBox: DocPartyBox = warehouse
    ? {
        heading: 'Fulfil From (Seller)',
        name: warehouse.name || companyName,
        lines: [
          warehouseStreetLine(warehouse),
          warehouseLocalityLine(warehouse),
          warehouseContactLine(warehouse),
        ].filter(Boolean),
      }
    : {
        heading: 'Fulfil From (Seller)',
        name: companyName,
        lines: [],
      };

  const snap = so.customerSnapshot ?? {};
  const inv = so.invoiceAddress ?? {};
  const customerBox: DocPartyBox = {
    heading: 'Bill To (Customer)',
    name: snap.name ?? 'Walk-in Customer',
    lines: [
      ...(inv.street ? [inv.street] : []),
      ...([inv.city, inv.state, inv.country].filter(Boolean).length
        ? [[inv.city, inv.state, inv.country].filter(Boolean).join(', ')]
        : []),
      snap.phone ?? inv.phone ?? '',
      snap.email ?? '',
    ].filter(Boolean),
  };

  const ship = so.deliveryAddress;
  const deliverBox =
    ship &&
    (ship.name || ship.street || ship.city) &&
    JSON.stringify(ship) !== JSON.stringify(so.invoiceAddress)
      ? {
          heading: 'Deliver To',
          name: ship.name || snap.name || '—',
          lines: [
            ...(ship.street ? [ship.street] : []),
            ...([ship.city, ship.state, ship.country].filter(Boolean).length
              ? [[ship.city, ship.state, ship.country]
                  .filter(Boolean)
                  .join(', ')]
              : []),
            ship.phone ?? '',
          ].filter(Boolean),
        }
      : null;

  const isProforma = variant === 'proforma';
  const isQuotation = so.docType === 'quotation';
  const rawStatus = isQuotation
    ? (so.quoteStatus ?? 'draft')
    : (so.orderStatus ?? 'draft');
  const statusLabel = isQuotation
    ? (QUOTE_STATUS_LABEL[rawStatus] ?? rawStatus)
    : (ORDER_STATUS_LABEL[rawStatus] ?? rawStatus);

  // ── Table ────────────────────────────────────────────────────────────────
  // Product lines carry price; section lines become group headers; standalone
  // note lines are folded into a Notes section so nothing handwritten is lost.
  const productLines = so.items.filter(
    (i) => !isSection(i) && !isNote(i)
  );
  const untaxed = productLines.reduce((s, l) => s + (l.lineTotal ?? 0), 0);
  const taxAmt =
    so.taxTotal ?? productLines.reduce((s, l) => s + (l.taxAmount ?? 0), 0);
  const discAmt = so.discountTotal ?? 0;

  const rows: DocCell[][] = so.items.map((item) => {
    if (isSection(item)) {
      return [
        { text: item.name || 'Section', strong: true },
        ...Array.from({ length: 5 }, () => ({ text: '' })),
      ];
    }
    if (isNote(item)) return null;
    const packs = packsLabel(item.quantity, item.packSize, 'bottle');
    return [
      {
        text: item.name ?? '—',
        sub: [item.sku, item.description].filter(Boolean).join(' · ') || undefined,
      },
      {
        text: String(item.quantity),
        sub: item.packSize && item.packSize > 1 ? packs : undefined,
        align: undefined,
      },
      { text: fmtAmt(item.unitPrice, so.currency) },
      item.discount > 0
        ? {
            text:
              item.discountType === 'percentage'
                ? `${item.discount}%`
                : `−${fmtAmt(item.discount, so.currency)}`,
          }
        : { text: '—' },
      item.taxRate ? `${item.taxRate}%` : '—',
      { text: fmtAmt(item.lineTotal, so.currency), strong: true },
    ].map((c) => (typeof c === 'string' ? { text: c } : c)) as DocCell[];
  }).filter((r): r is DocCell[] => r !== null);

  // ── Totals ───────────────────────────────────────────────────────────────
  const totals: DocumentModel['totals'] = [];
  totals.push({
    label: `Items Total (${productLines.length} line${productLines.length === 1 ? '' : 's'})`,
    value: fmtAmt(untaxed, so.currency),
  });
  if (discAmt > 0)
    totals.push({
      label: 'Discount',
      value: `−${fmtAmt(discAmt, so.currency)}`,
      color: '#dc2626',
    });
  if ((so.pricelistCartDiscount ?? 0) > 0)
    totals.push({
      label: `Spend Discount${so.appliedPricelist?.pricelistName ? ` (${so.appliedPricelist.pricelistName})` : ''}`,
      value: `−${fmtAmt(so.pricelistCartDiscount!, so.currency)}`,
      color: '#dc2626',
    });
  if ((so.couponDiscount ?? 0) > 0)
    totals.push({
      label: `Coupon ${so.couponCode ?? ''}`.trim(),
      value: `−${fmtAmt(so.couponDiscount!, so.currency)}`,
      color: '#16a34a',
    });
  if (taxAmt > 0) totals.push({ label: 'Tax', value: fmtAmt(taxAmt, so.currency) });
  if ((so.shippingFee ?? 0) > 0)
    totals.push({ label: 'Shipping', value: fmtAmt(so.shippingFee!, so.currency) });
  totals.push({
    label: 'Total',
    value: fmtAmt(so.total, so.currency),
    variant: 'grand',
  });

  // ── Sections & meta ──────────────────────────────────────────────────────
  const sections: DocumentModel['sections'] = [];
  const noteLines = so.items
    .filter(isNote)
    .map((n) => n.description || n.name || '')
    .filter(Boolean);
  const notesBody = [so.notes, ...noteLines].filter(Boolean).join('\n');
  if (notesBody) sections.push({ title: 'Notes', body: notesBody });
  if (so.terms)
    sections.push({ title: 'Terms & Conditions', body: so.terms });

  const meta: [string, string][] = [
    ['Issue Date', fmtDate(so.createdAt)],
    ['Valid Until', fmtDate(so.validUntil)],
    [
      'Payment Terms',
      PAYMENT_TERMS_LABEL[so.paymentTerms ?? ''] ?? 'Immediate',
    ],
    ['Currency', so.currency ?? 'NGN'],
    ['Fulfil From', warehouse?.name ?? companyName],
  ];

  const docTitle = isProforma
    ? 'Pro-Forma Invoice'
    : isQuotation
      ? 'Quotation'
      : 'Sales Order';
  const fileBase = isProforma
    ? 'Pro-Forma Invoice'
    : isQuotation
      ? 'Quotation'
      : 'Sales Order';

  return {
    kind: variant === 'proforma' ? 'proforma' : isQuotation ? 'quotation' : 'sales-order',
    companyName: identityName,
    head,
    department: 'Sales',
    docTitle,
    number: so.soNumber,
    status: statusLabel,
    notice: isProforma
      ? {
          tone: 'info',
          title: 'Pro-Forma Invoice',
          body:
            'Issued for advance payment or customs purposes only — not a tax invoice. A formal VAT invoice follows confirmation and delivery.',
        }
      : undefined,
    parties: deliverBox
      ? [sellerBox, customerBox, deliverBox]
      : [sellerBox, customerBox],
    meta,
    table: {
      columns: [
        { label: 'Product' },
        { label: 'Qty / Packs', align: 'center' },
        { label: 'Unit Price', align: 'right' },
        { label: 'Discount', align: 'right' },
        { label: 'Tax', align: 'right' },
        { label: 'Total', align: 'right' },
      ],
      rows,
    },
    totals,
    words: moneyWords(so.total, so.currency),
    sections,
    signatures: [
      { role: 'Authorised by (Seller)', name: so.salesperson || undefined },
      { role: 'Accepted by (Customer)' },
    ],
    fileName: `${fileBase} ${so.soNumber}.pdf`,
  };
}
