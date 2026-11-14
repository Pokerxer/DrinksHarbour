import type jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { DocumentModel } from '../doc-model';
import type { DocumentTemplate } from './registry';
import { drawTable } from './pdf-table';
import { M, H, CW, BOTTOM, CONTINUATION_TOP, box, color, line } from './pdf-layout';

export function drawParties(
  doc: jsPDF,
  m: DocumentModel,
  t: DocumentTemplate,
  startY: number
): number {
  if (!m.parties.length) return startY;
  if (t.parties === 'stacked') {
    return drawTable(
      doc, t, [{ label: 'Party' }, { label: 'Details' }],
      m.parties.map((party) => [
        { text: party.heading, strong: true },
        { text: party.name, sub: party.lines?.filter(Boolean).join('\n') },
      ]),
      startY, true
    ) + 13;
  }
  const width = (CW - 12 * (m.parties.length - 1)) / m.parties.length;
  const cards = m.parties.map((p) => {
    doc.setFont(t.font, 'bold').setFontSize(6.6);
    const heading = doc.splitTextToSize(p.heading.toUpperCase(), width - 28) as string[];
    doc.setFontSize(10.5);
    const name = doc.splitTextToSize(p.name, width - 28) as string[];
    doc.setFont(t.font, 'normal').setFontSize(8);
    const details = (p.lines ?? [])
      .filter(Boolean)
      .flatMap((line) => doc.splitTextToSize(line, width - 28) as string[]);
    return { heading, name, details };
  });
  const height = Math.max(
    ...cards.map((c) => 29 + c.heading.length * 8 + c.name.length * 13 + c.details.length * 11)
  );
  let y = startY;
  // Preserve all contact information even when an unusually long party spans pages.
  if (height > BOTTOM - CONTINUATION_TOP) {
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M, top: CONTINUATION_TOP, bottom: H - BOTTOM },
      head: [m.parties.map((p) => p.heading)],
      body: [m.parties.map((p) => [p.name, ...(p.lines ?? [])].join('\n'))],
      theme: 'grid',
      styles: {
        font: t.font,
        fontSize: 8,
        cellPadding: 9,
        fillColor: t.wash,
        textColor: '#374151',
      },
      headStyles: { fillColor: t.accent },
    });
    return (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 13;
  }
  if (y + height > BOTTOM) {
    doc.addPage();
    y = CONTINUATION_TOP;
  }
  cards.forEach((card, i) => {
    const x = M + i * (width + 12);
    doc.setFillColor(t.wash);
    doc.setDrawColor('#e5e7eb');
    doc.setLineWidth(0.7);
    if (t.parties === 'cards') {
      doc.roundedRect(x, y, width, height, 4, 4, 'FD');
      box(doc, x + 0.7, y + 5, 2.6, height - 10, i % 2 ? t.secondary : t.accent);
    } else if (t.parties === 'ruled') {
      line(doc, x, y, width, t.secondary);
      line(doc, x, y + height, width, t.secondary);
    }
    const mirror = t.layout === 'centred' && i % 2 === 1;
    const textX = mirror ? x + width - 14 : x + 14;
    const align = mirror ? 'right' : 'left';
    doc.setFont(t.font, 'bold').setFontSize(6.6);
    color(doc, '#6b7280');
    doc.text(card.heading, textX, y + 16, { align });
    doc.setFontSize(10.5);
    color(doc, '#111827');
    const nameY = y + 24 + card.heading.length * 8;
    doc.text(card.name, textX, nameY, { align, lineHeightFactor: 1.2 });
    doc.setFont(t.font, 'normal').setFontSize(8);
    color(doc, '#6b7280');
    if (card.details.length)
      doc.text(card.details, textX, nameY + card.name.length * 13, { align, lineHeightFactor: 1.375 });
  });
  return y + height + 13;
}
