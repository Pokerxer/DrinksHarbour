import { CONTINUATION_TOP } from './pdf-layout';
import type jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { DocCell, DocColumn } from '../doc-model';
import type { DocumentTemplate } from './registry';
import { hexToRgb } from '../pdf-theme';
import { BOTTOM, H, M } from './pdf-layout';
import { measureTableColumns, splitTableColumns } from './pdf-table-widths';
export function drawTable(
  doc: jsPDF,
  t: DocumentTemplate,
  columns: DocColumn[],
  rows: DocCell[][],
  y: number,
  compact = false
): number {
  if (!columns.length) return y;
  // The existing auto-fit works for standard tables. Reserve readable widths
  // for dense tables, including stock valuation and multi-tier price lists.
  const widths = columns.length >= 7 ? measureTableColumns(doc, t, columns, rows, compact) : [];
  if (!widths.length) return drawTablePage(doc, t, columns, rows, y, compact, widths);

  for (const [index, group] of splitTableColumns(widths, columns).entries()) {
    if (index) {
      doc.addPage();
      y = CONTINUATION_TOP;
    }
    y = drawTablePage(
      doc, t, group.map((i) => columns[i]),
      rows.map((row) => group.map((i) => row[i] ?? { text: '' })),
      y, compact, group.map((i) => widths[i])
    );
  }
  return y;
}

function drawTablePage(
  doc: jsPDF,
  t: DocumentTemplate,
  columns: DocColumn[],
  rows: DocCell[][],
  y: number,
  compact: boolean,
  minWidths: number[]
): number {
  const openHeader = t.table === 'plain';
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
      fillColor: hexToRgb(compact ? '#f3f4f6' : openHeader ? t.wash : t.accent),
      textColor: hexToRgb(compact ? '#6b7280' : openHeader ? t.accent : '#ffffff'),
      fontStyle: 'bold',
      fontSize: compact ? 6.6 : 7.2,
      cellPadding: compact ? 4 : { top: 7, bottom: 7, left: t.density, right: t.density },
    },
    alternateRowStyles: openHeader ? {} : { fillColor: hexToRgb('#f9fafb') },
    columnStyles: Object.fromEntries(columns.map((c, i) => [i, { halign: c.align ?? 'left' }])),
    willDrawCell(data) {
      if (data.section !== 'body' || data.row.spansMultiplePages) return;
      const cell = rows[data.row.index]?.[data.column.index];
      if (!cell?.sub) return;
      doc.setFont(t.font, cell.strong ? 'bold' : 'normal').setFontSize(data.cell.styles.fontSize);
      data.cell.text = doc.splitTextToSize(
        cell.text,
        data.cell.width - data.cell.padding('left') - data.cell.padding('right') + 1
      );
    },
    didDrawCell(data) {
      if (data.section === 'body' && openHeader) {
        const { x, y, width, height } = data.cell;
        doc.setDrawColor('#e5e7eb').setLineWidth(0.4).line(x, y + height, x + width, y + height);
      }
      if (data.section !== 'body' || data.row.spansMultiplePages) return;
      const cell = rows[data.row.index]?.[data.column.index];
      if (!cell?.sub) return;
      doc.setFont(t.font, 'normal').setFontSize(6.6);
      doc.setTextColor('#9ca3af');
      const width = data.cell.width - data.cell.padding('left') - data.cell.padding('right');
      const lines = doc.splitTextToSize(cell.sub, width);
      const y =
        data.cell.y +
        data.cell.padding('top') +
        data.cell.text.length * data.cell.styles.fontSize * 1.15 +
        5;
      const align = columns[data.column.index]?.align ?? 'left';
      const x =
        align === 'right'
          ? data.cell.x + data.cell.width - data.cell.padding('right')
          : align === 'center'
            ? data.cell.x + data.cell.padding('left') + width / 2
            : data.cell.x + data.cell.padding('left');
      doc.text(lines, x, y, { align });
    },
    didParseCell(data) {
      data.cell.styles.halign = columns[data.column.index]?.align ?? 'left';
      data.cell.styles.minCellWidth = minWidths[data.column.index] ?? 0;
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
