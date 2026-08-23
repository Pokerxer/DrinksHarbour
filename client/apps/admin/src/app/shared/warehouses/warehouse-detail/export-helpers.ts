// app/shared/warehouses/warehouse-detail/export-helpers.ts
//
// Pure column + document builders behind the stock export (CSV / Excel / PDF).
// The shapes are unit-testable; the only impure step is XLSX.writeFile which
// triggers its own download.

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import type { Warehouse } from '@/services/warehouse.service';
import type { WarehouseStockRow } from '@/services/warehouseStock.service';
import {
  skuOf,
  productNameOf as nameOf,
  sizeLabelOf as sizeOf,
} from '../warehouse-ref-helpers';
import { availOf, statusOf, STATUS_LABEL, LOW_STOCK } from './row-utils';

export type ExportFormat = 'csv' | 'excel' | 'pdf';

export type ExportColumn = {
  key: string;
  label: string;
  value: (r: WarehouseStockRow) => string | number;
  numeric?: boolean;
};

// Richer column set than the old CSV-only export: SKU, size, the full
// zone/aisle/shelf/bin breakdown and the derived available/status fields.
export const buildExportColumns = (
  lowStock: number = LOW_STOCK
): ExportColumn[] => [
  {
    key: 'product',
    label: 'Product',
    value: (r) => nameOf(r) || 'Unnamed product',
  },
  { key: 'sku', label: 'SKU', value: (r) => String(skuOf(r) ?? '') },
  { key: 'size', label: 'Size', value: (r) => String(sizeOf(r) ?? '') },
  { key: 'zone', label: 'Zone', value: (r) => r.zone ?? '' },
  { key: 'aisle', label: 'Aisle', value: (r) => r.aisle ?? '' },
  { key: 'shelf', label: 'Shelf', value: (r) => r.shelf ?? '' },
  { key: 'bin', label: 'Bin', value: (r) => r.bin ?? '' },
  {
    key: 'onHand',
    label: 'On Hand',
    value: (r) => r.currentQuantity,
    numeric: true,
  },
  {
    key: 'reserved',
    label: 'Reserved',
    value: (r) => r.reservedQuantity,
    numeric: true,
  },
  {
    key: 'available',
    label: 'Available',
    value: (r) => availOf(r),
    numeric: true,
  },
  {
    key: 'status',
    label: 'Status',
    value: (r) => STATUS_LABEL[statusOf(r, lowStock)],
  },
];

// Index of the three numeric columns (for right-alignment in PDF/Excel).
// Column positions are fixed regardless of the low-stock threshold.
const NUMERIC_COL_INDEXES = buildExportColumns().reduce<number[]>(
  (acc, c, i) => {
    if (c.numeric) acc.push(i);
    return acc;
  },
  []
);

