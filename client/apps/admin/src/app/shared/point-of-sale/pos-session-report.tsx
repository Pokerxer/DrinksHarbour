'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { posApi } from '@/app/shared/point-of-sale/api';
import { useTenant } from '@/context/TenantContext';
import { formatCurrency } from '@/app/shared/point-of-sale/utils';
import { POSSession } from '@/app/shared/point-of-sale/types';
import POSNavHeader from '@/app/shared/point-of-sale/pos-nav-header';
import {
  PiArrowsClockwise,
  PiPrinter,
  PiMagnifyingGlass,
  PiX,
  PiCaretLeft,
  PiCaretRight,
  PiReceipt,
  PiArrowDown,
  PiArrowUp,
  PiFilePdf,
  PiCalendar,
  PiChartBar,
  PiListBullets,
  PiFileText,
  PiCaretDown,
  PiCaretUp,
} from 'react-icons/pi';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ── Helpers ───────────────────────────────────────────────────────────────────

function isTokenExpired(tok: string | null | undefined): boolean {
  if (!tok) return true;
  try {
    const payload = JSON.parse(atob(tok.split('.')[1]));
    return (payload.exp ?? 0) * 1000 < Date.now();
  } catch {
    return true;
  }
}

function fmtDate(d: string | Date) {
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
function fmtTime(d: string | Date) {
  return new Date(d).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}
function fmtDateTime(d: string | Date) {
  return `${fmtDate(d)} · ${fmtTime(d)}`;
}
function duration(openedAt: string, closedAt?: string | null) {
  const ms =
    new Date(closedAt || Date.now()).getTime() - new Date(openedAt).getTime();
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
function staffName(
  u?: { firstName: string; lastName: string; posName?: string } | null
) {
  if (!u) return '—';
  return u.posName || `${u.firstName} ${u.lastName}`.trim();
}
function cashierName(
  u?: { firstName: string; lastName: string; posName?: string } | string | null
) {
  if (!u || typeof u === 'string') return '—';
  return u.posName || `${u.firstName} ${u.lastName}`.trim();
}

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  card: 'Card / POS',
  bank_transfer: 'Bank Transfer',
  mobile_money: 'Mobile Money',
  split: 'Split',
  other: 'Other',
};

const METHOD_COLORS: Record<string, string> = {
  cash: '#16a34a',
  card: '#2563eb',
  bank_transfer: '#7c3aed',
  mobile_money: '#d97706',
  split: '#0891b2',
  other: '#6b7280',
};

// ── Extended order type ───────────────────────────────────────────────────────

interface SessionOrder {
  _id: string;
  orderNumber?: string;
  receiptNumber?: string;
  total: number;
  totalAmount?: number;
  subtotal?: number;
  discountTotal?: number;
  paymentMethod: string;
  paymentDetails?: {
    splitPayments?: { method: string; amount: number }[];
    change?: number;
    amount?: number;
  };
  posStaff?: { firstName: string; lastName: string; posName?: string } | null;
  isVoided?: boolean;
  status?: string;
  paymentStatus?: string;
  placedAt: string;
  createdAt: string;
  items?: {
    name: string;
    variant?: string;
    quantity: number;
    priceAtPurchase: number;
    itemSubtotal: number;
    discountAmount?: number;
    warehouse?: { _id: string; name: string; code: string } | null;
  }[];
  refunds?: { totalRefunded?: number }[];
}

function getOrderWarehouse(order: { items?: SessionOrder['items'] }) {
  return order.items?.find((i) => i.warehouse)?.warehouse ?? null;
}

// ── PDF colours ───────────────────────────────────────────────────────────────

const PDF_BRAND: [number, number, number] = [178, 2, 2];
const PDF_DARK: [number, number, number] = [31, 41, 55];
const PDF_MED: [number, number, number] = [107, 114, 128];
const PDF_LIGHT: [number, number, number] = [243, 244, 246];
const PDF_WHITE: [number, number, number] = [255, 255, 255];
const PDF_ORANGE: [number, number, number] = [217, 70, 0];

// ── PDF: Session Report ───────────────────────────────────────────────────────

function buildSessionReportPdf(session: POSSession, orders: SessionOrder[], storeName: string) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 14;
  const CW = pageW - 2 * M;

  doc.setFillColor(...PDF_BRAND);
  doc.rect(0, 0, pageW, 14, 'F');
  doc.setTextColor(...PDF_WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(storeName, M, 9.5);
  doc.setFontSize(11);
  doc.text('SESSION REPORT', pageW / 2, 9.5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(new Date().toLocaleString('en-GB'), pageW - M, 9.5, {
    align: 'right',
  });

  doc.setFillColor(250, 250, 250);
  doc.rect(0, 14, pageW, 16, 'F');
  doc.setTextColor(...PDF_MED);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  const terminal = (session.terminalType || 'retail').toUpperCase();
  const period = `${fmtDateTime(session.openedAt)}${session.closedAt ? ` → ${fmtDateTime(session.closedAt)}` : ' (Open)'}`;
  const opener = staffName(session.openedBy as any);
  doc.text(
    `Terminal: ${terminal}   ·   Period: ${period}   ·   Opened by: ${opener}`,
    M,
    20
  );
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...PDF_DARK);
  doc.text(`${terminal} · ${fmtDate(session.openedAt)}`, M, 27);
  doc.setFont('helvetica', 'normal');
  doc.setDrawColor(210, 210, 210);
  doc.setLineWidth(0.2);
  doc.line(0, 30, pageW, 30);

  let y = 34;

  const sectionHead = (label: string) => {
    doc.setFillColor(...PDF_LIGHT);
    doc.rect(M, y, CW, 7.5, 'F');
    doc.setTextColor(...PDF_DARK);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text(label, M + 3.5, y + 5.3);
    y += 7.5;
  };

  const tRow = (
    c1: string,
    c2: string,
    c3: string,
    opts?: {
      bold?: boolean;
      color?: [number, number, number];
      topLine?: boolean;
    }
  ) => {
    const { bold = false, color = PDF_DARK, topLine = false } = opts ?? {};
    if (topLine) {
      doc.setDrawColor(...PDF_BRAND);
      doc.setLineWidth(0.4);
      doc.line(M, y, M + CW, y);
    }
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...PDF_MED);
    if (c1) doc.text(c1, M + 5, y + 4.8);
    doc.setTextColor(...color);
    if (c2) doc.text(c2, M + CW * 0.62, y + 4.8);
    if (c3) doc.text(c3, M + CW - 5, y + 4.8, { align: 'right' });
    doc.setDrawColor(235, 235, 235);
    doc.setLineWidth(0.1);
    doc.line(M, y + 6.5, M + CW, y + 6.5);
    y += 7;
  };

  const kv = (
    label: string,
    value: string,
    bold = false,
    color: [number, number, number] = PDF_DARK
  ) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...PDF_MED);
    doc.text(label, M + 5, y + 4.8);
    doc.setTextColor(...color);
    doc.text(value, M + CW - 5, y + 4.8, { align: 'right' });
    doc.setDrawColor(235, 235, 235);
    doc.setLineWidth(0.1);
    doc.line(M, y + 6.5, M + CW, y + 6.5);
    y += 7;
  };

  const totalSales = session.totalSales || 0;
  const orderCount = session.orderCount || 0;
  const itemsSold = orders.reduce(
    (s, o) => s + (o.items || []).reduce((si, i) => si + i.quantity, 0),
    0
  );
  const totalDiscount = orders.reduce((s, o) => s + (o.discountTotal ?? 0), 0);
  const discCount = orders.filter(
    (o) => !o.isVoided && (o.discountTotal ?? 0) > 0
  ).length;

  doc.setFillColor(250, 250, 250);
  doc.rect(M, y, CW, 9, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...PDF_DARK);
  doc.text('Total', M + 5, y + 6);
  doc.text(itemsSold.toLocaleString(), M + CW * 0.62, y + 6);
  doc.setTextColor(...PDF_BRAND);
  doc.text(formatCurrency(totalSales), M + CW - 5, y + 6, { align: 'right' });
  doc.setDrawColor(...PDF_BRAND);
  doc.setLineWidth(0.4);
  doc.line(M, y + 9, M + CW, y + 9);
  y += 13;

  sectionHead('Taxes on Sales');
  tRow('No Taxes', '0.00', formatCurrency(totalSales));
  tRow('Total', '0.00', formatCurrency(totalSales), { bold: true });
  y += 5;

  sectionHead('Payments');
  const paymentMethods = [
    { label: 'Cash', amount: session.cashSales || 0 },
    { label: 'Card / POS', amount: session.cardSales || 0 },
    { label: 'Bank Transfer', amount: session.transferSales || 0 },
    { label: 'Mobile Money', amount: session.mobileMoneySales || 0 },
    { label: 'Split', amount: (session as any).splitSales || 0 },
  ].filter((m) => m.amount > 0);
  paymentMethods.forEach((m) => tRow(m.label, '', formatCurrency(m.amount)));
  tRow('Total', '', formatCurrency(totalSales), {
    bold: true,
    color: PDF_BRAND,
    topLine: true,
  });
  y += 5;

  sectionHead('Discounts');
  kv('Number of discounts:', discCount.toLocaleString());
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...PDF_MED);
  doc.text('Amount of discounts:', M + 5, y + 4.8);
  doc.setTextColor(
    totalDiscount > 0 ? PDF_ORANGE[0] : PDF_DARK[0],
    totalDiscount > 0 ? PDF_ORANGE[1] : PDF_DARK[1],
    totalDiscount > 0 ? PDF_ORANGE[2] : PDF_DARK[2]
  );
  doc.text(formatCurrency(totalDiscount), M + CW - 5, y + 4.8, {
    align: 'right',
  });
  doc.setDrawColor(235, 235, 235);
  doc.setLineWidth(0.1);
  doc.line(M, y + 6.5, M + CW, y + 6.5);
  y += 12;

  sectionHead('Session Control');
  kv('Total:', formatCurrency(totalSales), true);
  kv('Opening Cash:', formatCurrency(session.openingCash || 0));
  const cashMoves = session.cashMovements || [];
  const cashIn = cashMoves
    .filter((m) => m.type === 'in')
    .reduce((s, m) => s + m.amount, 0);
  const cashOut = cashMoves
    .filter((m) => m.type === 'out')
    .reduce((s, m) => s + m.amount, 0);
  if (cashIn > 0) kv('Cash In:', `+ ${formatCurrency(cashIn)}`);
  if (cashOut > 0) kv('Cash Out:', `− ${formatCurrency(cashOut)}`);
  kv('Number of transactions:', orderCount.toLocaleString());
  kv('Duration:', duration(session.openedAt, session.closedAt));

  const methods = (session.methodBalances || []).filter(
    (m) => m.theoretical > 0 || (m.counted ?? 0) > 0
  );
  if (methods.length > 0 && session.status === 'closed') {
    y += 5;
    sectionHead('Cash Balance');
    tRow('Payment Method', 'Expected', 'Counted', { bold: true });
    methods.forEach((m) => {
      const counted = m.counted ?? m.theoretical;
      const diff = counted - m.theoretical;
      const diffStr =
        Math.abs(diff) > 0.01
          ? `  (${diff > 0 ? '+' : ''}${formatCurrency(diff)})`
          : '';
      tRow(
        METHOD_LABELS[m.method] ?? m.method,
        formatCurrency(m.theoretical),
        `${formatCurrency(counted)}${diffStr}`,
        { color: Math.abs(diff) > 0.01 ? [190, 50, 50] : PDF_DARK }
      );
    });
  }

  const totalPages = (doc.internal as any).getNumberOfPages() as number;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(210, 210, 210);
    doc.setLineWidth(0.3);
    doc.line(M, pageH - 8, pageW - M, pageH - 8);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...PDF_MED);
    doc.text(storeName + '  ·  Confidential', M, pageH - 4.5);
    doc.text('Session Report', pageW / 2, pageH - 4.5, { align: 'center' });
    doc.text(`Page ${i} of ${totalPages}`, pageW - M, pageH - 4.5, {
      align: 'right',
    });
  }

  const label = `${(session.terminalType || 'retail').toLowerCase()}-session-${fmtDate(session.openedAt).replace(/ /g, '-')}`;
  doc.save(`session-report-${label}.pdf`);
}

