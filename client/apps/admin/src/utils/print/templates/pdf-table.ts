import { CONTINUATION_TOP } from './pdf-layout';
import type jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { DocCell, DocColumn } from '../doc-model';
import type { DocumentTemplate } from './registry';
import { hexToRgb } from '../pdf-theme';
import { BOTTOM, H, M } from './pdf-layout';
export function drawTable(
  doc: jsPDF,
  t: DocumentTemplate,
  columns: DocColumn[],
  rows: DocCell[][],
  y: number,
  compact = false
): number {
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M, top: CONTINUATION_TOP, bottom: H - BOTTOM },
    head: [columns.map((c) => c.label)],
    body: rows.map((row) => row.map((c) => (c.sub ? `${c.text}\n${c.sub}` : c.text))),
    theme: t.table,
    rowPageBreak: 'avoid',
    styles: {
      font: t.font,
      fontSize: compact ? 8 : 8.4,
      cellPadding: compact ? 4 : t.density,
      textColor: '#30343b',
      lineColor: '#dedede',
      lineWidth: t.table === 'grid' ? 0.4 : 0,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: hexToRgb(t.table === 'plain' ? t.wash : t.accent),
      textColor: hexToRgb(t.table === 'plain' ? t.accent : '#ffffff'),
      fontStyle: 'bold',
    },
    alternateRowStyles: { fillColor: hexToRgb(t.table === 'striped' ? t.wash : '#ffffff') },
    columnStyles: Object.fromEntries(columns.map((c, i) => [i, { halign: c.align ?? 'left' }])),
    didParseCell(data) {
      if (data.section !== 'body') return;
      const cell = rows[data.row.index]?.[data.column.index];
      if (cell?.strong) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = hexToRgb(t.wash);
      }
      if (cell?.color) data.cell.styles.textColor = hexToRgb(cell.color);
    },
  });
  return (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
}
