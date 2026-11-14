import type jsPDF from 'jspdf';
import type { DocCell, DocColumn } from '../doc-model';
import type { DocumentTemplate } from './registry';
import { CW } from './pdf-layout';

/** Keep identifying text readable and keep large amounts together on dense grids. */
export function measureTableColumns(
  doc: jsPDF,
  template: DocumentTemplate,
  columns: DocColumn[],
  rows: DocCell[][],
  compact: boolean
): number[] {
  const padding = 2 * (compact ? 4 : template.density) + 2;
  doc.setFont(template.font, 'bold').setFontSize(compact ? 8 : 8.4);
  return columns.map((column, index) => {
    const minimum = index === 0 ? 96 : column.align === 'right' ? 36 : 42;
    if (column.align !== 'right') return minimum;
    return rows.reduce((width, row) => {
      const value = row[index]?.text ?? '';
      return Math.max(
        width,
        Math.min(CW * 0.4, doc.getTextWidth(value) + padding)
      );
    }, minimum);
  });
}

/** Continue the remaining columns on fresh pages, with the first column repeated. */
export function splitTableColumns(
  widths: number[],
  columns: DocColumn[]
): number[][] {
  if (widths.reduce((sum, width) => sum + width, 0) <= CW) {
    return [widths.map((_, index) => index)];
  }
  const repeated = [
    0,
    ...columns.flatMap((column, index) =>
      index && column.repeatOnContinuation ? [index] : []
    ),
  ];
  const repeatedSet = new Set(repeated);
  const repeatedWidth = repeated.reduce((sum, index) => sum + widths[index], 0);
  const groups: number[][] = [];
  let group = [...repeated];
  let used = repeatedWidth;
  for (let i = 1; i < widths.length; i++) {
    if (repeatedSet.has(i)) continue;
    if (used + widths[i] > CW && group.length > repeated.length) {
      groups.push(group.sort((left, right) => left - right));
      group = [...repeated];
      used = repeatedWidth;
    }
    group.push(i);
    used += widths[i];
  }
  groups.push(group.sort((left, right) => left - right));
  return groups;
}