// ── PDF: Z-Report ─────────────────────────────────────────────────────────────

function buildZReportPdf(session: POSSession, orders: SessionOrder[], storeName: string) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 14;
  const CW = pageW - 2 * M;

  doc.setFillColor(...PDF_BRAND);
  doc.rect(0, 0, pageW, 14, 'F');
  doc.setTextColor(...PDF_WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Z-REPORT', pageW / 2, 9.5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(storeName, M, 9.5);
  doc.text(new Date().toLocaleString('en-GB'), pageW - M, 9.5, {
    align: 'right',
  });

  doc.setFillColor(250, 250, 250);
  doc.rect(0, 14, pageW, 12, 'F');
  doc.setTextColor(...PDF_MED);
  doc.setFontSize(7.5);
  const terminal = (session.terminalType || 'retail').toUpperCase();
  const period = `${fmtDateTime(session.openedAt)}${session.closedAt ? ` → ${fmtDateTime(session.closedAt)}` : ' (Open)'}`;
  doc.text(
    `${terminal}  ·  ${period}  ·  ${staffName(session.openedBy as any)}`,
    M,
    22
  );
  doc.setDrawColor(210, 210, 210);
  doc.setLineWidth(0.2);
  doc.line(0, 26, pageW, 26);

  let y = 30;

  const kv = (
    label: string,
    value: string,
    bold = false,
    color: [number, number, number] = PDF_DARK
  ) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...PDF_MED);
    doc.text(label, M + 5, y + 5);
    doc.setTextColor(...color);
    doc.text(value, M + CW - 5, y + 5, { align: 'right' });
    doc.setDrawColor(235, 235, 235);
    doc.setLineWidth(0.1);
    doc.line(M, y + 7.5, M + CW, y + 7.5);
    y += 8;
  };

  const sHead = (label: string) => {
    doc.setFillColor(...PDF_LIGHT);
    doc.rect(M, y, CW, 8, 'F');
    doc.setTextColor(...PDF_DARK);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(label, M + 4, y + 5.5);
    y += 8;
  };

  const voids = orders.filter((o) => o.isVoided);
  const refunds = orders.filter((o) => (o.refunds?.length ?? 0) > 0);
  const refundAmt = refunds.reduce(
    (s, o) =>
      s + (o.refunds || []).reduce((a, r) => a + (r.totalRefunded ?? 0), 0),
    0
  );
  const voidAmt = voids.reduce((s, o) => s + (o.total || 0), 0);
  const cashMethod = (session.methodBalances || []).find(
    (m) => m.method === 'cash'
  );

  sHead('Sales Summary');
  kv('Total Sales', formatCurrency(session.totalSales || 0), true, PDF_BRAND);
  kv('Total Transactions', String(session.orderCount || 0));
  kv(
    'Total Items Sold',
    String(
      orders.reduce(
        (s, o) => s + (o.items || []).reduce((si, i) => si + i.quantity, 0),
        0
      )
    )
  );
  kv('Duration', duration(session.openedAt, session.closedAt));
  y += 3;

  sHead('Payment Breakdown');
  const pmethods = [
    { label: 'Cash', amount: session.cashSales || 0 },
    { label: 'Card / POS', amount: session.cardSales || 0 },
    { label: 'Bank Transfer', amount: session.transferSales || 0 },
    { label: 'Mobile Money', amount: session.mobileMoneySales || 0 },
    { label: 'Split', amount: (session as any).splitSales || 0 },
  ].filter((m) => m.amount > 0);
  pmethods.forEach((m) => kv(m.label, formatCurrency(m.amount)));
  kv('Total', formatCurrency(session.totalSales || 0), true, PDF_BRAND);
  y += 3;

  sHead('Voids & Refunds');
  kv(
    'Voided Orders',
    String(voids.length),
    false,
    voids.length > 0 ? PDF_ORANGE : PDF_DARK
  );
  kv(
    'Voided Amount',
    formatCurrency(voidAmt),
    false,
    voids.length > 0 ? PDF_ORANGE : PDF_DARK
  );
  kv('Refunded Orders', String(refunds.length));
  kv('Refunded Amount', formatCurrency(refundAmt));
  y += 3;

  sHead('Cash Reconciliation');
  kv('Opening Cash', formatCurrency(session.openingCash || 0));
  if (cashMethod) {
    kv('Expected Cash', formatCurrency(cashMethod.theoretical));
    if (cashMethod.counted !== null) {
      kv('Counted Cash', formatCurrency(cashMethod.counted ?? 0));
      const diff = (cashMethod.counted ?? 0) - cashMethod.theoretical;
      kv(
        'Difference',
        (diff >= 0 ? '+' : '') + formatCurrency(diff),
        true,
        Math.abs(diff) > 0.01 ? [190, 50, 50] : [22, 163, 74]
      );
    }
  }

  const totalPages = (doc.internal as any).getNumberOfPages() as number;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(210, 210, 210);
    doc.setLineWidth(0.3);
    doc.line(M, pageH - 8, pageW - M, pageH - 8);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...PDF_MED);
    doc.text(storeName + '  ·  Confidential', M, pageH - 4.5);
    doc.text('Z-Report', pageW / 2, pageH - 4.5, { align: 'center' });
    doc.text(`Page ${i} of ${totalPages}`, pageW - M, pageH - 4.5, {
      align: 'right',
    });
  }

  const label = `${(session.terminalType || 'retail').toLowerCase()}-zreport-${fmtDate(session.openedAt).replace(/ /g, '-')}`;
  doc.save(`z-report-${label}.pdf`);
}

