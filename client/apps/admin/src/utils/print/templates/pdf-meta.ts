import type jsPDF from 'jspdf';
import type { DocumentTemplate } from './registry';
import { BOTTOM, CONTINUATION_TOP, CW, M, box, color } from './pdf-layout';

/** Original individual reference cards, wrapping long values instead of clipping. */
export function drawMeta(
  doc: jsPDF,
  pairs: [string, string][],
  t: DocumentTemplate,
  startY: number
) {
  if (!pairs.length) return startY;
  let y = startY;
  const count = Math.min(pairs.length, 6);
  const width = (CW - 7 * (count - 1)) / count;
  const allCards = pairs.map(([label, value]) => {
    doc.setFont(t.font, 'bold').setFontSize(6.1);
    const labels = doc.splitTextToSize(label.toUpperCase(), width - 12) as string[];
    doc.setFontSize(8.8);
    const values = doc.splitTextToSize(value, width - 12) as string[];
    return { labels, values };
  });
  if (
    allCards.some(
      (c) => 14 + c.labels.length * 8 + c.values.length * 11 > BOTTOM - CONTINUATION_TOP
    )
  )
    return undefined;
  for (let offset = 0; offset < pairs.length; offset += count) {
    const cards = allCards.slice(offset, offset + count);
    const height = Math.max(...cards.map((c) => 14 + c.labels.length * 8 + c.values.length * 11));
    if (y + height > BOTTOM) {
      doc.addPage();
      y = CONTINUATION_TOP;
    }
    cards.forEach((card, i) => {
      const x = M + i * (width + 7);
      doc.setFillColor('#f9fafb');
      doc.setDrawColor('#e5e7eb');
      doc.setLineWidth(0.5);
      doc.roundedRect(x, y, width, height, 3, 3, 'FD');
      box(doc, x + 3, y, width - 6, 2, t.accent);
      doc.setFont(t.font, 'bold').setFontSize(6.1);
      color(doc, '#6b7280');
      doc.text(card.labels, x + 6, y + 13, { lineHeightFactor: 1.3 });
      doc.setFontSize(8.8);
      color(doc, '#111827');
      doc.text(card.values, x + 6, y + 14 + card.labels.length * 8, { lineHeightFactor: 1.25 });
    });
    y += height + 14;
  }
  return y;
}
