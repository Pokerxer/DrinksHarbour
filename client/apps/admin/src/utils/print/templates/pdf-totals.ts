import type jsPDF from 'jspdf';
import type { DocTotalRow } from '../doc-model';
import type { DocumentTemplate } from './registry';
import { W, M, CW, BOTTOM, CONTINUATION_TOP, box, color, line } from './pdf-layout';

/** Rounded, right-aligned summary from the original invoice design. */
export function drawTotals(
  doc: jsPDF,
  rows: DocTotalRow[],
  t: DocumentTemplate,
  startY: number
): number {
  const full = t.totalsPlacement === 'full' || t.totalsPlacement === 'before-items';
  const width = full ? CW : 268;
  const x = full || t.totalsPlacement === 'left' ? M : W - M - width;
  const right = x + width;
  const wrapExtra = (width - 268) / 2;
  const entries = rows.flatMap((row) => {
    const grand = row.variant === 'grand';
    const size = grand ? 10 : 8.6;
    doc.setFont(t.font, 'bold').setFontSize(size);
    // Grand totals have a wide, two-column banner. Give the label enough room
    // to keep short summaries such as "ITEMS TOTAL (1 LINE)" on one line,
    // while retaining a dedicated right-hand column for the amount.
    const labelWidth = (grand ? 120 : 100) + wrapExtra;
    const valueWidth = (grand ? 115 : 129) + wrapExtra;
    const label = doc.splitTextToSize(
      grand ? row.label.toUpperCase() : row.label,
      labelWidth
    ) as string[];
    const value = doc.splitTextToSize(row.value, valueWidth) as string[];
    // Break extreme values into continuations so no summary row can exceed a page.
    const lines = Math.max(label.length, value.length);
    return Array.from({ length: Math.ceil(lines / 40) }, (_, i) => ({
      row,
      size,
      label: label.slice(i * 40, (i + 1) * 40),
      value: value.slice(i * 40, (i + 1) * 40),
      height: Math.max(
        grand ? 27 : row.variant === 'strong' ? 19 : 16,
        Math.min(40, lines - i * 40) * 12 + 8
      ),
    }));
  });
  let y = startY,
    offset = 0;
  while (offset < entries.length) {
    if (y + entries[offset].height + 12 > BOTTOM) {
      doc.addPage();
      y = CONTINUATION_TOP;
    }
    let end = offset,
      height = 12;
    while (end < entries.length && y + height + entries[end].height <= BOTTOM)
      height += entries[end++].height;
    doc.setFillColor('#f9fafb');
    doc.setDrawColor('#e5e7eb');
    doc.setLineWidth(0.7);
    if (t.totals === 'frame') box(doc, x, y, width, height, t.wash, t.secondary);
    else if (t.totals === 'bar') doc.roundedRect(x, y, width, height, 4, 4, 'FD');
    let rowY = y + 6;
    for (const entry of entries.slice(offset, end)) {
      const grand = entry.row.variant === 'grand';
      const filled = grand && t.totals === 'bar';
      if (filled) box(doc, x + 0.7, rowY, width - 1.4, entry.height, t.accent);
      else if (grand) line(doc, x, rowY, width, t.accent, 1);
      color(doc, grand ? (filled ? '#ffffff' : t.accent) : (entry.row.color ?? '#6b7280'));
      doc
        .setFont(t.font, grand || entry.row.variant === 'strong' ? 'bold' : 'normal')
        .setFontSize(entry.size);
      if (entry.label.length)
        doc.text(entry.label, x + 13, rowY + 13, { lineHeightFactor: 12 / entry.size });
      doc.setFont(t.font, 'bold');
      if (entry.value.length)
        doc.text(entry.value, right - 13, rowY + 13, {
          align: 'right',
          lineHeightFactor: 12 / entry.size,
        });
      rowY += entry.height;
    }
    y += height;
    offset = end;
  }
  return y;
}