/** RFC-4180 CSV field escaping (quote, double-quote, CRLF). */
export const csvEscape = (v: string | number): string | number => {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export type ExportTotals = {
  onHand: number;
  reserved: number;
  available: number;
};

/** Footer totals cell per column key. */
export const totalsCellFor = (
  key: string,
  lineCount: number,
  totals: ExportTotals
): string | number => {
  if (key === 'product') return `TOTAL · ${lineCount} lines`;
  if (key === 'onHand') return totals.onHand;
  if (key === 'reserved') return totals.reserved;
  if (key === 'available') return totals.available;
  return '';
};

/** Human context note describing the active search / status filter. */
export const contextNoteOf = (filter: string, search: string): string => {
  const ctx: string[] = [];
  if (filter === 'low_out') ctx.push('Low / Out only');
  if (search.trim()) ctx.push(`Search: “${search.trim()}”`);
  return ctx.length ? ` · ${ctx.join(' · ')}` : '';
};

export const fileBaseOf = (code: string | undefined, fallbackId: string) =>
  `stock-${code ?? fallbackId}-${new Date().toISOString().slice(0, 10)}`;

const RGB_BRAND: [number, number, number] = [178, 2, 2];
const RGB_CREAM: [number, number, number] = [245, 240, 232];
const RGB_INK: [number, number, number] = [42, 36, 32];
const RGB_ALT: [number, number, number] = [250, 248, 243];

type ExportArgs = {
  format: ExportFormat;
  rows: WarehouseStockRow[];
  warehouse: Warehouse | null;
  warehouseId: string;
  filter: string;
  search: string;
  columns: ExportColumn[];
  totals: ExportTotals;
};

/** Builds the document and returns `{ blob?, filename }`; caller downloads. */
export const buildExport = ({
  format,
  rows,
  warehouse,
  warehouseId,
  filter,
  search,
  columns,
  totals,
}: ExportArgs): { blob?: Blob; filename: string } => {
  const stamp = new Date();
  const fileBase = fileBaseOf(warehouse?.code, warehouseId);
  const warehouseName = warehouse?.name ?? 'Warehouse';
  const ctxNote = contextNoteOf(filter, search);
  const lineCount = rows.length;

  if (format === 'csv') {
    const lines = [
      columns.map((c) => csvEscape(c.label)).join(','),
      ...rows.map((r) =>
        columns.map((c) => csvEscape(c.value(r))).join(',')
      ),
      columns
        .map((c) => csvEscape(totalsCellFor(c.key, lineCount, totals)))
        .join(','),
    ];
    return {
      blob: new Blob(['﻿' + lines.join('\r\n')], {
        type: 'text/csv;charset=utf-8;',
      }),
      filename: `${fileBase}.csv`,
    };
  }

  if (format === 'excel') {
    const aoa: (string | number)[][] = [
      [warehouseName],
      [`Stock on hand${ctxNote}`],
      [
        `Code: ${warehouse?.code ?? '—'}    Type: ${
          warehouse?.type?.replace('_', ' ') ?? '—'
        }`,
      ],
      [`Generated: ${stamp.toLocaleString()}`],
      [],
      columns.map((c) => c.label),
      ...rows.map((r) => columns.map((c) => c.value(r))),
      columns.map((c) => totalsCellFor(c.key, lineCount, totals)),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [
      { wch: 30 },
      { wch: 16 },
      { wch: 10 },
      { wch: 8 },
      { wch: 8 },
      { wch: 8 },
      { wch: 8 },
      { wch: 10 },
      { wch: 10 },
      { wch: 10 },
      { wch: 11 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Stock');
    // writeFile triggers its own browser download.
    XLSX.writeFile(wb, `${fileBase}.xlsx`);
    return { filename: `${fileBase}.xlsx` };
  }

  // PDF
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const M = 12;

  // Branded header bar.
  doc.setFillColor(...RGB_BRAND);
  doc.rect(0, 0, pageW, 16, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(warehouseName, M, 10);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('STOCK ON HAND', pageW / 2, 10, { align: 'center' });
  doc.text(stamp.toLocaleString('en-GB'), pageW - M, 10, { align: 'right' });

  // Meta line.
  doc.setTextColor(90, 90, 90);
  doc.setFontSize(8);
  const addr = warehouse?.address
    ? [warehouse.address.city, warehouse.address.state]
        .filter(Boolean)
        .join(', ')
    : '';
  const metaBits = [
    warehouse?.code && `Code: ${warehouse.code}`,
    warehouse?.type && `Type: ${warehouse.type.replace('_', ' ')}`,
    addr && `Location: ${addr}`,
    `${lineCount} lines${ctxNote}`,
  ]
    .filter(Boolean)
    .join('     ·     ');
  doc.text(metaBits, M, 23);

  autoTable(doc, {
    startY: 27,
    head: [columns.map((c) => c.label)],
    body: rows.map((r) => columns.map((c) => String(c.value(r)))),
    foot: [
      columns.map((c) => String(totalsCellFor(c.key, lineCount, totals))),
    ],
    styles: { fontSize: 7.5, cellPadding: 1.8, overflow: 'linebreak' },
    headStyles: { fillColor: RGB_BRAND, textColor: 255, fontStyle: 'bold' },
    footStyles: { fillColor: RGB_CREAM, textColor: RGB_INK, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: RGB_ALT },
    columnStyles: Object.fromEntries(
      NUMERIC_COL_INDEXES.map((i) => [i, { halign: 'right' as const }])
    ),
    margin: { left: M, right: M },
  });
  return { blob: doc.output('blob'), filename: `${fileBase}.pdf` };
};
