import type jsPDF from 'jspdf';
import type { DocAlign } from '../doc-model';
import type { DocumentTemplate } from './registry';
import { CW, M, W, box, line } from './pdf-layout';

interface MastheadContent {
  text(
    value: string,
    x: number,
    y: number,
    width: number,
    size: number,
    ink: string,
    style?: 'normal' | 'bold',
    align?: DocAlign
  ): void;
  issuer(
    x: number,
    y: number,
    width: number,
    align?: DocAlign,
    ink?: string
  ): void;
  title: string;
  number: string;
  context: string;
  department: string;
  status?: string;
}

export function drawCollectionMasthead(
  doc: jsPDF,
  t: DocumentTemplate,
  content: MastheadContent
) {
  const { text, issuer, title, number, context, department, status } = content;
  const right = W - M;
  const half = CW / 2;
  const paper = '#ffffff';

  switch (t.collection) {
    case 'docket':
      box(doc, right - 162, 25, 162, 88, t.wash);
      issuer(M, 46, CW - 180);
      text(title, M, 105, CW - 180, 23, t.accent, 'bold');
      text(number, right - 149, 58, 136, 13, t.accent, 'bold');
      text(department, right - 149, 80, 136, 8, t.accent);
      text(status ?? '', right - 149, 98, 136, 8, t.accent);
      line(doc, M, 117, CW, t.secondary);
      break;
    case 'panorama':
      text(title, M, 52, CW, 31, t.accent, 'bold');
      box(doc, M, 65, CW, 49, t.wash);
      issuer(M + 12, 82, half - 22);
      text(number, right - 12, 84, half - 22, 11, t.accent, 'bold', 'right');
      text(context, right - 12, 103, half - 22, 8, t.accent, 'normal', 'right');
      break;
    case 'dispatch':
      box(doc, M, 23, CW, 65, t.accent);
      issuer(M + 14, 47, half + 16, 'left', paper);
      text(title, right - 14, 43, half - 44, 12, paper, 'bold', 'right');
      text(number, right - 14, 61, half - 44, 10, paper, 'bold', 'right');
      text(context, right - 14, 76, half - 44, 7.5, paper, 'normal', 'right');
      break;
    case 'quarter':
      box(doc, M, 24, CW, 99, paper, t.secondary);
      box(doc, M + half, 24, half, 65, t.wash, t.secondary);
      line(doc, M, 89, CW, t.secondary);
      box(doc, M + half, 89, half, 34, paper, t.secondary);
      issuer(M + 12, 47, half - 24);
      text(title, M + half + 12, 64, half - 24, 20, t.accent, 'bold');
      text(number, M + 12, 111, half - 24, 11, t.accent, 'bold');
      text(context, M + half + 12, 110, half - 24, 8, t.accent);
      break;
    case 'letterpress':
      line(doc, M, 23, CW, t.accent, 1.2);
      line(doc, M, 27, CW, t.secondary);
      text(title, W / 2, 59, CW - 28, 26, t.accent, 'bold', 'center');
      text(number, W / 2, 78, CW - 28, 12, t.accent, 'normal', 'center');
      line(doc, M, 88, CW, t.secondary);
      issuer(M, 108, half + 38);
      text(context, right, 109, half - 48, 8, t.accent, 'normal', 'right');
      break;
    case 'index':
      box(doc, M, 26, CW, 29, t.wash);
      text(number, M + 10, 45, half - 20, 12, t.accent, 'bold');
      text(
        context,
        right - 10,
        44,
        half - 20,
        7.5,
        t.accent,
        'normal',
        'right'
      );
      issuer(M, 78, half + 20);
      text(title, right, 94, half - 34, 17, t.accent, 'bold', 'right');
      line(doc, M, 111, CW, t.secondary);
      break;
    case 'column':
      box(doc, M + half - 22, 25, 2, 99, t.secondary);
      text(title, M, 58, half - 36, 23, t.accent, 'bold');
      text(number, M, 85, half - 36, 12, t.accent);
      text(context, M, 107, half - 36, 8, t.accent);
      issuer(right, 70, half + 4, 'right');
      break;
    case 'outline':
      issuer(M, 38, half + 35);
      text(context, right, 44, half - 48, 8, t.accent, 'normal', 'right');
      box(doc, M, 78, CW, 46, paper, t.accent);
      text(title, M + 12, 106, half + 8, 20, t.accent, 'bold');
      text(number, right - 12, 105, half - 32, 12, t.accent, 'bold', 'right');
      break;
    case 'proof':
      text(title, M, 40, half + 22, 19, t.accent, 'bold');
      text(number, right, 40, half - 37, 11, t.accent, 'bold', 'right');
      line(doc, M, 52, CW, t.accent, 1.5);
      issuer(M, 73, half + 30);
      text(context, right, 73, half - 44, 8, t.accent, 'normal', 'right');
      break;
    case 'field-report':
      box(doc, 0, 0, W, 10, t.accent);
      text(title, M, 39, half + 8, 17, t.accent, 'bold');
      text(number, right, 37, half - 22, 11, t.accent, 'bold', 'right');
      line(doc, M, 50, CW, t.secondary);
      issuer(M, 83, half + 40);
      text(context, right, 86, half - 54, 8, t.accent, 'normal', 'right');
      line(doc, M, 119, CW, t.secondary);
      break;
  }
}
