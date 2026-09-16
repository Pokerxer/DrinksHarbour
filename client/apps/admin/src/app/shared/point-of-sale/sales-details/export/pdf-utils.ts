import jsPDF from 'jspdf';
import { METHOD_LABEL } from '../constants';
import { formatCurrency } from '@/app/shared/point-of-sale/utils';
import type { LineRow, PdfMeta } from '../types';

export const BRAND_RGB: [number, number, number] = [178, 2, 2];
export const GRAY_DARK: [number, number, number] = [31, 41, 55];
export const GRAY_MED: [number, number, number] = [107, 114, 128];
export const GRAY_LIGHT: [number, number, number] = [243, 244, 246];
export const TEAL_RGB: [number, number, number] = [13, 148, 136];
export const ORANGE_RGB: [number, number, number] = [217, 70, 0];
export const GREEN_RGB: [number, number, number] = [22, 101, 52];
export const RED_PALE: [number, number, number] = [254, 249, 249];
export const WHITE_RGB: [number, number, number] = [255, 255, 255];

export function drawPdf1Header(
  doc: jsPDF,
  title: string,
  rowCount: string,
  meta: PdfMeta,
  pageW: number
): number {
  doc.setFillColor(...BRAND_RGB);
  doc.rect(0, 0, pageW, 14, 'F');
  doc.setTextColor(...WHITE_RGB);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(meta.storeName, 12, 9.5);
  doc.setFontSize(11);
  doc.text(title, pageW / 2, 9.5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(
    `${rowCount}  ·  ${new Date().toLocaleString('en-GB')}`,
    pageW - 12,
    9.5,
    { align: 'right' }
  );

  doc.setFillColor(250, 250, 250);
  doc.rect(0, 14, pageW, 9, 'F');
  doc.setTextColor(...GRAY_MED);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  const filters: string[] = [];
  if (meta.dateFrom || meta.dateTo) {
    const from = meta.dateFrom
      ? `${meta.dateFrom}${meta.timeFrom && meta.timeFrom !== '00:00' ? ` ${meta.timeFrom}` : ''}`
      : '…';
    const to = meta.dateTo
      ? `${meta.dateTo}${meta.timeTo && meta.timeTo !== '23:59' ? ` ${meta.timeTo}` : ''}`
      : '…';
    filters.push(`Date: ${from} → ${to}`);
  }
  if (meta.statusFilter !== 'all')
    filters.push(
      `Status: ${meta.statusFilter === 'active' ? 'Active only' : 'Voided only'}`
    );
  if (meta.cashierFilter) filters.push(`Cashier: ${meta.cashierFilter}`);
  if (meta.methodFilter)
    filters.push(
      `Payment: ${METHOD_LABEL[meta.methodFilter] ?? meta.methodFilter}`
    );
  doc.text(
    filters.length > 0
      ? filters.join('   ·   ')
      : 'All records — no filters applied',
    12,
    20.5
  );

  const statsY = 23;
  const statsH = 17;
  doc.setFillColor(...GRAY_LIGHT);
  doc.rect(0, statsY, pageW, statsH, 'F');
  doc.setDrawColor(...BRAND_RGB);
  doc.setLineWidth(0.5);
  doc.line(0, statsY, pageW, statsY);

  const stats: {
    label: string;
    value: string;
    color: [number, number, number];
  }[] = [
    {
      label: 'Gross Revenue',
      value: formatCurrency(meta.summary.gross),
      color: GRAY_DARK,
    },
    {
      label: 'Net Revenue',
      value: formatCurrency(meta.summary.revenue),
      color: GREEN_RGB,
    },
    {
      label: 'Total Discount',
      value: formatCurrency(meta.summary.discount),
      color: ORANGE_RGB,
    },
    {
      label: 'Items Sold',
      value: meta.summary.items.toLocaleString(),
      color: GRAY_DARK,
    },
    {
      label: 'Distinct Orders',
      value: meta.summary.orders.toLocaleString(),
      color: GRAY_DARK,
    },
    {
      label: 'Avg / Order',
      value: formatCurrency(meta.summary.avgOrder),
      color: GRAY_DARK,
    },
    ...(meta.summary.profit > 0
      ? [
          {
            label: 'Est. Profit',
            value: formatCurrency(meta.summary.profit),
            color: TEAL_RGB as [number, number, number],
          },
        ]
      : []),
  ];
  const colW = pageW / stats.length;
  stats.forEach(({ label, value, color }, i) => {
    const x = i * colW + 8;
    doc.setTextColor(...GRAY_MED);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.text(label, x, statsY + 5.5);
    doc.setTextColor(...color);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(value, x, statsY + 12.5);
  });
  doc.setDrawColor(210, 210, 210);
  doc.setLineWidth(0.2);
  doc.line(0, statsY + statsH, pageW, statsY + statsH);
  doc.setTextColor(...GRAY_DARK);
  return statsY + statsH + 3;
}

export function drawPdfMiniHeader(
  doc: jsPDF,
  title: string,
  pageW: number,
  storeName: string
) {
  doc.setFillColor(...BRAND_RGB);
  doc.rect(0, 0, pageW, 8, 'F');
  doc.setTextColor(...WHITE_RGB);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text(storeName + '  ·  ' + title, 12, 5.5);
  doc.setFont('helvetica', 'normal');
  doc.text(new Date().toLocaleDateString('en-GB'), pageW - 12, 5.5, {
    align: 'right',
  });
  doc.setTextColor(...GRAY_DARK);
}

export function addPdfPageFooters(doc: jsPDF, subtitle: string, storeName: string) {
  const total = (doc.internal as any).getNumberOfPages() as number;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(210, 210, 210);
    doc.setLineWidth(0.3);
    doc.line(12, pageH - 8, pageW - 12, pageH - 8);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...GRAY_MED);
    doc.text(storeName + '  ·  Confidential', 12, pageH - 4.5);
    doc.text(subtitle, pageW / 2, pageH - 4.5, { align: 'center' });
    doc.text(`Page ${i} of ${total}`, pageW - 12, pageH - 4.5, {
      align: 'right',
    });
  }
}

