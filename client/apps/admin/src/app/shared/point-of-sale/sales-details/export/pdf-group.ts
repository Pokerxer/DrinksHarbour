import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { GROUP_EXPORT_COLS } from '../constants';
import type { GroupRow, GroupExportCol, PdfMeta } from '../types';
import { getGroupCell } from './csv';
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

export function exportGroupedPdf(
  rows: GroupRow[],
  groupLabel: string,
  hasCost: boolean,
  meta: PdfMeta,
  selectedCols: Set<GroupExportCol>
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const MARGIN = 12;
  const AVAIL = pageW - 2 * MARGIN;

  const defs = GROUP_EXPORT_COLS.filter(
    (c) => selectedCols.has(c.key) && (hasCost || !c.costOnly)
  );

  const totalBaseW = defs.reduce((s, c) => s + c.pdfW, 0);
  const scale = AVAIL / totalBaseW;
  const colStyles: Record<number, object> = {};
  defs.forEach((c, i) => {
    colStyles[i] = {
      halign: c.pdfAlign,
      cellWidth: +(c.pdfW * scale).toFixed(1),
    };
  });

  const revIdx = defs.findIndex((c) => c.key === 'revenue');
  const discIdx = defs.findIndex((c) => c.key === 'discount');
  const profitIdx = defs.findIndex((c) => c.key === 'profit');

  const headers = defs.map((c) => (c.key === 'key' ? groupLabel : c.label));
  const body = rows.map((r) => defs.map((c) => getGroupCell(r, c.key, 'pdf')));

  const totalsRow = defs.map((c) => {
    switch (c.key) {
      case 'key':
        return `${rows.length} groups`;
      case 'qty':
        return rows.reduce((s, r) => s + r.qty, 0).toLocaleString();
      case 'gross':
        return rows.reduce((s, r) => s + r.gross, 0).toFixed(2);
      case 'discount':
        return rows.reduce((s, r) => s + r.discount, 0).toFixed(2);
      case 'revenue':
        return rows.reduce((s, r) => s + r.revenue, 0).toFixed(2);
      case 'profit':
        return rows.reduce((s, r) => s + r.profit, 0).toFixed(2);
      case 'share':
        return '100%';
      case 'lineCount':
        return rows.reduce((s, r) => s + r.lineCount, 0).toLocaleString();
      case 'orderCount':
        return rows.reduce((s, r) => s + r.orderCount, 0).toLocaleString();
      default:
        return '';
    }
  });

  const startY = drawPdf1Header(
    doc,
    `SALES — BY ${groupLabel.toUpperCase()}`,
    `${rows.length.toLocaleString()} groups`,
    meta,
    pageW
  );

  autoTable(doc, {
    head: [headers],
    body,
    foot: [totalsRow],
    startY,
    margin: { left: MARGIN, right: MARGIN, bottom: 14, top: 10 },
    styles: {
      fontSize: 8,
      cellPadding: { top: 2.2, bottom: 2.2, left: 2.5, right: 2.5 },
      overflow: 'ellipsize',
      textColor: GRAY_DARK,
      font: 'helvetica',
    },
    headStyles: {
      fillColor: BRAND_RGB,
      textColor: WHITE_RGB,
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    footStyles: {
      fillColor: GRAY_LIGHT,
      textColor: GRAY_DARK,
      fontStyle: 'bold',
    },
    alternateRowStyles: { fillColor: RED_PALE },
    columnStyles: colStyles,
    showHead: 'everyPage',
    showFoot: 'lastPage',
    willDrawPage: (data) => {
      if (data.pageNumber > 1)
        drawPdfMiniHeader(doc, `Sales — by ${groupLabel}`, pageW, meta.storeName);
    },
    didParseCell: (data) => {
      if (data.section === 'foot') {
        if (revIdx >= 0 && data.column.index === revIdx)
          data.cell.styles.textColor = BRAND_RGB;
        return;
      }
      if (data.section !== 'body') return;
      const r = rows[data.row.index];
      if (!r) return;
      if (revIdx >= 0 && data.column.index === revIdx) {
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
    null,
    meta,
    tableEndY,
    pageW,
    MARGIN,
    `Sales — by ${groupLabel}`
  );
  addPdfPageFooters(doc, `Sales Report — by ${groupLabel}`, meta.storeName);
  doc.save(`sales-grouped-${new Date().toISOString().slice(0, 10)}.pdf`);
}