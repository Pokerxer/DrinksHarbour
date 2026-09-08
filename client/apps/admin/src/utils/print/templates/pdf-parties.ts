import { CONTINUATION_TOP } from './pdf-layout';
import type jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { DocumentModel } from '../doc-model';
import type { DocumentTemplate } from './registry';
import { M, H, BOTTOM, color } from './pdf-layout';
export function drawParties(doc: jsPDF, m: DocumentModel, t: DocumentTemplate, y: number): number {
  if (!m.parties.length) return y;
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M, top: CONTINUATION_TOP, bottom: H - BOTTOM },
    theme: 'plain',
    head: [
      m.parties.map(
        (p, i) => `${t.id === 'blueprint' ? `0${i + 1} / ` : ''}${p.heading.toUpperCase()}`
      ),
    ],
    body: [m.parties.map((p) => [p.name, ...(p.lines ?? []).filter(Boolean)].join('\n'))],
    styles: {
      font: t.font,
      cellPadding: 9,
      fontSize: 9,
      textColor: '#333333',
      overflow: 'linebreak',
      fillColor: t.parties === 'cards' ? t.wash : '#ffffff',
      lineColor: t.accent,
      lineWidth: t.parties === 'ruled' ? 0.4 : 0,
    },
    headStyles: { textColor: t.accent, fontStyle: 'bold', fontSize: 7 },
    tableWidth: 'auto',
    rowPageBreak: 'avoid',
  });
  color(doc, t.accent);
  return (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;
}
