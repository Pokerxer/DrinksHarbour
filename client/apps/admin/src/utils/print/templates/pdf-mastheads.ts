import type jsPDF from 'jspdf';
import type { DocAlign, DocumentModel } from '../doc-model';
import type { DocumentTemplate } from './registry';
import { drawCollectionMasthead } from './pdf-collection-mastheads';
import { CW, M, W, box, color, fittedSingle, line } from './pdf-layout';

export function drawLayoutMasthead(
  doc: jsPDF,
  m: DocumentModel,
  t: DocumentTemplate
) {
  const right = W - M;
  const half = CW / 2;
  const title = m.docTitle.toUpperCase();
  const status = m.status?.replaceAll('_', ' ').toUpperCase();
  const address = [m.head?.address, m.head?.city].filter(Boolean).join(', ');
  const contact = [m.head?.email, m.head?.phone].filter(Boolean).join(' | ');
  const context = [m.department, status].filter(Boolean).join('  /  ');
  const paper = '#ffffff';
  const muted = '#4b5563';

  function text(
    value: string,
    x: number,
    y: number,
    width: number,
    size: number,
    ink: string,
    style: 'normal' | 'bold' = 'normal',
    align: DocAlign = 'left'
  ) {
    doc.setFont(t.font, style);
    color(doc, ink);
    fittedSingle(
      doc,
      value.replace(/\s+/g, ' ').trim(),
      x,
      y,
      width,
      size,
      align
    );
  }

  function issuer(
    x: number,
    y: number,
    width: number,
    align: DocAlign = 'left',
    ink = t.accent
  ) {
    text(m.companyName, x, y, width, 15, ink, 'bold', align);
    text(address, x, y + 14, width, 8, ink, 'normal', align);
    text(contact, x, y + 26, width, 8, ink, 'normal', align);
  }

  if (t.collection) {
    drawCollectionMasthead(doc, t, { text, issuer, title, number: m.number, context, status, department: m.department });
    return;
  }

  switch (t.layout) {
    case 'letterhead':
      box(doc, M, 26, 38, 3, t.accent);
      issuer(M, 50, CW);
      line(doc, M, 89, CW, t.secondary);
      text(title, M, 119, half, 23, t.accent, 'bold');
      text(m.number, right, 110, half, 12, t.accent, 'bold', 'right');
      text(context, right, 128, half, 8, muted, 'normal', 'right');
      break;

    case 'centred':
      issuer(W / 2, 38, CW, 'center');
      line(doc, M, 76, CW, t.secondary);
      text(title, W / 2, 105, CW, 24, t.accent, 'bold', 'center');
      text(m.number, W / 2, 121, CW, 11, t.accent, 'bold', 'center');
      text(context, W / 2, 135, CW, 8, muted, 'normal', 'center');
      break;

    case 'split-panel':
      box(doc, M, 30, half + 35, 81, t.wash);
      box(doc, M + half + 43, 30, half - 43, 81, t.accent);
      issuer(M + 14, 54, half + 7);
      text(m.department, M + 14, 99, half + 7, 8, muted);
      text(title, right - 14, 52, half - 71, 10, paper, 'bold', 'right');
      text(m.number, right - 14, 74, half - 71, 15, paper, 'bold', 'right');
      text(
        status ?? '',
        right - 14,
        96,
        half - 71,
        8,
        paper,
        'normal',
        'right'
      );
      break;

    case 'balance-first':
      text(title, M, 52, half, 26, t.accent, 'bold');
      text(m.number, M, 71, half, 12, t.accent);
      text(context, M, 87, half, 8, muted);
      issuer(right, 45, half - 16, 'right');
      line(doc, M, 101, CW, t.secondary, 1);
      break;

    case 'ruled-register':
      line(doc, M, 29, CW, t.accent, 1.4);
      issuer(M, 51, half + 32);
      text(title, right, 51, half - 44, 11, t.accent, 'bold', 'right');
      text(m.number, right, 69, half - 44, 11, t.accent, 'normal', 'right');
      line(doc, M, 86, CW, t.secondary);
      text(context, M + 6, 102, CW - 12, 8, muted);
      line(doc, M, 112, CW, t.accent, 1.4);
      break;

    case 'remittance':
      issuer(right, 40, CW, 'right');
      box(doc, M, 82, CW, 48, t.wash);
      box(doc, M, 82, 4, 48, t.accent);
      text(title, M + 16, 110, half, 17, t.accent, 'bold');
      text(m.number, right - 14, 101, half - 30, 12, t.accent, 'bold', 'right');
      text(context, right - 14, 118, half - 30, 8, muted, 'normal', 'right');
      break;

    case 'folio':
      box(doc, M, 28, 4, 92, t.accent);
      text(m.department, M + 16, 39, half, 8, muted);
      text(title, M + 16, 76, half + 10, 33, t.accent, 'bold');
      text(
        [m.number, status].filter(Boolean).join('  /  '),
        M + 16,
        102,
        half + 10,
        11,
        t.accent
      );
      issuer(right, 72, half - 42, 'right');
      break;

    case 'boxed-statement':
      box(doc, M, 28, CW, 85, paper, t.accent);
      box(doc, M + half + 8, 28, half - 8, 85, t.wash, t.accent);
      issuer(M + 14, 54, half - 20);
      text(m.department, M + 14, 101, half - 20, 8, muted);
      text(title, right - 14, 50, half - 36, 10, t.accent, 'bold', 'right');
      text(m.number, right - 14, 74, half - 36, 17, t.accent, 'bold', 'right');
      text(
        status ?? '',
        right - 14,
        99,
        half - 36,
        8,
        muted,
        'normal',
        'right'
      );
      break;

    case 'banner':
      box(doc, 0, 0, W, 73, t.accent);
      box(doc, 0, 73, W, 71, t.wash);
      text(title, M, 49, half, 25, paper, 'bold');
      text(m.number, right, 39, half, 13, paper, 'bold', 'right');
      text(status ?? '', right, 57, half, 8, paper, 'normal', 'right');
      issuer(M, 98, half + 50);
      text(m.department, right, 99, half - 65, 8, t.accent, 'normal', 'right');
      break;

    case 'compact':
      issuer(M, 33, half + 30);
      text(title, right, 32, half - 46, 12, t.accent, 'bold', 'right');
      text(m.number, right, 48, half - 46, 9, t.accent, 'bold', 'right');
      text(context, right, 61, half - 46, 7, muted, 'normal', 'right');
      line(doc, M, 73, CW, t.secondary);
      break;
  }
}