// Draws the Payments / Discounts / Sales Summary section after the main table
export function drawPdfSummarySection(
  doc: jsPDF,
  lineRows: LineRow[] | null,
  meta: PdfMeta,
  afterY: number,
  pageW: number,
  margin: number,
  reportTitle: string
) {
  const availW = pageW - 2 * margin;
  const pageH = doc.internal.pageSize.getHeight();
  const FOOTER = 12;
  let y = afterY + 5;

  const ensurePage = (needed: number) => {
    if (y + needed > pageH - FOOTER) {
      doc.addPage();
      drawPdfMiniHeader(doc, reportTitle, pageW, meta.storeName);
      y = 12;
    }
  };

  const sectionHead = (label: string) => {
    ensurePage(9);
    doc.setFillColor(...GRAY_LIGHT);
    doc.rect(margin, y, availW, 7.5, 'F');
    doc.setTextColor(...GRAY_DARK);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text(label, margin + 3.5, y + 5.3);
    y += 7.5;
  };

  const kv = (
    label: string,
    value: string,
    bold = false,
    color: [number, number, number] = GRAY_DARK,
    sep = true
  ) => {
    ensurePage(7);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...GRAY_MED);
    doc.text(label, margin + 5, y + 4.8);
    doc.setTextColor(...color);
    doc.text(value, margin + availW - 5, y + 4.8, { align: 'right' });
    if (sep) {
      doc.setDrawColor(235, 235, 235);
      doc.setLineWidth(0.1);
      doc.line(margin, y + 6.5, margin + availW, y + 6.5);
    }
    y += 7;
  };

  if (lineRows) {
    const byMethod: Record<string, number> = {};
    lineRows.forEach((r) => {
      if (!r.isVoided)
        byMethod[r.paymentMethod] =
          (byMethod[r.paymentMethod] ?? 0) + r.subtotal;
    });
    const methods = Object.entries(byMethod);
    if (methods.length > 0) {
      sectionHead('Payments');
      methods.forEach(([m, amt]) =>
        kv(METHOD_LABEL[m] ?? m, formatCurrency(amt))
      );
      kv('Total', formatCurrency(meta.summary.revenue), true, BRAND_RGB, false);
    }
  }

  y += 4;
  if (lineRows) {
    const discCount = lineRows.filter(
      (r) => !r.isVoided && r.discount > 0
    ).length;
    sectionHead('Discounts');
    kv('Number of discounts:', discCount.toLocaleString());
    kv(
      'Amount of discounts:',
      formatCurrency(meta.summary.discount),
      false,
      GRAY_DARK,
      false
    );
    y += 4;
  }

  sectionHead('Sales Summary');
  kv('Gross Revenue:', formatCurrency(meta.summary.gross));
  if (meta.summary.discount > 0)
    kv(
      'Total Discounts:',
      `− ${formatCurrency(meta.summary.discount)}`,
      false,
      ORANGE_RGB
    );
  kv('Net Revenue:', formatCurrency(meta.summary.revenue), true, BRAND_RGB);
  kv('Items Sold:', meta.summary.items.toLocaleString());
  kv('Distinct Orders:', meta.summary.orders.toLocaleString());
  kv('Avg Order Value:', formatCurrency(meta.summary.avgOrder));
  if (meta.summary.profit > 0)
    kv(
      'Est. Profit:',
      formatCurrency(meta.summary.profit),
      false,
      TEAL_RGB,
      false
    );
}