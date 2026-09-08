import type jsPDF from 'jspdf';
import type { DocumentModel } from '../doc-model';
import type { DocumentTemplate } from './registry';
import { hexToRgb } from '../pdf-theme';
export const W = 595.28,
  H = 841.89,
  M = 40,
  CW = W - 2 * M,
  BOTTOM = H - 50;
export function color(doc: jsPDF, hex: string) {
  doc.setTextColor(...hexToRgb(hex));
}
export function box(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  border?: string
) {
  doc.setFillColor(...hexToRgb(fill));
  doc.setDrawColor(...hexToRgb(border ?? fill));
  doc.setLineWidth(0.6);
  doc.rect(x, y, w, h, border ? 'FD' : 'F');
}
export function line(doc: jsPDF, x: number, y: number, w: number, hex: string, width = 0.6) {
  doc.setDrawColor(...hexToRgb(hex));
  doc.setLineWidth(width);
  doc.line(x, y, x + w, y);
}
function fitted(
  doc: jsPDF,
  value: string,
  x: number,
  y: number,
  width: number,
  size: number,
  align: 'left' | 'center' | 'right' = 'left'
) {
  doc.setFontSize(size);
  while (doc.getTextWidth(value) > width && size > 5) doc.setFontSize((size -= 0.25));
  const lines = doc.splitTextToSize(value, width) as string[];
  doc.text(lines.slice(0, 2), x, y, { align });
}
export function drawHeader(doc: jsPDF, m: DocumentModel, t: DocumentTemplate) {
  const h = t.headerHeight;
  const issuer = m.companyName;
  const contact = [m.head?.email, m.head?.phone].filter(Boolean).join(' | ');
  const address = [m.head?.address, m.head?.city].filter(Boolean).join(', ');
  doc.setFont(t.font, 'bold');
  if (t.id === 'classic' || t.id === 'signature') {
    box(doc, 0, 0, W, h - 4, t.accent);
    if (t.id === 'classic') {
      box(doc, W * 0.58, 0, W * 0.42, h - 4, '#620202');
      doc.setFillColor(...hexToRgb('#620202'));
      doc.triangle(W * 0.58 - 28, h - 4, W * 0.58, 0, W * 0.58, h - 4, 'F');
    } else {
      line(doc, M, 18, CW, t.secondary, 1);
      box(doc, W - M - 195, 30, 195, 63, t.accent, t.secondary);
    }
    color(doc, '#ffffff');
    fitted(doc, issuer, M, 40, 250, 19);
    doc.setFont(t.font, 'normal');
    fitted(doc, address, M, 59, 245, 8);
    fitted(doc, contact, M, 72, 245, 8);
    color(doc, t.secondary);
    fitted(doc, m.department, M, 91, 240, 8);
    color(doc, '#ffffff');
    doc.setFont(t.font, 'bold');
    fitted(doc, m.docTitle.toUpperCase(), W - M - 12, 45, 183, 10, 'right');
    fitted(doc, m.number, W - M - 12, 68, 183, 17, 'right');
    fitted(
      doc,
      (m.status ?? '').replaceAll('_', ' ').toUpperCase(),
      W - M - 12,
      85,
      180,
      8,
      'right'
    );
    line(doc, 0, h - 3, W, t.secondary, 2);
  } else if (t.id === 'atelier') {
    color(doc, t.accent);
    fitted(doc, issuer, W / 2, 38, CW, 25, 'center');
    doc.setFont(t.font, 'normal');
    fitted(doc, address, W / 2, 55, CW, 9, 'center');
    fitted(doc, contact, W / 2, 69, CW, 8, 'center');
    line(doc, W / 2 - 70, 81, 140, t.secondary);
    doc.setFont(t.font, 'bold');
    fitted(doc, m.docTitle, W / 2, 102, CW, 16, 'center');
    fitted(doc, `${m.number}  |  ${m.status ?? m.department}`, W / 2, 118, CW, 8, 'center');
  } else if (t.id === 'axis') {
    box(doc, M, 16, 152, h - 22, t.accent);
    color(doc, '#ffffff');
    fitted(doc, m.docTitle.toUpperCase(), M + 12, 40, 126, 10);
    fitted(doc, m.number, M + 12, 65, 126, 15);
    fitted(doc, m.status ?? m.department, M + 12, 89, 126, 8);
    color(doc, t.accent);
    fitted(doc, issuer, 212, 42, W - M - 212, 22);
    doc.setFont(t.font, 'normal');
    fitted(doc, address, 212, 63, W - M - 212, 9);
    fitted(doc, contact, 212, 80, W - M - 212, 8);
    line(doc, 212, 100, 70, t.secondary, 4);
  } else if (t.id === 'blueprint') {
    box(doc, M, 18, CW * 0.59, 78, '#ffffff', t.accent);
    box(doc, M + CW * 0.59 + 8, 18, CW * 0.41 - 8, 78, t.wash, t.accent);
    color(doc, t.accent);
    fitted(doc, issuer, M + 12, 40, CW * 0.59 - 24, 18);
    doc.setFont(t.font, 'normal');
    fitted(doc, address, M + 12, 59, CW * 0.59 - 24, 8);
    fitted(doc, contact, M + 12, 75, CW * 0.59 - 24, 8);
    doc.setFont(t.font, 'bold');
    fitted(doc, m.docTitle, W - M - 12, 38, CW * 0.41 - 30, 11, 'right');
    fitted(doc, m.number, W - M - 12, 60, CW * 0.41 - 30, 15, 'right');
    fitted(doc, m.status ?? '', W - M - 12, 79, CW * 0.41 - 30, 8, 'right');
  } else {
    if (t.id === 'modern') box(doc, 0, 0, 9, h, t.accent);
    if (t.id === 'editorial') {
      line(doc, M, 17, CW, t.accent, 2);
      line(doc, M, 22, CW, t.accent);
    }
    const top = t.id === 'ledger' ? 28 : 45;
    color(doc, t.accent);
    fitted(doc, issuer, M, top, CW * 0.54, t.id === 'ledger' ? 15 : 24);
    doc.setFont(t.font, 'normal');
    fitted(doc, address, M, top + 16, CW * 0.54, 8);
    fitted(doc, contact, M, top + 29, CW * 0.54, 8);
    doc.setFont(t.font, 'bold');
    fitted(
      doc,
      m.docTitle.toUpperCase(),
      W - M,
      top,
      CW * 0.42,
      t.id === 'modern' ? 18 : 11,
      'right'
    );
    fitted(doc, m.number, W - M, top + 20, CW * 0.42, 12, 'right');
    fitted(doc, m.status ?? m.department, W - M, top + 34, CW * 0.42, 8, 'right');
    line(doc, M, h - 5, CW, t.accent, t.id === 'ledger' ? 1 : 0.6);
  }
}
export function drawFooter(
  doc: jsPDF,
  m: DocumentModel,
  t: DocumentTemplate,
  page: number,
  total: number
) {
  line(doc, M, H - 35, CW, t.secondary);
  doc.setFont(t.font, 'normal');
  color(doc, '#666666');
  fitted(doc, `${m.companyName} | ${m.number}`, M, H - 21, CW - 90, 7);
  fitted(doc, `${page} / ${total}`, W - M, H - 21, 70, 7, 'right');
}

export const CONTINUATION_TOP = 78;
export function drawContinuationHeader(doc: jsPDF, m: DocumentModel, t: DocumentTemplate) {
  color(doc, t.accent);
  doc.setFont(t.font, 'bold');
  fitted(doc, m.companyName, M, 30, CW * 0.55, 13);
  fitted(doc, `${m.docTitle} | ${m.number}`, W - M, 30, CW * 0.42, 9, 'right');
  line(doc, M, 52, CW, t.secondary);
}
