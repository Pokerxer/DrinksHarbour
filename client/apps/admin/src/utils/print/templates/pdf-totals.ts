import type jsPDF from 'jspdf';
import type { DocTotalRow } from '../doc-model';
import type { DocumentTemplate } from './registry';
import { W, M, BOTTOM, CONTINUATION_TOP, box, color } from './pdf-layout';

/** Rounded, right-aligned summary from the original invoice design. */
export function drawTotals(
  doc: jsPDF,
  rows: DocTotalRow[],
  t: DocumentTemplate,
  startY: number
): number {
  const width = 268,
    x = W - M - width;
  const entries = rows.flatMap((row) => {
    const grand = row.variant === 'grand';
    const size = grand ? 10 : 8.6;
    doc.setFont(t.font, 'bold').setFontSize(size);
    const label = doc.splitTextToSize(grand ? row.label.toUpperCase() : row.label, 100) as string[];
    const value = doc.splitTextToSize(row.value, width - 139) as string[];
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
    doc.roundedRect(x, y, width, height, 4, 4, 'FD');
    let rowY = y + 6;
    for (const entry of entries.slice(offset, end)) {
      const grand = entry.row.variant === 'grand';
      if (grand) box(doc, x + 0.7, rowY, width - 1.4, entry.height, t.accent);
      color(doc, grand ? '#ffffff' : (entry.row.color ?? '#6b7280'));
      doc
        .setFont(t.font, grand || entry.row.variant === 'strong' ? 'bold' : 'normal')
        .setFontSize(entry.size);
      if (entry.label.length)
        doc.text(entry.label, x + 13, rowY + 13, { lineHeightFactor: 12 / entry.size });
      doc.setFont(t.font, 'bold');
      if (entry.value.length)
        doc.text(entry.value, W - M - 13, rowY + 13, {
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
