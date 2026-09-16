import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { LINE_EXPORT_COLS } from '../constants';
import type { LineRow, LineExportCol, PdfMeta } from '../types';
import { getLineCell } from './csv';
import {
  BRAND_RGB,
  GRAY_DARK,
  GRAY_LIGHT,
  ORANGE_RGB,
  RED_PALE,
  TEAL_RGB,
  WHITE_RGB,
  drawPdf1Header,
  drawPdfMiniHeader,
  addPdfPageFooters,
  drawPdfSummarySection,
} from './pdf-utils';

export function exportLinePdf(
  rows: LineRow[],
  hasCost: boolean,
  meta: PdfMeta,
  selectedCols: Set<LineExportCol>
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const MARGIN = 12;
  const AVAIL = pageW - 2 * MARGIN;

  const hasCategory = rows.some((r) => !!r.category);
  const hasSubcategory = rows.some((r) => !!r.subcategory);
  const hasBrand = rows.some((r) => !!r.brand);

  const defs = LINE_EXPORT_COLS.filter((c) => {
    if (!selectedCols.has(c.key)) return false;
    if (c.costOnly && !hasCost) return false;
    if (c.key === 'category' && !hasCategory) return false;
    if (c.key === 'subcategory' && !hasSubcategory) return false;
    if (c.key === 'brand' && !hasBrand) return false;
    return true;
  });

  const totalBaseW = defs.reduce((s, c) => s + c.pdfW, 0);
  const scale = AVAIL / totalBaseW;
  const colStyles: Record<number, object> = {};
  defs.forEach((c, i) => {
    colStyles[i] = {
      halign: c.pdfAlign,
      cellWidth: +(c.pdfW * scale).toFixed(1),
    };
  });

  const netIdx = defs.findIndex((c) => c.key === 'net');
  const discIdx = defs.findIndex((c) => c.key === 'discount');
  const profitIdx = defs.findIndex((c) => c.key === 'profit');

  const body = rows.map((r) => defs.map((c) => getLineCell(r, c.key, 'pdf')));

  const totalsRow = defs.map((c) => {
    switch (c.key) {
      case 'date':
        return `${rows.length.toLocaleString()} lines`;
      case 'qty':
        return rows.reduce((s, r) => s + r.qty, 0).toLocaleString();
      case 'gross':
        return rows.reduce((s, r) => s + r.gross, 0).toFixed(2);
      case 'discount':
        return rows.reduce((s, r) => s + r.discount, 0).toFixed(2);
      case 'net':
        return rows.reduce((s, r) => s + r.subtotal, 0).toFixed(2);
      case 'cost':
        return rows.reduce((s, r) => s + r.costPrice, 0).toFixed(2);
      case 'profit':
        return rows.reduce((s, r) => s + r.profit, 0).toFixed(2);
      default:
        return '';
    }
  });

  const startY = drawPdf1Header(
    doc,
    'SALES DETAILS',
    `${rows.length.toLocaleString()} line items`,
    meta,
    pageW
  );

  autoTable(doc, {
    head: [defs.map((c) => c.label)],
    body,
    foot: [totalsRow],
    startY,
    margin: { left: MARGIN, right: MARGIN, bottom: 14, top: 10 },
    styles: {
      fontSize: 6.5,
      cellPadding: { top: 1.8, bottom: 1.8, left: 2, right: 2 },
      overflow: 'ellipsize',
      textColor: GRAY_DARK,
      font: 'helvetica',
    },
    headStyles: {
      fillColor: BRAND_RGB,
      textColor: WHITE_RGB,
      fontStyle: 'bold',
      fontSize: 7,
    },
    footStyles: {
      fillColor: GRAY_LIGHT,
      textColor: GRAY_DARK,
      fontStyle: 'bold',
      fontSize: 6.5,
    },
    alternateRowStyles: { fillColor: RED_PALE },
    columnStyles: colStyles,
    showHead: 'everyPage',
    showFoot: 'lastPage',
    willDrawPage: (data) => {
      if (data.pageNumber > 1)
        drawPdfMiniHeader(doc, 'Sales Details', pageW, meta.storeName);
    },
    didParseCell: (data) => {
      if (data.section === 'foot') {
        if (netIdx >= 0 && data.column.index === netIdx)
          data.cell.styles.textColor = BRAND_RGB;
        return;
      }
      if (data.section !== 'body') return;
      const r = rows[data.row.index];
      if (!r) return;
      if (r.isVoided) {
        data.cell.styles.textColor = [180, 180, 180] as [
          number,
          number,
          number,
        ];
        data.cell.styles.fontStyle = 'italic';
        return;
      }
      if (netIdx >= 0 && data.column.index === netIdx) {
        data.cell.styles.textColor = BRAND_RGB;
        data.cell.styles.fontStyle = 'bold';
      } else if (
        discIdx >= 0 &&
        data.column.index === discIdx &&
        r.discount > 0
      )
        data.cell.styles.textColor = ORANGE_RGB;
      else if (
        profitIdx >= 0 &&
        data.column.index === profitIdx &&
        r.profit > 0
      )
        data.cell.styles.textColor = TEAL_RGB;
    },
  });

  const tableEndY = (doc as any).lastAutoTable?.finalY ?? startY + 100;
  drawPdfSummarySection(
    doc,
    rows,
    meta,
    tableEndY,
    pageW,
    MARGIN,
    'Sales Details'
  );
  addPdfPageFooters(doc, 'Sales Details Report', meta.storeName);
  doc.save(`sales-details-${new Date().toISOString().slice(0, 10)}.pdf`);
}