import type jsPDF from 'jspdf';
import type { DocumentModel } from '../doc-model';
import type { DocumentTemplate } from './registry';
import { hexToRgb, mix, tint, STATUS_COLORS } from '../pdf-theme';
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
/** Original 104pt masthead shared by every colour choice. */
export function drawHeader(doc: jsPDF, m: DocumentModel, t: DocumentTemplate) {
  const panel = W * 0.575;
  const ink = mix(t.accent, '#000000', 0.48);
  box(doc, 0, 0, W, 104, t.accent);
  doc.setFillColor(...ink);
  doc.triangle(panel - 30, 104, panel, 0, panel, 104, 'F');
  doc.rect(panel, 0, W - panel, 104, 'F');
  doc.setFillColor(...mix(t.accent, '#000000', 0.3));
  doc.rect(0, 104, W, 3, 'F');
  box(doc, 0, 107, W, 1.2, t.secondary);
  doc.setFont(t.font, 'bold');
  color(doc, '#ffffff');
  fitted(doc, m.companyName, M, 40, panel - M - 44, 16);
  doc.setFont(t.font, 'normal');
  doc.setTextColor(...tint(t.accent, 0.74));
  fitted(doc, [m.head?.address, m.head?.city].filter(Boolean).join(', '), M, 55, panel - M - 44, 8);
  fitted(doc, [m.head?.email, m.head?.phone].filter(Boolean).join(' | '), M, 66, panel - M - 44, 8);
  badge(doc, m.department, M, 75, t.accent, panel - M - 44, false);
  doc.setFont(t.font, 'bold');
  doc.setTextColor(...tint(t.accent, 0.65));
  fitted(doc, m.docTitle.toUpperCase(), W - M, 33, W - panel - 22, 7.4, 'right');
  color(doc, '#ffffff');
  fitted(doc, m.number, W - M, 58, W - panel - 22, 18, 'right');
  if (m.status)
    badge(
      doc,
      m.status.replaceAll('_', ' '),
      W - M,
      70,
      STATUS_COLORS[m.status] ?? '#6b7280',
      W - panel - 22,
      true
    );
}
function badge(
  doc: jsPDF,
  label: string,
  x: number,
  y: number,
  accent: string,
  maxWidth: number,
  right: boolean
) {
  const text = label.toUpperCase();
  doc.setFontSize(6.4);
  while (doc.getTextWidth(text) > maxWidth - 16 && doc.getFontSize() > 4)
    doc.setFontSize(doc.getFontSize() - 0.2);
  const width = Math.min(maxWidth, doc.getTextWidth(text) + 16);
  const left = right ? x - width : x;
  doc.setFillColor(...(right ? tint(accent, 0.88) : mix(accent, '#000000', 0.22)));
  doc.setDrawColor(...(right ? hexToRgb(accent) : tint(accent, 0.4)));
  doc.setLineWidth(0.6);
  doc.roundedRect(left, y, width, 13, 6.5, 6.5, 'FD');
  doc.setTextColor(...(right ? hexToRgb(accent) : tint(accent, 0.85)));
  doc.text(text, left + width / 2, y + 8.6, { align: 'center' });
}
export function drawFooter(
  doc: jsPDF,
  m: DocumentModel,
  t: DocumentTemplate,
  page: number,
  total: number
) {
  line(doc, M, H - 35, CW, '#e5e7eb');
  box(doc, M, H - 36.5, 28, 3, t.accent);
  doc.setFont(t.font, 'normal');
  color(doc, '#666666');
  const issuer = [m.companyName, m.head?.address, m.head?.city, m.head?.email, m.head?.phone]
    .filter(Boolean)
    .join(' | ');
  const generated = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  fitted(doc, issuer, M, H - 21, CW * 0.47, 7);
  fitted(
    doc,
    `${m.number} | Generated ${generated} | Page ${page} of ${total}`,
    W - M,
    H - 21,
    CW * 0.51,
    7,
    'right'
  );
}

export const CONTINUATION_TOP = 78;
export function drawContinuationHeader(doc: jsPDF, m: DocumentModel, t: DocumentTemplate) {
  color(doc, t.accent);
  doc.setFont(t.font, 'bold');
  fitted(doc, m.companyName, M, 30, CW * 0.55, 13);
  fitted(doc, `${m.docTitle} | ${m.number}`, W - M, 30, CW * 0.42, 9, 'right');
  line(doc, M, 52, CW, t.secondary);
}
