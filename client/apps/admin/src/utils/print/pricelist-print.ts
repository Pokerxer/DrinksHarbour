// Customer price list as a branded PDF via the shared DocumentModel pipeline —
// same renderer every other invoice in the app uses, saved directly to disk
// (no browser print dialog). Content pricing comes from the SAME engine as the
// printed HTML sheet (shared/inventory/inventory-pricelist-print), so the two
// can never disagree.

import {
  linesHaveBundlePrices,
  priceAndSortLines,
  fmtDay,
  type PricableStockLine,
  type PricelistLite,
  type PricelistPrintOptions,
} from '@/app/shared/inventory/inventory-pricelist-print';
import { COMPANY, fmtAmt } from './print-shared';
import { renderDocument } from './pdf-render';
import type { DocumentModel, DocCell } from './doc-model';

const MUTED = '#6b7280';

function todayParts(d = new Date()): {
  stamp: string;
  iso: string;
} {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return { stamp: `${y}${m}${day}`, iso: `${y}-${m}-${day}` };
}

/**
 * Build the price list as a DocumentModel. Issuer follows the HTML sheet:
 * business name, else the resolved warehouse/tenant origin, else the platform.
 * Category grouping renders as strong divider rows inside one continuous
 * table so page breaks repeat a single header.
 */
export function buildPricelistDoc(
  rows: PricableStockLine[],
  pricelist: PricelistLite | null,
  options: PricelistPrintOptions
): DocumentModel {
  const o = options;
  const currency = pricelist?.currency || 'NGN';
  const lines = priceAndSortLines(rows, pricelist, o.discountPercent ?? 0);
  const { stamp, iso } = todayParts();

  const issuerName =
    o.businessName?.trim() || o.originName?.trim() || COMPANY.name;

  const columns: DocumentModel['table']['columns'] = [
    { label: 'Product' },
    { label: 'Size' },
    ...(o.showAvailability
      ? [{ label: 'Available', align: 'right' as const }]
      : []),
    { label: 'Unit Price', align: 'right' },
    ...(linesHaveBundlePrices(lines)
      ? [
          { label: 'Bundle Price', align: 'right' as const },
          { label: 'Bundle Qty', align: 'right' as const },
        ]
      : []),
  ];

  const showBundle = linesHaveBundlePrices(lines);

  const lineCells = (l: (typeof lines)[number]): DocCell[] => {
    const cells: DocCell[] = [
      {
        text: l.productName,
        sub: o.showSku && l.sku ? l.sku : undefined,
      },
      { text: l.sizeName },
      ...(o.showAvailability
        ? [
            l.currentQuantity > 0
              ? { text: String(l.currentQuantity) }
              : { text: '—', color: MUTED },
          ]
        : []),
      {
        text: fmtAmt(l.price, currency),
        strong: true,
        sub: l.was != null ? `was ${fmtAmt(l.was, currency)}` : undefined,
      },
      ...(showBundle
        ? [
            // Tier total as the headline, per-unit underneath — same hierarchy
            // as the HTML sheet, so the two outputs cannot read differently.
            l.bundleTotal != null
              ? {
                  text: fmtAmt(l.bundleTotal, currency),
                  strong: true,
                  sub: `${fmtAmt(l.bundlePrice ?? 0, currency)} each`,
                }
              : { text: '—', color: MUTED },
            l.bundleQuantity != null
              ? { text: String(l.bundleQuantity) }
              : { text: '' },
          ]
        : []),
    ];
    return cells;
  };

  // Grouped: strong category divider rows inside the one table (count after
  // the name, Odoo-section style), each preceding its own group. Map keeps
  // insertion order, which priceAndSortLines already sorted by category.
  let tableRows: DocCell[][] = [];
  if (o.groupByCategory) {
    const groups = new Map<string, typeof lines>();
    for (const l of lines) {
      const list = groups.get(l.categoryName) ?? [];
      list.push(l);
      groups.set(l.categoryName, list);
    }
    const width = columns.length;
    // Array.from — `downlevelIteration` is off in this app, so iterating a Map
    // directly is a TS2802 build error.
    for (const [cat, catLines] of Array.from(groups.entries())) {
      tableRows.push([
        { text: `${cat.toUpperCase()} — ${catLines.length}`, strong: true },
        ...Array.from({ length: width - 1 }, () => ({ text: '' })),
      ]);
      for (const l of catLines) tableRows.push(lineCells(l));
    }
  } else {
    tableRows = lines.map(lineCells);
  }

  const notes: string[] = [];
  if (pricelist?.name) notes.push(pricelist.name);
  if (o.validUntil) notes.push(`Prices valid until ${fmtDay(o.validUntil)}.`);
  notes.push('Subject to stock availability.');

  const meta: [string, string][] = [
    ['Generated', fmtDay(iso)],
    ['Valid until', o.validUntil ? fmtDay(o.validUntil) : '—'],
    ['Items', String(lines.length)],
    [
      'Warehouses',
      (o.originWarehouseCount ?? 0) > 0 ? String(o.originWarehouseCount) : '—',
    ],
  ];

  return {
    kind: 'pricelist',
    companyName: issuerName,
    // The issuing warehouse's own address/contact. Undefined for a mixed or
    // catalogue-scoped sheet, which then falls through to the platform COMPANY
    // block in the band and footer — the correct issuer when the lines are not
    // drawn from one place.
    head: o.originHead,
    department: 'Customer Pricelist',
    docTitle: o.title,
    number: `PL-${stamp}`,
    parties: [],
    meta,
    table: { columns, rows: tableRows },
    totals: [],
    notice:
      Number(o.discountPercent) > 0
        ? {
            tone: 'info',
            title: 'Trade discount',
            body: `Prices on this sheet include a ${o.discountPercent}% trade discount, applied on top of the listed price source.`,
          }
        : undefined,
    sections: [{ title: 'Notes', body: notes.join(' ') }],
    signatures: [],
    fileName: `${
      (o.title || 'price-list')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'price-list'
    }-${iso}.pdf`,
  };
}

/** Render and trigger a browser download of the price list PDF. */
export function downloadPricelistPdf(
  rows: PricableStockLine[],
  pricelist: PricelistLite | null,
  options: PricelistPrintOptions
): void {
  const model = buildPricelistDoc(rows, pricelist, options);
  const doc = renderDocument(model);
  try {
    doc.save(model.fileName);
  } catch {
    const blob = new Blob([doc.output('arraybuffer')], {
      type: 'application/pdf',
    });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (win) win.focus();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