// ── Print: Session Report ─────────────────────────────────────────────────────

function printSessionReport(session: POSSession, orders: SessionOrder[], storeName: string) {
  const totalSales = session.totalSales || 0;
  const orderCount = session.orderCount || 0;
  const itemsSold = orders.reduce(
    (s, o) => s + (o.items || []).reduce((si, i) => si + i.quantity, 0),
    0
  );
  const totalDiscount = orders.reduce((s, o) => s + (o.discountTotal ?? 0), 0);
  const discCount = orders.filter(
    (o) => !o.isVoided && (o.discountTotal ?? 0) > 0
  ).length;
  const ng = (v: number) => formatCurrency(v);

  const paymentRows = [
    { label: 'Cash', amount: session.cashSales || 0 },
    { label: 'Card / POS', amount: session.cardSales || 0 },
    { label: 'Bank Transfer', amount: session.transferSales || 0 },
    { label: 'Mobile Money', amount: session.mobileMoneySales || 0 },
    { label: 'Split', amount: (session as any).splitSales || 0 },
  ].filter((m) => m.amount > 0);

  const cashMoves = session.cashMovements || [];
  const cashIn = cashMoves
    .filter((m) => m.type === 'in')
    .reduce((s, m) => s + m.amount, 0);
  const cashOut = cashMoves
    .filter((m) => m.type === 'out')
    .reduce((s, m) => s + m.amount, 0);
  const methods = (session.methodBalances || []).filter(
    (m) => m.theoretical > 0 || (m.counted ?? 0) > 0
  );

  const sRow = (label: string) =>
    `<tr><td colspan="3" style="background:#e5e7eb;padding:8px 14px;font-size:11px;font-weight:700;color:#111;letter-spacing:0.04em">${label}</td></tr>`;
  const dRow = (
    c1: string,
    c2: string,
    c3: string,
    bold = false,
    color = '#374151'
  ) =>
    `<tr style="border-bottom:1px solid #f3f4f6">
      <td style="padding:7px 14px;font-size:12px;color:#6b7280">${c1}</td>
      <td style="padding:7px 14px;text-align:right;font-size:12px;color:${color};font-weight:${bold ? 700 : 400}">${c2}</td>
      <td style="padding:7px 14px;text-align:right;font-size:12px;color:${color};font-weight:${bold ? 700 : 400}">${c3}</td>
    </tr>`;

  const win = window.open('', '_blank', 'width=860,height=1100,scrollbars=yes');
  if (!win) return;

  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>Session Report</title>
  <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;background:#fff;color:#111;padding:44px 52px 80px}
  table{width:100%;border-collapse:collapse}
  @media print{body{padding:24px 32px}@page{size:A4;margin:12mm}}</style>
  </head><body>
  <div style="height:5px;background:#b20202;margin-bottom:32px;border-radius:3px"></div>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px">
    <div>
      <div style="font-size:22px;font-weight:900;color:#b20202">SESSION REPORT</div>
      <div style="font-size:13px;color:#6b7280;margin-top:4px">${storeName} · ${(session.terminalType || 'retail').toUpperCase()}</div>
    </div>
    <div style="text-align:right;font-size:12px;color:#6b7280;line-height:1.8">
      <div><strong>Period:</strong> ${fmtDateTime(session.openedAt)}${session.closedAt ? ` → ${fmtDateTime(session.closedAt)}` : ' (Open)'}</div>
      <div><strong>Opened by:</strong> ${staffName(session.openedBy as any)}</div>
      <div><strong>Generated:</strong> ${new Date().toLocaleString('en-GB')}</div>
    </div>
  </div>
  <table>
    <thead><tr style="border-bottom:2px solid #b20202;border-top:1px solid #e5e7eb">
      <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em"></th>
      <th style="padding:10px 14px;text-align:right;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em">Items / Qty</th>
      <th style="padding:10px 14px;text-align:right;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em">Amount</th>
    </tr></thead>
    <tbody>
      <tr style="border-bottom:2px solid #e5e7eb">
        <td style="padding:11px 14px;font-size:13px;font-weight:700">Total</td>
        <td style="padding:11px 14px;text-align:right;font-size:13px;font-weight:700">${itemsSold.toLocaleString()}</td>
        <td style="padding:11px 14px;text-align:right;font-size:14px;font-weight:900;color:#b20202">${ng(totalSales)}</td>
      </tr>
      ${sRow('Taxes on Sales')}
      ${dRow('No Taxes', '0.00', ng(totalSales))}
      ${dRow('Total', '<strong>0.00</strong>', `<strong>${ng(totalSales)}</strong>`, true)}
      ${sRow('Payments')}
      ${paymentRows.map((p) => dRow(p.label, '', ng(p.amount))).join('')}
      ${dRow('<strong>Total</strong>', '', `<strong style="color:#b20202">${ng(totalSales)}</strong>`, true, '#b20202')}
      ${sRow('Discounts')}
      <tr style="border-bottom:1px solid #f3f4f6">
        <td colspan="2" style="padding:7px 14px;font-size:12px;color:#6b7280">Number of discounts:</td>
        <td style="padding:7px 14px;text-align:right;font-size:12px;color:#374151">${discCount.toLocaleString()}</td>
      </tr>
      <tr style="border-bottom:1px solid #f3f4f6">
        <td colspan="2" style="padding:7px 14px;font-size:12px;color:#6b7280">Amount of discounts:</td>
        <td style="padding:7px 14px;text-align:right;font-size:12px;color:${totalDiscount > 0 ? '#d94600' : '#374151'}">${ng(totalDiscount)}</td>
      </tr>
      ${sRow('Session Control')}
      <tr style="border-bottom:1px solid #f3f4f6">
        <td colspan="2" style="padding:7px 14px;font-size:12px;color:#6b7280">Total:</td>
        <td style="padding:7px 14px;text-align:right;font-size:12px;font-weight:700;color:#b20202">${ng(totalSales)}</td>
      </tr>
      <tr style="border-bottom:1px solid #f3f4f6">
        <td colspan="2" style="padding:7px 14px;font-size:12px;color:#6b7280">Opening Cash:</td>
        <td style="padding:7px 14px;text-align:right;font-size:12px;color:#374151">${ng(session.openingCash || 0)}</td>
      </tr>
      ${cashIn > 0 ? `<tr style="border-bottom:1px solid #f3f4f6"><td colspan="2" style="padding:7px 14px;font-size:12px;color:#6b7280">Cash In:</td><td style="padding:7px 14px;text-align:right;font-size:12px;color:#16a34a">+${ng(cashIn)}</td></tr>` : ''}
      ${cashOut > 0 ? `<tr style="border-bottom:1px solid #f3f4f6"><td colspan="2" style="padding:7px 14px;font-size:12px;color:#6b7280">Cash Out:</td><td style="padding:7px 14px;text-align:right;font-size:12px;color:#dc2626">−${ng(cashOut)}</td></tr>` : ''}
      <tr style="border-bottom:1px solid #f3f4f6">
        <td colspan="2" style="padding:7px 14px;font-size:12px;color:#6b7280">Number of transactions:</td>
        <td style="padding:7px 14px;text-align:right;font-size:12px;color:#374151">${orderCount.toLocaleString()}</td>
      </tr>
      <tr>
        <td colspan="2" style="padding:7px 14px;font-size:12px;color:#6b7280">Duration:</td>
        <td style="padding:7px 14px;text-align:right;font-size:12px;color:#374151">${duration(session.openedAt, session.closedAt)}</td>
      </tr>
      ${
        methods.length > 0 && session.status === 'closed'
          ? `
        ${sRow('Cash Balance')}
        ${methods
          .map((m) => {
            const counted = m.counted ?? m.theoretical;
            const diff = counted - m.theoretical;
            const hasDiff = Math.abs(diff) > 0.01;
            return dRow(
              METHOD_LABELS[m.method] ?? m.method,
              ng(m.theoretical),
              hasDiff
                ? `${ng(counted)} <span style="color:${diff > 0 ? '#16a34a' : '#dc2626'};font-size:10px">(${diff > 0 ? '+' : ''}${ng(diff)})</span>`
                : ng(counted),
              false,
              hasDiff ? '#b91c1c' : '#374151'
            );
          })
          .join('')}
      `
          : ''
      }
    </tbody>
  </table>
  <div style="margin-top:40px;border-top:1px solid #ccc;padding-top:10px;display:flex;justify-content:space-between;font-size:11px;color:#6b7280">
    <span>${storeName} · Confidential</span><span>Session Report</span>
  </div>
  </body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => {
    win.print();
    win.close();
  }, 500);
}

