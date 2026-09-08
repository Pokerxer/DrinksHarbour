import { CONTINUATION_TOP } from './pdf-layout';
import type jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { DocTotalRow } from '../doc-model';
import type { DocumentTemplate } from './registry';
import { CW, W, M, H, BOTTOM } from './pdf-layout';
export function drawTotals(
  doc: jsPDF,
  rows: DocTotalRow[],
  t: DocumentTemplate,
  y: number
): number {
  const width = t.id === 'ledger' ? CW : t.id === 'axis' ? 320 : 290;
  autoTable(doc, {
    startY: y,
    margin: { left: W - M - width, right: M, top: CONTINUATION_TOP, bottom: H - BOTTOM },
    tableWidth: width,
    theme: 'plain',
    rowPageBreak: 'avoid',
    body: rows.map((row) => [row.label, row.value]),
    styles: {
      font: t.font,
      fontSize: 9,
      cellPadding: 7,
      textColor: '#374151',
      overflow: 'linebreak',
      lineWidth: t.totals === 'frame' ? 0.5 : 0,
      lineColor: t.secondary,
      fillColor: t.totals === 'frame' ? t.wash : '#ffffff',
    },
    columnStyles: { 0: { cellWidth: width * 0.5 }, 1: { halign: 'right', cellWidth: width * 0.5 } },
    didParseCell(data) {
      const row = rows[data.row.index];
      if (!row) return;
      if (row.color) data.cell.styles.textColor = row.color;
      if (row.variant === 'strong' || row.variant === 'grand') data.cell.styles.fontStyle = 'bold';
      if (row.variant === 'grand') {
        data.cell.styles.fontSize = 11;
        data.cell.styles.cellPadding = 9;
        if (t.totals === 'bar') {
          data.cell.styles.fillColor = t.accent;
          data.cell.styles.textColor = '#ffffff';
        } else {
          data.cell.styles.textColor = t.accent;
          data.cell.styles.lineWidth = {
            top: 1,
            bottom: t.totals === 'frame' ? 1 : 0,
            left: 0,
            right: 0,
          };
          data.cell.styles.lineColor = t.secondary;
        }
      }
    },
  });
  return (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
}