// ── Session list row ──────────────────────────────────────────────────────────

function SessionListRow({
  session,
  selected,
  onClick,
}: {
  session: POSSession;
  selected: boolean;
  onClick: () => void;
}) {
  const isOpen = session.status === 'open';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full border-b border-gray-100 px-4 py-3.5 text-left transition-colors ${
        selected ? 'bg-[#b20202] text-white' : 'bg-white hover:bg-gray-50'
      }`}
    >
      <div className="flex items-center gap-2.5">
        <div className="shrink-0">
          {isOpen ? (
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
          ) : (
            <span
              className={`inline-flex h-2 w-2 rounded-full ${selected ? 'bg-white/60' : 'bg-gray-300'}`}
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span
              className={`text-xs font-bold ${selected ? 'text-white' : 'text-gray-900'}`}
            >
              {fmtDate(session.openedAt)}
            </span>
            <span
              className={`rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                selected
                  ? 'border-white/30 bg-white/10 text-white'
                  : 'border-gray-200 bg-gray-50 text-gray-500'
              }`}
            >
              {session.terminalType || 'retail'}
            </span>
          </div>
          <div
            className={`mt-0.5 flex items-center gap-2 text-[10px] ${selected ? 'text-white/80' : 'text-gray-400'}`}
          >
            <span>{fmtTime(session.openedAt)}</span>
            <span>·</span>
            <span>{staffName(session.openedBy as any)}</span>
          </div>
        </div>
        <div className="text-right">
          <div
            className={`text-xs font-bold tabular-nums ${selected ? 'text-white' : 'text-[#b20202]'}`}
          >
            {formatCurrency(session.totalSales)}
          </div>
          <div
            className={`text-[10px] tabular-nums ${selected ? 'text-white/70' : 'text-gray-400'}`}
          >
            {session.orderCount} orders
          </div>
        </div>
      </div>
    </button>
  );
}

// ── Table helpers ─────────────────────────────────────────────────────────────

function SectionHead({ label }: { label: string }) {
  return (
    <tr>
      <td
        colSpan={3}
        className="bg-gray-100 px-4 py-2 text-xs font-bold uppercase tracking-wider text-gray-700"
      >
        {label}
      </td>
    </tr>
  );
}

function DataRow({
  label,
  mid,
  right,
  bold,
  rightColor = 'text-gray-800',
}: {
  label: string;
  mid?: string;
  right: string;
  bold?: boolean;
  rightColor?: string;
}) {
  return (
    <tr className="border-b border-gray-50">
      <td className="px-5 py-2 text-sm text-gray-500">{label}</td>
      <td className="px-4 py-2 text-right text-sm text-gray-500">{mid}</td>
      <td
        className={`px-5 py-2 text-right text-sm ${bold ? 'font-bold' : 'font-normal'} ${rightColor}`}
      >
        {right}
      </td>
    </tr>
  );
}

// ── Orders tab ────────────────────────────────────────────────────────────────

function OrderRow({ order }: { order: SessionOrder }) {
  const [open, setOpen] = useState(false);
  const isVoided = order.isVoided;
  const hasRefund = (order.refunds?.length ?? 0) > 0;
  const refundAmt = (order.refunds || []).reduce(
    (s, r) => s + (r.totalRefunded ?? 0),
    0
  );
  const methodColor = METHOD_COLORS[order.paymentMethod] ?? '#6b7280';

  return (
    <>
      <tr
        className={`border-b border-gray-50 transition-colors ${
          isVoided ? 'bg-red-50/60 opacity-70' : 'hover:bg-gray-50/80'
        }`}
      >
        <td className="px-4 py-2.5">
          <div className="flex items-center gap-2">
            {order.items && order.items.length > 0 && (
              <button
                type="button"
                onClick={() => setOpen((p) => !p)}
                className="text-gray-300 hover:text-gray-500"
              >
                {open ? (
                  <PiCaretUp className="h-3.5 w-3.5" />
                ) : (
                  <PiCaretDown className="h-3.5 w-3.5" />
                )}
              </button>
            )}
            <div>
              <span className="font-mono text-xs font-semibold text-gray-700">
                {order.receiptNumber ||
                  order.orderNumber ||
                  order._id.slice(-6).toUpperCase()}
              </span>
              {isVoided && (
                <span className="ml-1.5 rounded bg-red-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-red-600">
                  Void
                </span>
              )}
              {hasRefund && !isVoided && (
                <span className="ml-1.5 rounded bg-orange-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-orange-600">
                  Refund
                </span>
              )}
              {(() => {
                const wh = getOrderWarehouse(order);
                return wh ? (
                  <span className="ml-1.5 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                    {wh.name}
                  </span>
                ) : null;
              })()}
            </div>
          </div>
        </td>
        <td className="px-3 py-2.5 text-xs tabular-nums text-gray-400">
          {fmtTime(order.placedAt || order.createdAt)}
        </td>
        <td className="px-3 py-2.5 text-xs text-gray-500">
          {staffName(order.posStaff)}
        </td>
        <td className="px-3 py-2.5">
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{ background: methodColor + '18', color: methodColor }}
          >
            {METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod}
          </span>
        </td>
        <td className="px-3 py-2.5 text-right text-xs tabular-nums text-gray-500">
          {(order.items || []).reduce((s, i) => s + i.quantity, 0) || '—'}
        </td>
        <td className="px-4 py-2.5 text-right">
          <span
            className={`text-xs font-semibold tabular-nums ${isVoided ? 'text-gray-400 line-through' : 'text-gray-800'}`}
          >
            {formatCurrency(order.total)}
          </span>
          {hasRefund && !isVoided && refundAmt > 0 && (
            <div className="text-[10px] text-orange-500">
              −{formatCurrency(refundAmt)}
            </div>
          )}
        </td>
      </tr>
      {open && order.items && (
        <tr className="border-b border-gray-50 bg-gray-50/50">
          <td colSpan={6} className="px-6 pb-2 pt-0">
            <div className="divide-y divide-gray-100 py-1">
              {order.items.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between py-1.5"
                >
                  <div className="min-w-0">
                    <span className="text-xs text-gray-700">{item.name}</span>
                    {item.variant && (
                      <span className="ml-1 text-[10px] text-gray-400">
                        · {item.variant}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs tabular-nums text-gray-500">
                    <span>×{item.quantity}</span>
                    <span>{formatCurrency(item.priceAtPurchase)}</span>
                    <span className="font-medium text-gray-700">
                      {formatCurrency(item.itemSubtotal)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function OrdersTab({
  orders,
  loading,
}: {
  orders: SessionOrder[];
  loading: boolean;
}) {
  const voidCount = orders.filter((o) => o.isVoided).length;
  const refundCount = orders.filter((o) => (o.refunds?.length ?? 0) > 0).length;
  const totalItems = orders.reduce(
    (s, o) => s + (o.items || []).reduce((si, i) => si + i.quantity, 0),
    0
  );

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-[#b20202]" />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="flex h-48 flex-col items-center justify-center gap-2 text-center">
        <PiReceipt className="h-10 w-10 text-gray-200" />
        <p className="text-sm text-gray-400">No orders in this session</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 border-b border-gray-100 bg-gray-50/80 px-5 py-2.5">
        <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-700 ring-1 ring-gray-200">
          {orders.length} orders
        </span>
        <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-500 ring-1 ring-gray-200">
          {totalItems} items
        </span>
        {voidCount > 0 && (
          <span className="rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-600 ring-1 ring-red-100">
            {voidCount} voided
          </span>
        )}
        {refundCount > 0 && (
          <span className="rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-semibold text-orange-600 ring-1 ring-orange-100">
            {refundCount} refunds
          </span>
        )}
      </div>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-white">
            <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Receipt
            </th>
            <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Time
            </th>
            <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Cashier
            </th>
            <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Method
            </th>
            <th className="px-3 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Items
            </th>
            <th className="px-4 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <OrderRow key={o._id} order={o} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Z-Report tab ──────────────────────────────────────────────────────────────

function ZReportTab({
  session,
  orders,
  loading,
}: {
  session: POSSession;
  orders: SessionOrder[];
  loading: boolean;
}) {
  const { tenant } = useTenant();
  const storeName = tenant?.name || 'DrinksHarbour';
  const voids = orders.filter((o) => o.isVoided);
  const refunds = orders.filter((o) => (o.refunds?.length ?? 0) > 0);
  const refundAmt = refunds.reduce(
    (s, o) =>
      s + (o.refunds || []).reduce((a, r) => a + (r.totalRefunded ?? 0), 0),
    0
  );
  const voidAmt = voids.reduce((s, o) => s + (o.total || 0), 0);
  const totalItems = orders.reduce(
    (s, o) => s + (o.items || []).reduce((si, i) => si + i.quantity, 0),
    0
  );
  const cashMethod = (session.methodBalances || []).find(
    (m) => m.method === 'cash'
  );
  const cashDiff =
    cashMethod && cashMethod.counted !== null
      ? (cashMethod.counted ?? 0) - cashMethod.theoretical
      : null;

  const paymentMethods = [
    { key: 'cash', label: 'Cash', amount: session.cashSales || 0 },
    { key: 'card', label: 'Card / POS', amount: session.cardSales || 0 },
    {
      key: 'bank_transfer',
      label: 'Bank Transfer',
      amount: session.transferSales || 0,
    },
    {
      key: 'mobile_money',
      label: 'Mobile Money',
      amount: session.mobileMoneySales || 0,
    },
    { key: 'split', label: 'Split', amount: (session as any).splitSales || 0 },
  ].filter((m) => m.amount > 0);

  if (loading && orders.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-[#b20202]" />
      </div>
    );
  }

  const ZRow = ({
    label,
    value,
    bold,
    valueClass,
  }: {
    label: string;
    value: string;
    bold?: boolean;
    valueClass?: string;
  }) => (
    <tr className="border-b border-gray-50">
      <td className="px-5 py-2 text-sm text-gray-500">{label}</td>
      <td
        className={`px-5 py-2 text-right text-sm tabular-nums ${bold ? 'font-bold' : ''} ${valueClass ?? 'text-gray-800'}`}
      >
        {value}
      </td>
    </tr>
  );

  const ZSection = ({ label }: { label: string }) => (
    <tr>
      <td
        colSpan={2}
        className="bg-gray-100 px-4 py-2 text-xs font-bold uppercase tracking-wider text-gray-700"
      >
        {label}
      </td>
    </tr>
  );

  return (
    <div className="mx-auto max-w-xl px-6 py-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-lg font-black tracking-tight text-gray-900">
            Z-Report
          </h2>
          <p className="mt-0.5 text-xs text-gray-400">
            {(session.terminalType || 'retail').toUpperCase()} ·{' '}
            {fmtDateTime(session.openedAt)}
            {session.closedAt && <> → {fmtTime(session.closedAt)}</>}
          </p>
        </div>
        <button
          type="button"
          onClick={() => buildZReportPdf(session, orders, storeName)}
          className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#9a0101]"
        >
          <PiFilePdf className="h-3.5 w-3.5" />
          PDF
        </button>
      </div>

      <table className="w-full border-collapse text-sm">
        <tbody>
          <ZSection label="Sales Summary" />
          <ZRow
            label="Total Sales"
            value={formatCurrency(session.totalSales || 0)}
            bold
            valueClass="text-[#b20202]"
          />
          <ZRow
            label="Total Transactions"
            value={String(session.orderCount || 0)}
          />
          <ZRow
            label="Total Items Sold"
            value={loading ? '—' : String(totalItems)}
          />
          <ZRow
            label="Session Duration"
            value={duration(session.openedAt, session.closedAt)}
          />
          <ZRow label="Opened By" value={staffName(session.openedBy as any)} />
          {session.closedBy && (
            <ZRow
              label="Closed By"
              value={staffName(session.closedBy as any)}
            />
          )}

          <tr>
            <td colSpan={2} className="pt-1" />
          </tr>
          <ZSection label="Payment Breakdown" />
          {paymentMethods.map((m) => (
            <ZRow
              key={m.key}
              label={m.label}
              value={formatCurrency(m.amount)}
            />
          ))}
          {paymentMethods.length === 0 && (
            <tr>
              <td colSpan={2} className="px-5 py-2 text-xs text-gray-400">
                No payments recorded
              </td>
            </tr>
          )}
          <ZRow
            label="Total"
            value={formatCurrency(session.totalSales || 0)}
            bold
            valueClass="text-[#b20202]"
          />

          <tr>
            <td colSpan={2} className="pt-1" />
          </tr>
          <ZSection label="Voids &amp; Refunds" />
          <tr className="border-b border-gray-50">
            <td className="px-5 py-2 text-sm text-gray-500">Voided Orders</td>
            <td
              className={`px-5 py-2 text-right text-sm tabular-nums ${voids.length > 0 ? 'font-semibold text-red-600' : 'text-gray-800'}`}
            >
              {loading ? '—' : String(voids.length)}
            </td>
          </tr>
          <tr className="border-b border-gray-50">
            <td className="px-5 py-2 text-sm text-gray-500">Voided Amount</td>
            <td
              className={`px-5 py-2 text-right text-sm tabular-nums ${voidAmt > 0 ? 'font-semibold text-red-600' : 'text-gray-800'}`}
            >
              {loading ? '—' : formatCurrency(voidAmt)}
            </td>
          </tr>
          <ZRow
            label="Refunded Orders"
            value={loading ? '—' : String(refunds.length)}
          />
          <ZRow
            label="Refunded Amount"
            value={loading ? '—' : formatCurrency(refundAmt)}
          />

          <tr>
            <td colSpan={2} className="pt-1" />
          </tr>
          <ZSection label="Cash Reconciliation" />
          <ZRow
            label="Opening Cash"
            value={formatCurrency(session.openingCash || 0)}
          />
          {cashMethod ? (
            <>
              <ZRow
                label="Expected Cash"
                value={formatCurrency(cashMethod.theoretical)}
              />
              {cashMethod.counted !== null && (
                <>
                  <ZRow
                    label="Counted Cash"
                    value={formatCurrency(cashMethod.counted ?? 0)}
                  />
                  <tr className="border-b border-gray-50">
                    <td className="px-5 py-2 text-sm text-gray-500">
                      Difference
                    </td>
                    <td
                      className={`px-5 py-2 text-right text-sm font-bold tabular-nums ${
                        cashDiff === null
                          ? 'text-gray-400'
                          : Math.abs(cashDiff) < 0.01
                            ? 'text-emerald-600'
                            : 'text-red-600'
                      }`}
                    >
                      {cashDiff === null
                        ? '—'
                        : (cashDiff >= 0 ? '+' : '') + formatCurrency(cashDiff)}
                    </td>
                  </tr>
                </>
              )}
            </>
          ) : (
            <tr>
              <td colSpan={2} className="px-5 py-2 text-xs text-gray-400">
                {session.status === 'open'
                  ? 'Cash reconciliation available after session is closed.'
                  : 'No cash balance data recorded.'}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ── Cashier Log section ───────────────────────────────────────────────────────

function CashierLogSection({ session }: { session: POSSession }) {
  const log = session.cashierLog || [];
  if (log.length === 0) return null;

  return (
    <>
      <tr>
        <td colSpan={3} className="pt-1" />
      </tr>
      <SectionHead label="Cashier Log" />
      {log.map((entry, i) => {
        const name = cashierName(entry.cashier);
        const dur = entry.endedAt
          ? duration(entry.startedAt, entry.endedAt)
          : duration(entry.startedAt, session.closedAt);
        const isLast = i === log.length - 1;
        return (
          <tr key={i} className="border-b border-gray-50">
            <td className="px-5 py-2.5">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-[10px] font-bold text-gray-600">
                  {i + 1}
                </span>
                <span className="text-sm text-gray-700">{name}</span>
                {isLast && !entry.endedAt && session.status === 'open' && (
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  </span>
                )}
              </div>
            </td>
            <td className="px-4 py-2.5 text-right text-xs text-gray-400">
              {fmtTime(entry.startedAt)}
              {entry.endedAt && <> → {fmtTime(entry.endedAt)}</>}
            </td>
            <td className="px-5 py-2.5 text-right text-xs text-gray-500">
              {dur}
            </td>
          </tr>
        );
      })}
    </>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

type Tab = 'report' | 'orders' | 'zreport';

export default function POSSessionReport() {
  const { data: auth } = useSession();
  const { tenant } = useTenant();
  const storeName = tenant?.name || 'DrinksHarbour';
  const token = useMemo(() => {
    const t = (auth?.user as { token?: string })?.token ?? null;
    return isTokenExpired(t) ? null : t;
  }, [auth]);

  const [sessions, setSessions] = useState<POSSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatus] = useState<'all' | 'open' | 'closed'>('all');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selected, setSelected] = useState<POSSession | null>(null);
  const [orders, setOrders] = useState<SessionOrder[]>([]);
  const [ordersLoading, setOLoad] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('report');

  const LIMIT = 20;

  const load = useCallback(
    async (p = 1) => {
      if (!token) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setLoadError(null);
      try {
        const status = statusFilter === 'all' ? undefined : statusFilter;
        const res = await posApi.getSessions(
          token,
          p,
          LIMIT,
          status,
          dateFrom || undefined,
          dateTo || undefined
        );
        setSessions(res.sessions);
        setTotalPages(Math.max(1, Math.ceil(res.total / LIMIT)));
        setPage(p);
      } catch (err) {
        setLoadError(
          err instanceof Error ? err.message : 'Failed to load sessions'
        );
      } finally {
        setLoading(false);
      }
    },
    [token, statusFilter, dateFrom, dateTo]
  );

  useEffect(() => {
    load(1);
  }, [load]);

  useEffect(() => {
    if (!selected || !token) return;
    setOLoad(true);
    setOrders([]);
    setOrdersError(null);
    posApi
      .getSessionOrders(token, selected._id)
      .then((data) => setOrders((data || []) as SessionOrder[]))
      .catch((err) =>
        setOrdersError(
          err instanceof Error ? err.message : 'Failed to load orders'
        )
      )
      .finally(() => setOLoad(false));
  }, [selected, token]);

  const filtered = useMemo(() => {
    if (!search.trim()) return sessions;
    const q = search.toLowerCase();
    return sessions.filter(
      (s) =>
        s._id.toLowerCase().includes(q) ||
        fmtDate(s.openedAt).toLowerCase().includes(q) ||
        staffName(s.openedBy as any)
          .toLowerCase()
          .includes(q) ||
        (s.terminalType || '').toLowerCase().includes(q)
    );
  }, [sessions, search]);

  const totalSales = selected?.totalSales ?? 0;
  const orderCount = selected?.orderCount ?? 0;
  const itemsSold = useMemo(
    () =>
      orders.reduce(
        (s, o) => s + (o.items || []).reduce((si, i) => si + i.quantity, 0),
        0
      ),
    [orders]
  );
  const totalDiscount = useMemo(
    () => orders.reduce((s, o) => s + (o.discountTotal ?? 0), 0),
    [orders]
  );
  const discCount = useMemo(
    () =>
      orders.filter((o) => !o.isVoided && (o.discountTotal ?? 0) > 0).length,
    [orders]
  );

  const paymentMethods = useMemo(
    () =>
      [
        { key: 'cash', label: 'Cash', amount: selected?.cashSales ?? 0 },
        { key: 'card', label: 'Card / POS', amount: selected?.cardSales ?? 0 },
        {
          key: 'bank_transfer',
          label: 'Bank Transfer',
          amount: selected?.transferSales ?? 0,
        },
        {
          key: 'mobile_money',
          label: 'Mobile Money',
          amount: selected?.mobileMoneySales ?? 0,
        },
        {
          key: 'split',
          label: 'Split',
          amount: (selected as any)?.splitSales ?? 0,
        },
      ].filter((m) => m.amount > 0),
    [selected]
  );

  const cashMoves = useMemo(() => selected?.cashMovements || [], [selected]);
  const cashIn = useMemo(
    () =>
      cashMoves
        .filter((m) => m.type === 'in')
        .reduce((s, m) => s + m.amount, 0),
    [cashMoves]
  );
  const cashOut = useMemo(
    () =>
      cashMoves
        .filter((m) => m.type === 'out')
        .reduce((s, m) => s + m.amount, 0),
    [cashMoves]
  );
  const methods = useMemo(
    () =>
      (selected?.methodBalances || []).filter(
        (m) => m.theoretical > 0 || (m.counted ?? 0) > 0
      ),
    [selected]
  );

  const hasDateFilter = dateFrom || dateTo;

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <POSNavHeader />

      <div
        className="flex flex-1 overflow-hidden"
        style={{ height: 'calc(100vh - 49px)' }}
      >
        {/* ── Left panel ── */}
        <div className="flex w-[300px] shrink-0 flex-col border-r border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-4 py-3">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-bold text-gray-900">Sessions</p>
              <button
                type="button"
                onClick={() => load(1)}
                disabled={loading}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-40"
              >
                <PiArrowsClockwise
                  className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}
                />
              </button>
            </div>

            {/* Status tabs */}
            <div className="mb-3 flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
              {(['all', 'open', 'closed'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={`flex-1 rounded-md py-1 text-xs font-semibold transition-all ${
                    statusFilter === s
                      ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200/60'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {s === 'all' ? 'All' : s === 'open' ? 'Open' : 'Closed'}
                </button>
              ))}
            </div>

            {/* Date range filter */}
            <div className="mb-3 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <PiCalendar className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  Date range
                </span>
                {hasDateFilter && (
                  <button
                    type="button"
                    onClick={() => {
                      setDateFrom('');
                      setDateTo('');
                    }}
                    className="ml-auto text-[10px] text-[#b20202] hover:underline"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="flex gap-1.5">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="flex-1 rounded-md border border-gray-200 bg-white px-2 py-1.5 text-[11px] text-gray-700 outline-none focus:border-[#b20202]"
                />
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="flex-1 rounded-md border border-gray-200 bg-white px-2 py-1.5 text-[11px] text-gray-700 outline-none focus:border-[#b20202]"
                />
              </div>
            </div>

            {/* Search */}
            <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5">
              <PiMagnifyingGlass className="h-3.5 w-3.5 shrink-0 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search sessions…"
                className="flex-1 bg-transparent text-xs text-gray-700 outline-none placeholder:text-gray-400"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="text-gray-300 hover:text-gray-500"
                >
                  <PiX className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          {/* Session list */}
          <div className="flex-1 overflow-y-auto">
            {!token && !loading ? (
              <div className="p-6 text-center">
                <p className="text-xs font-semibold text-red-500">
                  Session expired
                </p>
                <p className="mt-1 text-[10px] text-gray-400">
                  Please sign in again to continue.
                </p>
              </div>
            ) : loading ? (
              <div className="flex h-32 items-center justify-center">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-[#b20202]" />
              </div>
            ) : loadError ? (
              <div className="p-5">
                <p className="text-xs font-semibold text-red-500">
                  Failed to load sessions
                </p>
                <p className="mt-1 break-all text-[10px] text-gray-400">
                  {loadError}
                </p>
                <button
                  type="button"
                  onClick={() => load(1)}
                  className="mt-3 rounded-md border border-gray-200 px-3 py-1.5 text-[10px] font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Retry
                </button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-center text-xs text-gray-400">
                No sessions found
              </div>
            ) : (
              filtered.map((s) => (
                <SessionListRow
                  key={s._id}
                  session={s}
                  selected={selected?._id === s._id}
                  onClick={() => {
                    setSelected((prev) => (prev?._id === s._id ? null : s));
                    setActiveTab('report');
                  }}
                />
              ))
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex shrink-0 items-center justify-between border-t border-gray-100 px-3 py-2">
              <button
                type="button"
                onClick={() => load(page - 1)}
                disabled={page === 1 || loading}
                className="rounded border border-gray-200 p-1 text-gray-500 hover:bg-gray-50 disabled:opacity-40"
              >
                <PiCaretLeft className="h-3.5 w-3.5" />
              </button>
              <span className="text-xs text-gray-400">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => load(page + 1)}
                disabled={page === totalPages || loading}
                className="rounded border border-gray-200 p-1 text-gray-500 hover:bg-gray-50 disabled:opacity-40"
              >
                <PiCaretRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* ── Right panel ── */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {!selected ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
              <PiReceipt className="h-14 w-14 text-gray-200" />
              <p className="text-sm font-semibold text-gray-400">
                Select a session to view its report
              </p>
              <p className="text-xs text-gray-300">
                Choose a session from the left panel
              </p>
            </div>
          ) : (
            <div className="flex flex-1 flex-col overflow-hidden">
              {/* Toolbar */}
              <div className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-5 py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                        selected.status === 'open'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {selected.status === 'open' ? (
                        <>
                          <span className="h-1.5 w-1.5 animate-ping rounded-full bg-emerald-500" />
                          Open
                        </>
                      ) : (
                        'Closed'
                      )}
                    </span>
                    <span className="rounded border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                      {selected.terminalType || 'retail'}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {fmtDateTime(selected.openedAt)}
                    {selected.closedAt && (
                      <> → {fmtDateTime(selected.closedAt)}</>
                    )}
                    {' · '}
                    {staffName(selected.openedBy as any)}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {ordersLoading && (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-200 border-t-[#b20202]" />
                  )}
                  {activeTab === 'report' && (
                    <>
                      <button
                        type="button"
                        onClick={() => printSessionReport(selected, orders, storeName)}
                        className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
                      >
                        <PiPrinter className="h-3.5 w-3.5" />
                        Print
                      </button>
                      <button
                        type="button"
                        onClick={() => buildSessionReportPdf(selected, orders, storeName)}
                        className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#9a0101]"
                      >
                        <PiFilePdf className="h-3.5 w-3.5" />
                        PDF
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Tab bar */}
              <div className="flex shrink-0 border-b border-gray-200 bg-white px-5">
                {(
                  [
                    { key: 'report', label: 'Report', icon: PiFileText },
                    {
                      key: 'orders',
                      label:
                        orders.length > 0
                          ? `Orders (${orders.length})`
                          : 'Orders',
                      icon: PiListBullets,
                    },
                    { key: 'zreport', label: 'Z-Report', icon: PiChartBar },
                  ] as { key: Tab; label: string; icon: React.ElementType }[]
                ).map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
                      activeTab === tab.key
                        ? 'border-[#b20202] text-[#b20202]'
                        : 'border-transparent text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    <tab.icon className="h-3.5 w-3.5" />
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab body */}
              <div className="flex-1 overflow-y-auto bg-white">
                {activeTab === 'report' && (
                  <div className="mx-auto max-w-2xl px-6 py-6">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="border-b-2 border-t border-[#b20202] border-gray-200">
                          <th className="px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400"></th>
                          <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-gray-400">
                            Items
                          </th>
                          <th className="px-5 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-gray-400">
                            Amount
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b-2 border-gray-200">
                          <td className="px-5 py-3 text-sm font-bold text-gray-900">
                            Total
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-bold tabular-nums text-gray-700">
                            {itemsSold > 0
                              ? itemsSold.toLocaleString()
                              : ordersLoading
                                ? '—'
                                : orderCount.toLocaleString()}
                          </td>
                          <td className="px-5 py-3 text-right text-base font-extrabold tabular-nums text-[#b20202]">
                            {formatCurrency(totalSales)}
                          </td>
                        </tr>

                        <SectionHead label="Taxes on Sales" />
                        <DataRow
                          label="No Taxes"
                          mid="0.00"
                          right={formatCurrency(totalSales)}
                        />
                        <DataRow
                          label="Total"
                          mid="0.00"
                          right={formatCurrency(totalSales)}
                          bold
                        />

                        <tr>
                          <td colSpan={3} className="pt-1" />
                        </tr>
                        <SectionHead label="Payments" />
                        {paymentMethods.map((m) => (
                          <DataRow
                            key={m.key}
                            label={m.label}
                            right={formatCurrency(m.amount)}
                          />
                        ))}
                        {paymentMethods.length === 0 && (
                          <tr className="border-b border-gray-50">
                            <td
                              colSpan={3}
                              className="px-5 py-2 text-xs text-gray-400"
                            >
                              No payment data recorded
                            </td>
                          </tr>
                        )}
                        <DataRow
                          label="Total"
                          right={formatCurrency(totalSales)}
                          bold
                          rightColor="text-[#b20202]"
                        />

                        <tr>
                          <td colSpan={3} className="pt-1" />
                        </tr>
                        <SectionHead label="Discounts" />
                        <tr className="border-b border-gray-50">
                          <td
                            colSpan={2}
                            className="px-5 py-2 text-sm text-gray-500"
                          >
                            Number of discounts:
                          </td>
                          <td className="px-5 py-2 text-right text-sm text-gray-800">
                            {ordersLoading ? (
                              <span className="animate-pulse text-gray-300">
                                —
                              </span>
                            ) : (
                              discCount.toLocaleString()
                            )}
                          </td>
                        </tr>
                        <tr className="border-b border-gray-50">
                          <td
                            colSpan={2}
                            className="px-5 py-2 text-sm text-gray-500"
                          >
                            Amount of discounts:
                          </td>
                          <td
                            className={`px-5 py-2 text-right text-sm tabular-nums ${totalDiscount > 0 ? 'font-semibold text-orange-600' : 'text-gray-800'}`}
                          >
                            {ordersLoading ? (
                              <span className="animate-pulse text-gray-300">
                                —
                              </span>
                            ) : (
                              formatCurrency(totalDiscount)
                            )}
                          </td>
                        </tr>

                        <tr>
                          <td colSpan={3} className="pt-1" />
                        </tr>
                        <SectionHead label="Session Control" />
                        <tr className="border-b border-gray-50">
                          <td
                            colSpan={2}
                            className="px-5 py-2 text-sm text-gray-500"
                          >
                            Total:
                          </td>
                          <td className="px-5 py-2 text-right text-sm font-bold tabular-nums text-[#b20202]">
                            {formatCurrency(totalSales)}
                          </td>
                        </tr>
                        <DataRow
                          label="Opening Cash:"
                          right={formatCurrency(selected.openingCash || 0)}
                        />
                        {cashIn > 0 && (
                          <tr className="border-b border-gray-50">
                            <td
                              colSpan={2}
                              className="px-5 py-2 text-sm text-gray-500"
                            >
                              Cash In:
                            </td>
                            <td className="px-5 py-2 text-right text-sm font-medium tabular-nums text-emerald-600">
                              +{formatCurrency(cashIn)}
                            </td>
                          </tr>
                        )}
                        {cashOut > 0 && (
                          <tr className="border-b border-gray-50">
                            <td
                              colSpan={2}
                              className="px-5 py-2 text-sm text-gray-500"
                            >
                              Cash Out:
                            </td>
                            <td className="px-5 py-2 text-right text-sm font-medium tabular-nums text-red-500">
                              −{formatCurrency(cashOut)}
                            </td>
                          </tr>
                        )}
                        <tr className="border-b border-gray-50">
                          <td
                            colSpan={2}
                            className="px-5 py-2 text-sm text-gray-500"
                          >
                            Number of transactions:
                          </td>
                          <td className="px-5 py-2 text-right text-sm tabular-nums text-gray-800">
                            {orderCount.toLocaleString()}
                          </td>
                        </tr>
                        <DataRow
                          label="Duration:"
                          right={duration(selected.openedAt, selected.closedAt)}
                        />

                        {methods.length > 0 && selected.status === 'closed' && (
                          <>
                            <tr>
                              <td colSpan={3} className="pt-1" />
                            </tr>
                            <SectionHead label="Cash Balance" />
                            <tr className="border-b border-gray-100">
                              <td className="px-5 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                                Method
                              </td>
                              <td className="px-4 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-gray-400">
                                Expected
                              </td>
                              <td className="px-5 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-gray-400">
                                Counted
                              </td>
                            </tr>
                            {methods.map((m) => {
                              const counted = m.counted ?? m.theoretical;
                              const diff = counted - m.theoretical;
                              const hasDiff = Math.abs(diff) > 0.01;
                              return (
                                <tr
                                  key={m.method}
                                  className={`border-b border-gray-50 ${hasDiff ? 'bg-red-50' : ''}`}
                                >
                                  <td className="px-5 py-2 text-sm text-gray-700">
                                    {METHOD_LABELS[m.method] ?? m.method}
                                  </td>
                                  <td className="px-4 py-2 text-right text-sm tabular-nums text-gray-500">
                                    {formatCurrency(m.theoretical)}
                                  </td>
                                  <td className="px-5 py-2 text-right text-sm tabular-nums">
                                    <span
                                      className={
                                        hasDiff
                                          ? 'font-semibold text-red-600'
                                          : 'text-gray-800'
                                      }
                                    >
                                      {formatCurrency(counted)}
                                    </span>
                                    {hasDiff && (
                                      <span
                                        className={`ml-1.5 text-[10px] font-bold ${diff > 0 ? 'text-emerald-600' : 'text-red-600'}`}
                                      >
                                        ({diff > 0 ? '+' : ''}
                                        {formatCurrency(diff)})
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </>
                        )}

                        {cashMoves.length > 0 && (
                          <>
                            <tr>
                              <td colSpan={3} className="pt-1" />
                            </tr>
                            <SectionHead label="Cash Movements" />
                            {cashMoves.map((m, i) => (
                              <tr key={i} className="border-b border-gray-50">
                                <td className="px-5 py-2 text-sm text-gray-500">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`inline-flex h-4 w-4 items-center justify-center rounded-full ${m.type === 'in' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-500'}`}
                                    >
                                      {m.type === 'in' ? (
                                        <PiArrowDown className="h-2.5 w-2.5" />
                                      ) : (
                                        <PiArrowUp className="h-2.5 w-2.5" />
                                      )}
                                    </span>
                                    {m.reason ||
                                      (m.type === 'in'
                                        ? 'Cash In'
                                        : 'Cash Out')}
                                  </div>
                                </td>
                                <td className="px-4 py-2 text-right text-xs text-gray-400">
                                  {fmtTime((m as any).performedAt)}
                                </td>
                                <td
                                  className={`px-5 py-2 text-right text-sm font-semibold tabular-nums ${m.type === 'in' ? 'text-emerald-600' : 'text-red-500'}`}
                                >
                                  {m.type === 'in' ? '+' : '−'}
                                  {formatCurrency(m.amount)}
                                </td>
                              </tr>
                            ))}
                          </>
                        )}

                        <CashierLogSection session={selected} />

                        {(selected.closingNotes || selected.notes) && (
                          <>
                            <tr>
                              <td colSpan={3} className="pt-1" />
                            </tr>
                            <SectionHead label="Notes" />
                            <tr>
                              <td
                                colSpan={3}
                                className="px-5 py-3 text-sm leading-relaxed text-gray-600"
                              >
                                {selected.closingNotes || selected.notes}
                              </td>
                            </tr>
                          </>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {activeTab === 'orders' &&
                  (ordersError ? (
                    <div className="p-8 text-center">
                      <p className="text-xs font-semibold text-red-500">
                        Failed to load orders
                      </p>
                      <p className="mt-1 break-all text-[10px] text-gray-400">
                        {ordersError}
                      </p>
                    </div>
                  ) : (
                    <OrdersTab orders={orders} loading={ordersLoading} />
                  ))}

                {activeTab === 'zreport' && (
                  <ZReportTab
                    session={selected}
                    orders={orders}
                    loading={ordersLoading}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
