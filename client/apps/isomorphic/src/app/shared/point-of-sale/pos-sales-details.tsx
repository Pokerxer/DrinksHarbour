'use client';

import {
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import {
  PiArrowsClockwise,
  PiCurrencyNgn,
  PiShoppingCart,
  PiTag,
  PiArrowUp,
  PiArrowDown,
  PiArrowsDownUp,
  PiDownloadSimple,
  PiX,
  PiMagnifyingGlass,
  PiCaretLeft,
  PiCaretRight,
  PiCaretDown,
  PiPercent,
  PiTrendUp,
  PiList,
  PiRows,
  PiClock,
  PiFileCsv,
  PiFileXls,
  PiFilePdf,
} from 'react-icons/pi';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { usePOSAuth } from '@/app/shared/point-of-sale/store';
import { useTenant } from '@/context/TenantContext';
import { posApi } from '@/app/shared/point-of-sale/api';
import { formatCurrency } from '@/app/shared/point-of-sale/utils';
import POSNavHeader from '@/app/shared/point-of-sale/pos-nav-header';

// ── Types ──────────────────────────────────────────────────────────────────────

interface OrderItem {
  name: string;
  variant?: string;
  quantity: number;
  priceAtPurchase: number;
  itemSubtotal: number;
  discountAmount?: number;
  sizeCostPrice?: number;
  category?: string;
  subcategory?: string;
  brand?: string;
  warehouse?: { _id: string; name: string; code: string } | null;
}

interface PosOrder {
  _id: string;
  orderNumber?: string;
  receiptNumber?: string;
  total: number;
  subtotal?: number;
  discountTotal?: number;
  paymentMethod: string;
  paymentStatus?: string;
  status?: string;
  isVoided?: boolean;
  placedAt: string;
  createdAt: string;
  posStaff?: { firstName: string; lastName: string; posName?: string };
  customer?: { firstName?: string; lastName?: string; phone?: string } | null;
  items?: OrderItem[];
}

interface LineRow {
  orderId: string;
  orderNumber: string;
  receiptNumber: string;
  date: string;
  cashier: string;
  product: string;
  variant: string;
  category: string;
  subcategory: string;
  brand: string;
  qty: number;
  unitPrice: number;
  discount: number;
  subtotal: number;
  gross: number;
  costPrice: number;
  profit: number;
  paymentMethod: string;
  isVoided: boolean;
  warehouse: string;
}

type LineSortField = keyof Pick<
  LineRow,
  | 'date'
  | 'orderNumber'
  | 'cashier'
  | 'product'
  | 'variant'
  | 'category'
  | 'subcategory'
  | 'brand'
  | 'qty'
  | 'unitPrice'
  | 'discount'
  | 'subtotal'
  | 'gross'
  | 'profit'
  | 'paymentMethod'
>;

interface GroupRow {
  key: string;
  qty: number;
  gross: number;
  discount: number;
  revenue: number;
  profit: number;
  lineCount: number;
  orderCount: number;
  share: number;
}

type GroupSortField =
  | 'key'
  | 'qty'
  | 'revenue'
  | 'gross'
  | 'discount'
  | 'profit'
  | 'lineCount'
  | 'orderCount'
  | 'share';
type GroupByKey =
  | 'product'
  | 'cashier'
  | 'payment_method'
  | 'date'
  | 'variant'
  | 'warehouse';
type ViewMode = 'lines' | 'grouped';
type StatusFilter = 'all' | 'active' | 'voided';
type ToggleableCol =
  | 'orderNumber'
  | 'cashier'
  | 'variant'
  | 'category'
  | 'subcategory'
  | 'brand'
  | 'unitPrice'
  | 'gross'
  | 'discount'
  | 'payment';

const PAGE_SIZE = 50;
const GROUP_PAGE_SIZE = 30;

// ── Constants ──────────────────────────────────────────────────────────────────

const METHOD_LABEL: Record<string, string> = {
  cash: 'Cash',
  card: 'Card/POS',
  bank_transfer: 'Bank Transfer',
  mobile_money: 'Mobile Money',
  split: 'Split',
  other: 'Other',
};

const METHOD_COLOR: Record<string, string> = {
  cash: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
  card: 'bg-blue-50 text-blue-700 border border-blue-100',
  bank_transfer: 'bg-violet-50 text-violet-700 border border-violet-100',
  mobile_money: 'bg-amber-50 text-amber-700 border border-amber-100',
  split: 'bg-orange-50 text-orange-700 border border-orange-100',
  other: 'bg-gray-100 text-gray-600 border border-gray-200',
};

const METHOD_DOT: Record<string, string> = {
  cash: 'bg-emerald-500',
  card: 'bg-blue-500',
  bank_transfer: 'bg-violet-500',
  mobile_money: 'bg-amber-500',
  split: 'bg-orange-500',
  other: 'bg-gray-400',
};

const TOGGLEABLE_COLS: {
  key: ToggleableCol;
  label: string;
  defaultHidden?: boolean;
}[] = [
  { key: 'orderNumber', label: 'Order #' },
  { key: 'cashier', label: 'Cashier' },
  { key: 'variant', label: 'Variant' },
  { key: 'category', label: 'Category', defaultHidden: true },
  { key: 'subcategory', label: 'Subcategory', defaultHidden: true },
  { key: 'brand', label: 'Brand', defaultHidden: true },
  { key: 'unitPrice', label: 'Unit Price' },
  { key: 'gross', label: 'Gross Rev.' },
  { key: 'discount', label: 'Discount' },
  { key: 'payment', label: 'Payment' },
];

// ── Export column definitions ───────────────────────────────────────────────────

type LineExportCol =
  | 'date'
  | 'order'
  | 'receipt'
  | 'cashier'
  | 'product'
  | 'variant'
  | 'category'
  | 'subcategory'
  | 'brand'
  | 'qty'
  | 'unitPrice'
  | 'gross'
  | 'discount'
  | 'net'
  | 'cost'
  | 'profit'
  | 'margin'
  | 'payment'
  | 'voided';

type GroupExportCol =
  | 'key'
  | 'qty'
  | 'gross'
  | 'discount'
  | 'revenue'
  | 'profit'
  | 'margin'
  | 'share'
  | 'lineCount'
  | 'orderCount';

const LINE_EXPORT_COLS: {
  key: LineExportCol;
  label: string;
  required?: boolean;
  costOnly?: boolean;
  pdfW: number;
  pdfAlign: 'left' | 'right';
}[] = [
  {
    key: 'date',
    label: 'Date/Time',
    required: true,
    pdfW: 28,
    pdfAlign: 'left',
  },
  { key: 'order', label: 'Order #', pdfW: 18, pdfAlign: 'left' },
  { key: 'receipt', label: 'Receipt #', pdfW: 16, pdfAlign: 'left' },
  { key: 'cashier', label: 'Cashier', pdfW: 22, pdfAlign: 'left' },
  {
    key: 'product',
    label: 'Product',
    required: true,
    pdfW: 34,
    pdfAlign: 'left',
  },
  { key: 'variant', label: 'Variant', pdfW: 18, pdfAlign: 'left' },
  { key: 'category', label: 'Category', pdfW: 20, pdfAlign: 'left' },
  { key: 'subcategory', label: 'Subcategory', pdfW: 20, pdfAlign: 'left' },
  { key: 'brand', label: 'Brand', pdfW: 18, pdfAlign: 'left' },
  { key: 'qty', label: 'Qty', required: true, pdfW: 10, pdfAlign: 'right' },
  { key: 'unitPrice', label: 'Unit Price', pdfW: 20, pdfAlign: 'right' },
  { key: 'gross', label: 'Gross Revenue', pdfW: 20, pdfAlign: 'right' },
  { key: 'discount', label: 'Discount', pdfW: 18, pdfAlign: 'right' },
  {
    key: 'net',
    label: 'Net Total',
    required: true,
    pdfW: 22,
    pdfAlign: 'right',
  },
  {
    key: 'cost',
    label: 'Cost Price',
    costOnly: true,
    pdfW: 18,
    pdfAlign: 'right',
  },
  {
    key: 'profit',
    label: 'Profit',
    costOnly: true,
    pdfW: 18,
    pdfAlign: 'right',
  },
  {
    key: 'margin',
    label: 'Margin %',
    costOnly: true,
    pdfW: 16,
    pdfAlign: 'right',
  },
  { key: 'payment', label: 'Payment', pdfW: 20, pdfAlign: 'left' },
  { key: 'voided', label: 'Voided', pdfW: 12, pdfAlign: 'left' },
];

const GROUP_EXPORT_COLS: {
  key: GroupExportCol;
  label: string;
  required?: boolean;
  costOnly?: boolean;
  pdfW: number;
  pdfAlign: 'left' | 'right';
}[] = [
  { key: 'key', label: 'Group', required: true, pdfW: 50, pdfAlign: 'left' },
  { key: 'qty', label: 'Qty Sold', pdfW: 16, pdfAlign: 'right' },
  { key: 'gross', label: 'Gross Revenue', pdfW: 26, pdfAlign: 'right' },
  { key: 'discount', label: 'Discount', pdfW: 24, pdfAlign: 'right' },
  {
    key: 'revenue',
    label: 'Net Revenue',
    required: true,
    pdfW: 26,
    pdfAlign: 'right',
  },
  {
    key: 'profit',
    label: 'Profit',
    costOnly: true,
    pdfW: 24,
    pdfAlign: 'right',
  },
  {
    key: 'margin',
    label: 'Margin %',
    costOnly: true,
    pdfW: 18,
    pdfAlign: 'right',
  },
  { key: 'share', label: 'Revenue Share %', pdfW: 16, pdfAlign: 'right' },
  { key: 'lineCount', label: 'Line Count', pdfW: 14, pdfAlign: 'right' },
  { key: 'orderCount', label: 'Distinct Orders', pdfW: 14, pdfAlign: 'right' },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function isTokenExpired(tok: string | null | undefined): boolean {
  if (!tok) return true;
  try {
    const payload = JSON.parse(atob(tok.split('.')[1]));
    return (payload.exp ?? 0) * 1000 < Date.now();
  } catch {
    return true;
  }
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function fmtDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function toTs(date: string, time: string): number {
  if (!date) return 0;
  return new Date(`${date}T${time || '00:00'}:00`).getTime();
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function offsetDay(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function startOfWeek() {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().slice(0, 10);
}
function startOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
function startOfLastMonth() {
  return new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1)
    .toISOString()
    .slice(0, 10);
}
function endOfLastMonth() {
  return new Date(new Date().getFullYear(), new Date().getMonth(), 0)
    .toISOString()
    .slice(0, 10);
}

const DATE_PRESETS = [
  {
    label: 'Today',
    from: () => todayStr(),
    to: () => todayStr(),
    tf: '00:00',
    tt: '23:59',
  },
  {
    label: 'Yesterday',
    from: () => offsetDay(-1),
    to: () => offsetDay(-1),
    tf: '00:00',
    tt: '23:59',
  },
  {
    label: 'Last 7 days',
    from: () => offsetDay(-6),
    to: () => todayStr(),
    tf: '00:00',
    tt: '23:59',
  },
  {
    label: 'This week',
    from: () => startOfWeek(),
    to: () => todayStr(),
    tf: '00:00',
    tt: '23:59',
  },
  {
    label: 'This month',
    from: () => startOfMonth(),
    to: () => todayStr(),
    tf: '00:00',
    tt: '23:59',
  },
  {
    label: 'Last month',
    from: () => startOfLastMonth(),
    to: () => endOfLastMonth(),
    tf: '00:00',
    tt: '23:59',
  },
];

// ── Export cell helpers ────────────────────────────────────────────────────────

function getLineCell(
  r: LineRow,
  key: LineExportCol,
  fmt: 'csv' | 'pdf'
): string {
  const q = (s: string) => (fmt === 'csv' ? `"${s.replace(/"/g, '""')}"` : s);
  switch (key) {
    case 'date':
      return fmtDateTime(r.date);
    case 'order':
      return fmt === 'pdf'
        ? r.isVoided
          ? `${r.orderNumber} [VOID]`
          : r.orderNumber
        : r.orderNumber;
    case 'receipt':
      return r.receiptNumber;
    case 'cashier':
      return q(r.cashier);
    case 'product':
      return q(r.product);
    case 'variant':
      return q(r.variant || (fmt === 'pdf' ? '—' : ''));
    case 'category':
      return q(r.category || (fmt === 'pdf' ? '—' : ''));
    case 'subcategory':
      return q(r.subcategory || (fmt === 'pdf' ? '—' : ''));
    case 'brand':
      return q(r.brand || (fmt === 'pdf' ? '—' : ''));
    case 'qty':
      return r.qty.toString();
    case 'unitPrice':
      return r.unitPrice.toFixed(2);
    case 'gross':
      return r.gross.toFixed(2);
    case 'discount':
      return fmt === 'pdf'
        ? r.discount > 0
          ? r.discount.toFixed(2)
          : '—'
        : r.discount.toFixed(2);
    case 'net':
      return r.subtotal.toFixed(2);
    case 'cost':
      return fmt === 'pdf'
        ? r.costPrice > 0
          ? r.costPrice.toFixed(2)
          : '—'
        : r.costPrice.toFixed(2);
    case 'profit':
      return fmt === 'pdf'
        ? r.profit > 0
          ? r.profit.toFixed(2)
          : '—'
        : r.profit.toFixed(2);
    case 'margin': {
      const m =
        r.profit > 0 && r.subtotal > 0
          ? ((r.profit / r.subtotal) * 100).toFixed(1)
          : null;
      return m ? m + '%' : fmt === 'pdf' ? '—' : '0';
    }
    case 'payment':
      return METHOD_LABEL[r.paymentMethod] ?? r.paymentMethod;
    case 'voided':
      return r.isVoided ? 'Yes' : 'No';
    default:
      return '';
  }
}

function getLineCellExcel(r: LineRow, key: LineExportCol): string | number {
  switch (key) {
    case 'date':
      return fmtDateTime(r.date);
    case 'order':
      return r.orderNumber;
    case 'receipt':
      return r.receiptNumber;
    case 'cashier':
      return r.cashier;
    case 'product':
      return r.product;
    case 'variant':
      return r.variant;
    case 'category':
      return r.category;
    case 'subcategory':
      return r.subcategory;
    case 'brand':
      return r.brand;
    case 'qty':
      return r.qty;
    case 'unitPrice':
      return r.unitPrice;
    case 'gross':
      return r.gross;
    case 'discount':
      return r.discount;
    case 'net':
      return r.subtotal;
    case 'cost':
      return r.costPrice;
    case 'profit':
      return r.profit;
    case 'margin':
      return r.profit > 0 && r.subtotal > 0
        ? +((r.profit / r.subtotal) * 100).toFixed(1)
        : 0;
    case 'payment':
      return METHOD_LABEL[r.paymentMethod] ?? r.paymentMethod;
    case 'voided':
      return r.isVoided ? 'Yes' : 'No';
    default:
      return '';
  }
}

function getGroupCell(
  r: GroupRow,
  key: GroupExportCol,
  fmt: 'csv' | 'pdf'
): string {
  const mg =
    r.profit > 0 && r.revenue > 0
      ? ((r.profit / r.revenue) * 100).toFixed(1)
      : null;
  switch (key) {
    case 'key':
      return fmt === 'csv' ? `"${r.key.replace(/"/g, '""')}"` : r.key;
    case 'qty':
      return r.qty.toLocaleString();
    case 'gross':
      return r.gross.toFixed(2);
    case 'discount':
      return fmt === 'pdf' && r.discount === 0 ? '—' : r.discount.toFixed(2);
    case 'revenue':
      return r.revenue.toFixed(2);
    case 'profit':
      return fmt === 'pdf' && r.profit === 0 ? '—' : r.profit.toFixed(2);
    case 'margin':
      return mg ? mg + '%' : fmt === 'pdf' ? '—' : '0';
    case 'share':
      return r.share.toFixed(1) + '%';
    case 'lineCount':
      return r.lineCount.toLocaleString();
    case 'orderCount':
      return r.orderCount.toLocaleString();
    default:
      return '';
  }
}

function getGroupCellExcel(r: GroupRow, key: GroupExportCol): string | number {
  const mg =
    r.profit > 0 && r.revenue > 0
      ? +((r.profit / r.revenue) * 100).toFixed(1)
      : 0;
  switch (key) {
    case 'key':
      return r.key;
    case 'qty':
      return r.qty;
    case 'gross':
      return r.gross;
    case 'discount':
      return r.discount;
    case 'revenue':
      return r.revenue;
    case 'profit':
      return r.profit;
    case 'margin':
      return mg;
    case 'share':
      return +r.share.toFixed(1);
    case 'lineCount':
      return r.lineCount;
    case 'orderCount':
      return r.orderCount;
    default:
      return '';
  }
}

// ── CSV ────────────────────────────────────────────────────────────────────────

function triggerCsvDownload(csv: string, name: string) {
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportLineCsv(rows: LineRow[], cols: Set<LineExportCol>) {
  const defs = LINE_EXPORT_COLS.filter((c) => cols.has(c.key));
  const header = defs.map((c) => c.label).join(',');
  const lines = rows.map((r) =>
    defs.map((c) => getLineCell(r, c.key, 'csv')).join(',')
  );
  triggerCsvDownload([header, ...lines].join('\n'), 'sales-details');
}

function exportGroupedCsv(
  rows: GroupRow[],
  groupLabel: string,
  cols: Set<GroupExportCol>
) {
  const defs = GROUP_EXPORT_COLS.filter((c) => cols.has(c.key));
  const header = defs
    .map((c) => (c.key === 'key' ? groupLabel : c.label))
    .join(',');
  const lines = rows.map((r) =>
    defs.map((c) => getGroupCell(r, c.key, 'csv')).join(',')
  );
  triggerCsvDownload([header, ...lines].join('\n'), 'sales-grouped');
}

// ── Excel ──────────────────────────────────────────────────────────────────────

function exportLineExcel(rows: LineRow[], cols: Set<LineExportCol>) {
  const defs = LINE_EXPORT_COLS.filter((c) => cols.has(c.key));
  const headers = defs.map((c) => c.label);
  const data = rows.map((r) => defs.map((c) => getLineCellExcel(r, c.key)));
  const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sales Details');
  XLSX.writeFile(
    wb,
    `sales-details-${new Date().toISOString().slice(0, 10)}.xlsx`
  );
}

function exportGroupedExcel(
  rows: GroupRow[],
  groupLabel: string,
  cols: Set<GroupExportCol>
) {
  const defs = GROUP_EXPORT_COLS.filter((c) => cols.has(c.key));
  const headers = defs.map((c) => (c.key === 'key' ? groupLabel : c.label));
  const data = rows.map((r) => defs.map((c) => getGroupCellExcel(r, c.key)));
  const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sales Grouped');
  XLSX.writeFile(
    wb,
    `sales-grouped-${new Date().toISOString().slice(0, 10)}.xlsx`
  );
}

// ── PDF ────────────────────────────────────────────────────────────────────────

const BRAND_RGB: [number, number, number] = [178, 2, 2];
const GRAY_DARK: [number, number, number] = [31, 41, 55];
const GRAY_MED: [number, number, number] = [107, 114, 128];
const GRAY_LIGHT: [number, number, number] = [243, 244, 246];
const TEAL_RGB: [number, number, number] = [13, 148, 136];
const ORANGE_RGB: [number, number, number] = [217, 70, 0];
const GREEN_RGB: [number, number, number] = [22, 101, 52];
const RED_PALE: [number, number, number] = [254, 249, 249];
const WHITE_RGB: [number, number, number] = [255, 255, 255];

interface PdfMeta {
  dateFrom: string;
  dateTo: string;
  timeFrom: string;
  timeTo: string;
  cashierFilter: string;
  methodFilter: string;
  statusFilter: StatusFilter;
  storeName: string;
  summary: {
    gross: number;
    revenue: number;
    discount: number;
    items: number;
    orders: number;
    profit: number;
    avgOrder: number;
  };
}

function drawPdf1Header(
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

function drawPdfMiniHeader(doc: jsPDF, title: string, pageW: number, storeName: string) {
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

function addPdfPageFooters(doc: jsPDF, subtitle: string, storeName: string) {
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
function drawPdfSummarySection(
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

  // Payments
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

  // Discounts
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

  // Sales Summary
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

function exportLinePdf(
  rows: LineRow[],
  hasCost: boolean,
  meta: PdfMeta,
  selectedCols: Set<LineExportCol>
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const MARGIN = 12;
  const AVAIL = pageW - 2 * MARGIN;

  const hasCategory = rows.some((r) => !!r.category);
  const hasSubcategory = rows.some((r) => !!r.subcategory);
  const hasBrand = rows.some((r) => !!r.brand);

  const defs = LINE_EXPORT_COLS.filter((c) => {
    if (!selectedCols.has(c.key)) return false;
    if (c.costOnly && !hasCost) return false;
    if (c.key === 'category' && !hasCategory) return false;
    if (c.key === 'subcategory' && !hasSubcategory) return false;
    if (c.key === 'brand' && !hasBrand) return false;
    return true;
  });

  const totalBaseW = defs.reduce((s, c) => s + c.pdfW, 0);
  const scale = AVAIL / totalBaseW;
  const colStyles: Record<number, object> = {};
  defs.forEach((c, i) => {
    colStyles[i] = {
      halign: c.pdfAlign,
      cellWidth: +(c.pdfW * scale).toFixed(1),
    };
  });

  const netIdx = defs.findIndex((c) => c.key === 'net');
  const discIdx = defs.findIndex((c) => c.key === 'discount');
  const profitIdx = defs.findIndex((c) => c.key === 'profit');

  const body = rows.map((r) => defs.map((c) => getLineCell(r, c.key, 'pdf')));

  const totalsRow = defs.map((c) => {
    switch (c.key) {
      case 'date':
        return `${rows.length.toLocaleString()} lines`;
      case 'qty':
        return rows.reduce((s, r) => s + r.qty, 0).toLocaleString();
      case 'gross':
        return rows.reduce((s, r) => s + r.gross, 0).toFixed(2);
      case 'discount':
        return rows.reduce((s, r) => s + r.discount, 0).toFixed(2);
      case 'net':
        return rows.reduce((s, r) => s + r.subtotal, 0).toFixed(2);
      case 'cost':
        return rows.reduce((s, r) => s + r.costPrice, 0).toFixed(2);
      case 'profit':
        return rows.reduce((s, r) => s + r.profit, 0).toFixed(2);
      default:
        return '';
    }
  });

  const startY = drawPdf1Header(
    doc,
    'SALES DETAILS',
    `${rows.length.toLocaleString()} line items`,
    meta,
    pageW
  );

  autoTable(doc, {
    head: [defs.map((c) => c.label)],
    body,
    foot: [totalsRow],
    startY,
    margin: { left: MARGIN, right: MARGIN, bottom: 14, top: 10 },
    styles: {
      fontSize: 6.5,
      cellPadding: { top: 1.8, bottom: 1.8, left: 2, right: 2 },
      overflow: 'ellipsize',
      textColor: GRAY_DARK,
      font: 'helvetica',
    },
    headStyles: {
      fillColor: BRAND_RGB,
      textColor: WHITE_RGB,
      fontStyle: 'bold',
      fontSize: 7,
    },
    footStyles: {
      fillColor: GRAY_LIGHT,
      textColor: GRAY_DARK,
      fontStyle: 'bold',
      fontSize: 6.5,
    },
    alternateRowStyles: { fillColor: RED_PALE },
    columnStyles: colStyles,
    showHead: 'everyPage',
    showFoot: 'lastPage',
    willDrawPage: (data) => {
      if (data.pageNumber > 1) drawPdfMiniHeader(doc, 'Sales Details', pageW, meta.storeName);
    },
    didParseCell: (data) => {
      if (data.section === 'foot') {
        if (netIdx >= 0 && data.column.index === netIdx)
          data.cell.styles.textColor = BRAND_RGB;
        return;
      }
      if (data.section !== 'body') return;
      const r = rows[data.row.index];
      if (!r) return;
      if (r.isVoided) {
        data.cell.styles.textColor = [180, 180, 180] as [
          number,
          number,
          number,
        ];
        data.cell.styles.fontStyle = 'italic';
        return;
      }
      if (netIdx >= 0 && data.column.index === netIdx) {
        data.cell.styles.textColor = BRAND_RGB;
        data.cell.styles.fontStyle = 'bold';
      } else if (
        discIdx >= 0 &&
        data.column.index === discIdx &&
        r.discount > 0
      )
        data.cell.styles.textColor = ORANGE_RGB;
      else if (
        profitIdx >= 0 &&
        data.column.index === profitIdx &&
        r.profit > 0
      )
        data.cell.styles.textColor = TEAL_RGB;
    },
  });

  const tableEndY = (doc as any).lastAutoTable?.finalY ?? startY + 100;
  drawPdfSummarySection(
    doc,
    rows,
    meta,
    tableEndY,
    pageW,
    MARGIN,
    'Sales Details'
  );
  addPdfPageFooters(doc, 'Sales Details Report', meta.storeName);
  doc.save(`sales-details-${new Date().toISOString().slice(0, 10)}.pdf`);
}

function exportGroupedPdf(
  rows: GroupRow[],
  groupLabel: string,
  hasCost: boolean,
  meta: PdfMeta,
  selectedCols: Set<GroupExportCol>
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const MARGIN = 12;
  const AVAIL = pageW - 2 * MARGIN;

  const defs = GROUP_EXPORT_COLS.filter(
    (c) => selectedCols.has(c.key) && (hasCost || !c.costOnly)
  );

  const totalBaseW = defs.reduce((s, c) => s + c.pdfW, 0);
  const scale = AVAIL / totalBaseW;
  const colStyles: Record<number, object> = {};
  defs.forEach((c, i) => {
    colStyles[i] = {
      halign: c.pdfAlign,
      cellWidth: +(c.pdfW * scale).toFixed(1),
    };
  });

  const revIdx = defs.findIndex((c) => c.key === 'revenue');
  const discIdx = defs.findIndex((c) => c.key === 'discount');
  const profitIdx = defs.findIndex((c) => c.key === 'profit');

  const headers = defs.map((c) => (c.key === 'key' ? groupLabel : c.label));
  const body = rows.map((r) => defs.map((c) => getGroupCell(r, c.key, 'pdf')));

  const totalsRow = defs.map((c) => {
    switch (c.key) {
      case 'key':
        return `${rows.length} groups`;
      case 'qty':
        return rows.reduce((s, r) => s + r.qty, 0).toLocaleString();
      case 'gross':
        return rows.reduce((s, r) => s + r.gross, 0).toFixed(2);
      case 'discount':
        return rows.reduce((s, r) => s + r.discount, 0).toFixed(2);
      case 'revenue':
        return rows.reduce((s, r) => s + r.revenue, 0).toFixed(2);
      case 'profit':
        return rows.reduce((s, r) => s + r.profit, 0).toFixed(2);
      case 'share':
        return '100%';
      case 'lineCount':
        return rows.reduce((s, r) => s + r.lineCount, 0).toLocaleString();
      default:
        return '';
    }
  });

  const startY = drawPdf1Header(
    doc,
    `SALES — BY ${groupLabel.toUpperCase()}`,
    `${rows.length.toLocaleString()} groups`,
    meta,
    pageW
  );

  autoTable(doc, {
    head: [headers],
    body,
    foot: [totalsRow],
    startY,
    margin: { left: MARGIN, right: MARGIN, bottom: 14, top: 10 },
    styles: {
      fontSize: 8,
      cellPadding: { top: 2.2, bottom: 2.2, left: 2.5, right: 2.5 },
      overflow: 'ellipsize',
      textColor: GRAY_DARK,
      font: 'helvetica',
    },
    headStyles: {
      fillColor: BRAND_RGB,
      textColor: WHITE_RGB,
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    footStyles: {
      fillColor: GRAY_LIGHT,
      textColor: GRAY_DARK,
      fontStyle: 'bold',
    },
    alternateRowStyles: { fillColor: RED_PALE },
    columnStyles: colStyles,
    showHead: 'everyPage',
    showFoot: 'lastPage',
    willDrawPage: (data) => {
      if (data.pageNumber > 1)
        drawPdfMiniHeader(doc, `Sales — by ${groupLabel}`, pageW, meta.storeName);
    },
    didParseCell: (data) => {
      if (data.section === 'foot') {
        if (revIdx >= 0 && data.column.index === revIdx)
          data.cell.styles.textColor = BRAND_RGB;
        return;
      }
      if (data.section !== 'body') return;
      const r = rows[data.row.index];
      if (!r) return;
      if (revIdx >= 0 && data.column.index === revIdx) {
        data.cell.styles.textColor = BRAND_RGB;
        data.cell.styles.fontStyle = 'bold';
      } else if (
        discIdx >= 0 &&
        data.column.index === discIdx &&
        r.discount > 0
      )
        data.cell.styles.textColor = ORANGE_RGB;
      else if (
        profitIdx >= 0 &&
        data.column.index === profitIdx &&
        r.profit > 0
      )
        data.cell.styles.textColor = TEAL_RGB;
    },
  });

  const tableEndY = (doc as any).lastAutoTable?.finalY ?? startY + 100;
  drawPdfSummarySection(
    doc,
    null,
    meta,
    tableEndY,
    pageW,
    MARGIN,
    `Sales — by ${groupLabel}`
  );
  addPdfPageFooters(doc, `Sales Report — by ${groupLabel}`, meta.storeName);
  doc.save(`sales-grouped-${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SortChevron({
  active,
  dir,
}: {
  active: boolean;
  dir: 'asc' | 'desc';
}) {
  if (!active) return <PiArrowsDownUp className="h-3 w-3 text-gray-300" />;
  return dir === 'asc' ? (
    <PiArrowUp className="h-3 w-3 text-[#b20202]" />
  ) : (
    <PiArrowDown className="h-3 w-3 text-[#b20202]" />
  );
}

function FilterChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[#b20202]/20 bg-red-50 px-2.5 py-0.5 text-xs font-medium text-[#b20202]">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="rounded-full p-0.5 hover:bg-red-100"
      >
        <PiX className="h-2.5 w-2.5" />
      </button>
    </span>
  );
}

function DateTimeRange({
  dateFrom,
  dateTo,
  timeFrom,
  timeTo,
  onDateFrom,
  onDateTo,
  onTimeFrom,
  onTimeTo,
  onClear,
}: {
  dateFrom: string;
  dateTo: string;
  timeFrom: string;
  timeTo: string;
  onDateFrom: (v: string) => void;
  onDateTo: (v: string) => void;
  onTimeFrom: (v: string) => void;
  onTimeTo: (v: string) => void;
  onClear: () => void;
}) {
  const hasRange = dateFrom || dateTo;
  return (
    <div className="flex items-center gap-2">
      {(['from', 'to'] as const).map((side) => {
        const dateVal = side === 'from' ? dateFrom : dateTo;
        const timeVal = side === 'from' ? timeFrom : timeTo;
        const setDate = side === 'from' ? onDateFrom : onDateTo;
        const setTime = side === 'from' ? onTimeFrom : onTimeTo;
        return (
          <div key={side} className="flex items-center gap-1.5">
            <span className="shrink-0 text-xs font-medium capitalize text-gray-400">
              {side}
            </span>
            <div className="flex items-center overflow-hidden rounded-md border border-gray-200 bg-white transition-shadow focus-within:border-[#b20202] focus-within:ring-1 focus-within:ring-[#b20202]/20">
              <input
                type="date"
                value={dateVal}
                onChange={(e) => setDate(e.target.value)}
                className="w-[128px] border-0 bg-transparent px-2.5 py-1.5 text-sm text-gray-700 focus:outline-none"
              />
              <div className="w-px self-stretch bg-gray-100" />
              <div className="flex items-center gap-1 px-2">
                <PiClock className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                <input
                  type="time"
                  value={timeVal}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-[68px] border-0 bg-transparent py-1.5 text-sm text-gray-700 focus:outline-none"
                />
              </div>
            </div>
            {side === 'from' && (
              <span className="text-xs text-gray-300">→</span>
            )}
          </div>
        );
      })}
      {hasRange && (
        <button
          type="button"
          onClick={onClear}
          className="flex h-7 w-7 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          title="Clear date range"
        >
          <PiX className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

// ── Highlight matching text ────────────────────────────────────────────────────

function highlight(text: string, q: string): ReactNode {
  if (!q || !text) return text;
  const lower = text.toLowerCase();
  const lowerQ = q.toLowerCase();
  const parts: ReactNode[] = [];
  let last = 0;
  let idx = lower.indexOf(lowerQ);
  while (idx !== -1) {
    if (idx > last) parts.push(text.slice(last, idx));
    parts.push(
      <mark
        key={idx}
        className="rounded-[2px] bg-yellow-100 px-px not-italic text-yellow-900"
      >
        {text.slice(idx, idx + q.length)}
      </mark>
    );
    last = idx + q.length;
    idx = lower.indexOf(lowerQ, last);
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

// ── Select option data ─────────────────────────────────────────────────────────

interface SelectOption {
  value: string;
  label: string;
  dot?: string;
}

const GROUP_BY_OPTIONS: SelectOption[] = [
  { value: 'product', label: 'By Product' },
  { value: 'variant', label: 'By Variant' },
  { value: 'warehouse', label: 'By Warehouse' },
  { value: 'cashier', label: 'By Cashier' },
  { value: 'payment_method', label: 'By Payment' },
  { value: 'date', label: 'By Date' },
];

const PAYMENT_OPTIONS: SelectOption[] = Object.entries(METHOD_LABEL).map(
  ([k, v]) => ({
    value: k,
    label: v,
    dot: METHOD_DOT[k],
  })
);

// ── CustomSelect ───────────────────────────────────────────────────────────────

function CustomSelect({
  value,
  onChange,
  options,
  placeholder,
  minWidth = 130,
  required = false,
}: {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  placeholder: string;
  minWidth?: number;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const selected = options.find((o) => o.value === value) ?? null;
  const isActive = !required && value !== '';

  return (
    <div className="relative" ref={ref} style={{ minWidth }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition-all ${
          isActive
            ? 'border-[#b20202]/40 bg-red-50 text-[#b20202]'
            : open
              ? 'border-gray-300 bg-white text-gray-700 shadow-sm'
              : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
        }`}
      >
        {selected?.dot && (
          <span className={`h-2 w-2 shrink-0 rounded-full ${selected.dot}`} />
        )}
        <span className="flex-1 truncate text-left font-medium">
          {selected?.label ?? placeholder}
        </span>
        <span className="flex shrink-0 items-center gap-0.5">
          {isActive && (
            <span
              role="button"
              aria-label="Clear"
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
              className="rounded-full p-0.5 transition-colors hover:bg-[#b20202]/10"
            >
              <PiX className="h-2.5 w-2.5" />
            </span>
          )}
          <PiCaretDown
            className={`h-3 w-3 opacity-50 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          />
        </span>
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+4px)] z-50 min-w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl ring-1 ring-black/5">
          <div className="max-h-56 overflow-y-auto py-1">
            {!required && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onChange('');
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-xs transition-colors ${
                    !isActive
                      ? 'bg-gray-50 font-semibold text-gray-800'
                      : 'text-gray-400 hover:bg-gray-50'
                  }`}
                >
                  <span>{placeholder}</span>
                  {!isActive && (
                    <span className="text-[10px] font-bold text-[#b20202]">
                      ✓
                    </span>
                  )}
                </button>
                <div className="mx-3 my-1 border-t border-gray-100" />
              </>
            )}
            {options.map((opt) => {
              const isSel = value === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors ${
                    isSel
                      ? 'bg-red-50 font-semibold text-[#b20202]'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {opt.dot && (
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${opt.dot}`}
                    />
                  )}
                  <span className="flex-1">{opt.label}</span>
                  {isSel && (
                    <span className="text-[10px] font-bold text-[#b20202]">
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function PageBar({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPrev,
  onNext,
  onPage,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPrev: () => void;
  onNext: () => void;
  onPage: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  const start = Math.min((page - 1) * pageSize + 1, totalItems);
  const end = Math.min(page * pageSize, totalItems);
  const pages = Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
    if (totalPages <= 7) return i + 1;
    if (page <= 4) return i + 1;
    if (page >= totalPages - 3) return totalPages - 6 + i;
    return page - 3 + i;
  });
  return (
    <div className="flex items-center justify-between border-t border-gray-100 px-4 py-2.5">
      <p className="text-xs text-gray-500">
        {start.toLocaleString()}–{end.toLocaleString()} of{' '}
        {totalItems.toLocaleString()}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onPrev}
          disabled={page === 1}
          className="rounded-lg border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
        >
          <PiCaretLeft className="h-3.5 w-3.5" />
        </button>
        {pages.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPage(p)}
            className={`min-w-[30px] rounded-lg border px-2 py-1 text-xs font-medium transition-colors ${
              page === p
                ? 'border-[#b20202] bg-[#b20202] text-white'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {p}
          </button>
        ))}
        <button
          type="button"
          onClick={onNext}
          disabled={page === totalPages}
          className="rounded-lg border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
        >
          <PiCaretRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── Export Column Modal ────────────────────────────────────────────────────────

function ExportColumnModal({
  format,
  isGrouped,
  hasCost,
  lineCols,
  groupCols,
  onToggleLine,
  onToggleGroup,
  onSelectAll,
  onDeselectAll,
  onCancel,
  onDownload,
}: {
  format: 'csv' | 'excel' | 'pdf';
  isGrouped: boolean;
  hasCost: boolean;
  lineCols: Set<LineExportCol>;
  groupCols: Set<GroupExportCol>;
  onToggleLine: (k: LineExportCol) => void;
  onToggleGroup: (k: GroupExportCol) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onCancel: () => void;
  onDownload: () => void;
}) {
  const visible = isGrouped
    ? GROUP_EXPORT_COLS.filter((c) => hasCost || !c.costOnly)
    : LINE_EXPORT_COLS.filter((c) => hasCost || !c.costOnly);
  const selected = isGrouped ? groupCols : lineCols;
  const toggle = isGrouped
    ? (k: string) => onToggleGroup(k as GroupExportCol)
    : (k: string) => onToggleLine(k as LineExportCol);

  const selCount = visible.filter((c) =>
    selected.has(c.key as LineExportCol & GroupExportCol)
  ).length;
  const reqCount = visible.filter((c) => c.required).length;

  const FmtIcon =
    format === 'csv' ? PiFileCsv : format === 'excel' ? PiFileXls : PiFilePdf;
  const fmtLabel =
    format === 'csv' ? 'CSV' : format === 'excel' ? 'Excel' : 'PDF';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
      <div className="flex max-h-[90vh] w-[540px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/10">
        {/* Header */}
        <div className="flex shrink-0 items-center gap-3 border-b border-gray-100 px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#b20202]/10">
            <FmtIcon className="h-5 w-5 text-[#b20202]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-gray-900">
              Export as {fmtLabel}
            </p>
            <p className="text-xs text-gray-400">
              Choose the columns to include
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <PiX className="h-4 w-4" />
          </button>
        </div>

        {/* Column grid */}
        <div className="overflow-y-auto p-4">
          <div className="grid grid-cols-3 gap-1.5">
            {visible.map((col) => {
              const checked = selected.has(
                col.key as LineExportCol & GroupExportCol
              );
              const disabled = !!col.required;
              return (
                <button
                  key={col.key}
                  type="button"
                  onClick={() => !disabled && toggle(col.key)}
                  disabled={disabled}
                  className={`flex items-center gap-2 rounded-lg border px-2.5 py-2.5 text-left text-xs transition-colors ${
                    checked
                      ? disabled
                        ? 'cursor-default border-gray-200 bg-gray-50 text-gray-500'
                        : 'border-[#b20202]/30 bg-red-50 text-[#b20202]'
                      : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  <span
                    className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border text-[9px] font-bold transition-all ${
                      checked
                        ? disabled
                          ? 'border-gray-300 bg-gray-300 text-white'
                          : 'border-[#b20202] bg-[#b20202] text-white'
                        : 'border-gray-300'
                    }`}
                  >
                    {checked ? '✓' : ''}
                  </span>
                  <span className="flex-1 font-medium leading-tight">
                    {col.label}
                  </span>
                  {disabled && (
                    <span className="text-[9px] text-gray-300">req</span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center gap-3">
            <p className="text-xs text-gray-400">
              {selCount} of {visible.length} selected
              {reqCount > 0 ? ` (${reqCount} required)` : ''}
            </p>
            <button
              type="button"
              onClick={onSelectAll}
              className="text-xs font-medium text-[#b20202] hover:underline"
            >
              Select all
            </button>
            <span className="select-none text-gray-200">·</span>
            <button
              type="button"
              onClick={onDeselectAll}
              disabled={selCount <= reqCount}
              className="text-xs font-medium text-gray-400 hover:text-gray-600 hover:underline disabled:opacity-40"
            >
              Deselect all
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-gray-100 px-5 py-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onDownload}
            disabled={selCount === 0}
            className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#9a0101] disabled:opacity-50"
          >
            <PiDownloadSimple className="h-4 w-4" />
            Download {fmtLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function POSSalesDetails() {
  const { token: posToken } = usePOSAuth();
  const { tenant } = useTenant();
  const token = posToken && !isTokenExpired(posToken) ? posToken : null;

  const [orders, setOrders] = useState<PosOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [truncated, setTruncated] = useState(false);

  // Filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [timeFrom, setTimeFrom] = useState('00:00');
  const [timeTo, setTimeTo] = useState('23:59');
  const [activePreset, setActivePreset] = useState('');
  const [cashierFilter, setCashierFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Sort
  const [lineSortField, setLineSortField] = useState<LineSortField>('date');
  const [lineSortDir, setLineSortDir] = useState<'asc' | 'desc'>('desc');
  const [groupSortField, setGroupSortField] =
    useState<GroupSortField>('revenue');
  const [groupSortDir, setGroupSortDir] = useState<'asc' | 'desc'>('desc');

  // View
  const [viewMode, setViewMode] = useState<ViewMode>('lines');
  const [groupBy, setGroupBy] = useState<GroupByKey>('product');
  const [showProfit, setShowProfit] = useState(false);
  const [hiddenCols, setHiddenCols] = useState<Set<ToggleableCol>>(
    new Set<ToggleableCol>(
      TOGGLEABLE_COLS.filter((c) => c.defaultHidden).map((c) => c.key)
    )
  );
  const [showColMenu, setShowColMenu] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const colMenuRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const [exportDialog, setExportDialog] = useState({
    open: false,
    format: 'csv' as 'csv' | 'excel' | 'pdf',
    lineCols: new Set(LINE_EXPORT_COLS.map((c) => c.key)) as Set<LineExportCol>,
    groupCols: new Set(
      GROUP_EXPORT_COLS.map((c) => c.key)
    ) as Set<GroupExportCol>,
  });

  // Pagination (separate for each view)
  const [page, setPage] = useState(1);
  const [groupPage, setGroupPage] = useState(1);

  // Close menus on outside click
  useEffect(() => {
    if (!showExport) return;
    function handler(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node))
        setShowExport(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showExport]);

  useEffect(() => {
    if (!showColMenu) return;
    function handler(e: MouseEvent) {
      if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node))
        setShowColMenu(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showColMenu]);

  const fetchOrders = useCallback(
    (all = false) => {
      if (!token) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      posApi
        .getAllOrders(token, { limit: all ? 2000 : 500 })
        .then((data) => {
          const rows = (data || []) as PosOrder[];
          setOrders(rows);
          setTruncated(!all && rows.length === 500);
        })
        .catch(() => setError('Failed to load orders. Please try again.'))
        .finally(() => setLoading(false));
    },
    [token]
  );

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Debounce search input → debouncedSearch drives filtering
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 280);
    return () => clearTimeout(t);
  }, [search]);

  // ⌘K / Ctrl+K focuses the search; Escape clears + blurs
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
      if (e.key === 'Escape' && document.activeElement === searchRef.current) {
        setSearch('');
        searchRef.current?.blur();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  // Reset page on filter/sort change (keyed to debouncedSearch so pages reset after filter applies)
  useEffect(() => {
    setPage(1);
  }, [
    dateFrom,
    dateTo,
    timeFrom,
    timeTo,
    cashierFilter,
    methodFilter,
    statusFilter,
    debouncedSearch,
    lineSortField,
    lineSortDir,
  ]);
  useEffect(() => {
    setGroupPage(1);
  }, [
    dateFrom,
    dateTo,
    timeFrom,
    timeTo,
    cashierFilter,
    methodFilter,
    statusFilter,
    debouncedSearch,
    groupSortField,
    groupSortDir,
    groupBy,
  ]);

  // ── Data ───────────────────────────────────────────────────────────────────

  const allRows = useMemo<LineRow[]>(() => {
    const rows: LineRow[] = [];
    for (const o of orders) {
      if (!o.items?.length) continue;
      const cashier = o.posStaff
        ? o.posStaff.posName ||
          `${o.posStaff.firstName} ${o.posStaff.lastName}`.trim()
        : 'Unknown';
      for (const item of o.items) {
        const gross = item.priceAtPurchase * item.quantity;
        const discount = item.discountAmount ?? 0;
        const subtotal = item.itemSubtotal;
        const costPrice = (item.sizeCostPrice ?? 0) * item.quantity;
        const profit = costPrice > 0 ? subtotal - costPrice : 0;
        rows.push({
          orderId: o._id,
          orderNumber: o.orderNumber ?? o._id.slice(-6).toUpperCase(),
          receiptNumber: o.receiptNumber ?? '',
          date: o.placedAt || o.createdAt,
          cashier,
          product: item.name,
          variant: item.variant ?? '',
          category: item.category ?? '',
          subcategory: item.subcategory ?? '',
          brand: item.brand ?? '',
          qty: item.quantity,
          unitPrice: item.priceAtPurchase,
          discount,
          subtotal,
          gross,
          costPrice,
          profit,
          paymentMethod: o.paymentMethod,
          isVoided: !!(o.isVoided || o.status === 'voided'),
          warehouse: item.warehouse?.name ?? '',
        });
      }
    }
    return rows;
  }, [orders]);

  const hasCostData = useMemo(
    () => allRows.some((r) => r.costPrice > 0),
    [allRows]
  );
  const cashiers = useMemo(
    () => Array.from(new Set(allRows.map((r) => r.cashier))).sort(),
    [allRows]
  );
  const cashierOptions = useMemo<SelectOption[]>(
    () => cashiers.map((c) => ({ value: c, label: c })),
    [cashiers]
  );

  // Status tab counts (distinct orders)
  const statusCounts = useMemo(() => {
    const seen = new Map<string, boolean>();
    for (const r of allRows) {
      if (!seen.has(r.orderId)) seen.set(r.orderId, r.isVoided);
    }
    let active = 0,
      voided = 0;
    seen.forEach((v) => {
      if (v) voided++;
      else active++;
    });
    return { all: seen.size, active, voided };
  }, [allRows]);

  // ── Filtering ──────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    return allRows.filter((r) => {
      if (statusFilter === 'active' && r.isVoided) return false;
      if (statusFilter === 'voided' && !r.isVoided) return false;
      if (cashierFilter && r.cashier !== cashierFilter) return false;
      if (methodFilter && r.paymentMethod !== methodFilter) return false;
      if (dateFrom) {
        const startTs = toTs(dateFrom, timeFrom);
        if (new Date(r.date).getTime() < startTs) return false;
      }
      if (dateTo) {
        const endTs = toTs(dateTo, timeTo) + 59_000;
        if (new Date(r.date).getTime() > endTs) return false;
      }
      if (q) {
        const hit =
          r.product.toLowerCase().includes(q) ||
          r.variant.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q) ||
          r.subcategory.toLowerCase().includes(q) ||
          r.brand.toLowerCase().includes(q) ||
          r.cashier.toLowerCase().includes(q) ||
          r.orderNumber.toLowerCase().includes(q) ||
          r.receiptNumber.toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [
    allRows,
    statusFilter,
    cashierFilter,
    methodFilter,
    dateFrom,
    dateTo,
    timeFrom,
    timeTo,
    debouncedSearch,
  ]);

  // ── Sort (line view) ───────────────────────────────────────────────────────

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = a[lineSortField] as string | number;
      const bv = b[lineSortField] as string | number;
      if (typeof av === 'number' && typeof bv === 'number')
        return lineSortDir === 'asc' ? av - bv : bv - av;
      return lineSortDir === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
  }, [filtered, lineSortField, lineSortDir]);

  // ── Grouped ────────────────────────────────────────────────────────────────

  const grouped = useMemo<GroupRow[]>(() => {
    const totalRev = filtered.reduce((s, r) => s + r.subtotal, 0);
    const map = new Map<string, { row: GroupRow; orderIds: Set<string> }>();

    for (const r of filtered) {
      const key =
        groupBy === 'product'
          ? r.product + (r.variant ? ` (${r.variant})` : '')
          : groupBy === 'variant'
            ? r.variant || '(no variant)'
            : groupBy === 'cashier'
              ? r.cashier
              : groupBy === 'payment_method'
                ? (METHOD_LABEL[r.paymentMethod] ?? r.paymentMethod)
                : groupBy === 'warehouse'
                  ? r.warehouse || 'No warehouse'
                  : fmtDate(r.date);

      const entry = map.get(key);
      if (entry) {
        entry.row.qty += r.qty;
        entry.row.gross += r.gross;
        entry.row.discount += r.discount;
        entry.row.revenue += r.subtotal;
        entry.row.profit += r.profit;
        entry.row.lineCount += 1;
        entry.orderIds.add(r.orderId);
      } else {
        map.set(key, {
          row: {
            key,
            qty: r.qty,
            gross: r.gross,
            discount: r.discount,
            revenue: r.subtotal,
            profit: r.profit,
            lineCount: 1,
            orderCount: 0,
            share: 0,
          },
          orderIds: new Set([r.orderId]),
        });
      }
    }

    return Array.from(map.values())
      .map(({ row, orderIds }) => ({
        ...row,
        orderCount: orderIds.size,
        share: totalRev > 0 ? (row.revenue / totalRev) * 100 : 0,
      }))
      .sort((a, b) => {
        const av = a[groupSortField] as number | string;
        const bv = b[groupSortField] as number | string;
        if (typeof av === 'number' && typeof bv === 'number')
          return groupSortDir === 'asc' ? av - bv : bv - av;
        return groupSortDir === 'asc'
          ? String(av).localeCompare(String(bv))
          : String(bv).localeCompare(String(av));
      });
  }, [filtered, groupBy, groupSortField, groupSortDir]);

  // ── Summary ────────────────────────────────────────────────────────────────

  const summary = useMemo(() => {
    const revenue = filtered.reduce((s, r) => s + r.subtotal, 0);
    const items = filtered.reduce((s, r) => s + r.qty, 0);
    const discount = filtered.reduce((s, r) => s + r.discount, 0);
    const gross = filtered.reduce((s, r) => s + r.gross, 0);
    const profit = filtered.reduce((s, r) => s + r.profit, 0);
    const orderIds = new Set(filtered.map((r) => r.orderId));
    const cnt = orderIds.size;
    return {
      revenue,
      items,
      discount,
      gross,
      profit,
      orders: cnt,
      avgOrder: cnt > 0 ? revenue / cnt : 0,
    };
  }, [filtered]);

  // ── Pagination ─────────────────────────────────────────────────────────────

  const lineTotalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const groupTotalPages = Math.max(
    1,
    Math.ceil(grouped.length / GROUP_PAGE_SIZE)
  );
  const paginatedGroup = grouped.slice(
    (groupPage - 1) * GROUP_PAGE_SIZE,
    groupPage * GROUP_PAGE_SIZE
  );

  // ── Helpers ────────────────────────────────────────────────────────────────

  function toggleLineSort(field: LineSortField) {
    if (lineSortField === field)
      setLineSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setLineSortField(field);
      setLineSortDir(field === 'date' ? 'desc' : 'asc');
    }
  }
  function toggleGroupSort(field: GroupSortField) {
    if (groupSortField === field)
      setGroupSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setGroupSortField(field);
      setGroupSortDir('desc');
    }
  }
  function toggleCol(key: ToggleableCol) {
    setHiddenCols((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }
  const vis = (key: ToggleableCol) => !hiddenCols.has(key);

  function applyPreset(preset: (typeof DATE_PRESETS)[0]) {
    setDateFrom(preset.from());
    setDateTo(preset.to());
    setTimeFrom(preset.tf);
    setTimeTo(preset.tt);
    setActivePreset(preset.label);
  }
  function clearDateRange() {
    setDateFrom('');
    setDateTo('');
    setTimeFrom('00:00');
    setTimeTo('23:59');
    setActivePreset('');
  }
  function clearAll() {
    clearDateRange();
    setCashierFilter('');
    setMethodFilter('');
    setStatusFilter('active');
    setSearch('');
  }

  // Active filter chips
  const filterChips = useMemo(() => {
    const chips: { label: string; onRemove: () => void }[] = [];
    if (dateFrom || dateTo)
      chips.push({
        label: `${dateFrom || '…'}${timeFrom !== '00:00' ? ` ${timeFrom}` : ''} → ${dateTo || '…'}${timeTo !== '23:59' ? ` ${timeTo}` : ''}`,
        onRemove: clearDateRange,
      });
    if (cashierFilter)
      chips.push({
        label: cashierFilter,
        onRemove: () => setCashierFilter(''),
      });
    if (methodFilter)
      chips.push({
        label: METHOD_LABEL[methodFilter] ?? methodFilter,
        onRemove: () => setMethodFilter(''),
      });
    if (search)
      chips.push({
        label: `"${search.slice(0, 24)}${search.length > 24 ? '…' : ''}"`,
        onRemove: () => setSearch(''),
      });
    return chips;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo, timeFrom, timeTo, cashierFilter, methodFilter, search]);

  const groupLabel =
    groupBy === 'product'
      ? 'Product / Variant'
      : groupBy === 'variant'
        ? 'Variant'
        : groupBy === 'cashier'
          ? 'Cashier'
          : groupBy === 'payment_method'
            ? 'Payment Method'
            : groupBy === 'warehouse'
              ? 'Warehouse'
              : 'Date';

  type ExportFormat = 'csv' | 'excel' | 'pdf';

  function handleExport(fmt: ExportFormat) {
    setShowExport(false);
    setExportDialog((prev) => ({ ...prev, open: true, format: fmt }));
  }

  function toggleExportLineCol(key: LineExportCol) {
    if (LINE_EXPORT_COLS.find((c) => c.key === key)?.required) return;
    setExportDialog((prev) => {
      const next = new Set(prev.lineCols);
      next.has(key) ? next.delete(key) : next.add(key);
      return { ...prev, lineCols: next };
    });
  }

  function toggleExportGroupCol(key: GroupExportCol) {
    if (GROUP_EXPORT_COLS.find((c) => c.key === key)?.required) return;
    setExportDialog((prev) => {
      const next = new Set(prev.groupCols);
      next.has(key) ? next.delete(key) : next.add(key);
      return { ...prev, groupCols: next };
    });
  }

  function selectAllExportCols() {
    const hc = hasCostData && showProfit;
    if (viewMode === 'grouped') {
      setExportDialog((prev) => ({
        ...prev,
        groupCols: new Set(
          GROUP_EXPORT_COLS.filter((c) => hc || !c.costOnly).map((c) => c.key)
        ),
      }));
    } else {
      setExportDialog((prev) => ({
        ...prev,
        lineCols: new Set(
          LINE_EXPORT_COLS.filter((c) => hc || !c.costOnly).map((c) => c.key)
        ),
      }));
    }
  }

  function deselectAllExportCols() {
    if (viewMode === 'grouped') {
      setExportDialog((prev) => ({
        ...prev,
        groupCols: new Set(
          GROUP_EXPORT_COLS.filter((c) => c.required).map((c) => c.key)
        ),
      }));
    } else {
      setExportDialog((prev) => ({
        ...prev,
        lineCols: new Set(
          LINE_EXPORT_COLS.filter((c) => c.required).map((c) => c.key)
        ),
      }));
    }
  }

  function confirmExport() {
    const hasCost = hasCostData && showProfit;
    const pdfMeta: PdfMeta = {
      dateFrom,
      dateTo,
      timeFrom,
      timeTo,
      cashierFilter,
      methodFilter,
      statusFilter,
      storeName: tenant?.name || 'DrinksHarbour',
      summary,
    };
    const { format: fmt, lineCols, groupCols } = exportDialog;
    setExportDialog((prev) => ({ ...prev, open: false }));
    if (viewMode === 'grouped') {
      if (fmt === 'csv') exportGroupedCsv(grouped, groupLabel, groupCols);
      if (fmt === 'excel') exportGroupedExcel(grouped, groupLabel, groupCols);
      if (fmt === 'pdf')
        exportGroupedPdf(grouped, groupLabel, hasCost, pdfMeta, groupCols);
    } else {
      if (fmt === 'csv') exportLineCsv(sorted, lineCols);
      if (fmt === 'excel') exportLineExcel(sorted, lineCols);
      if (fmt === 'pdf') exportLinePdf(sorted, hasCost, pdfMeta, lineCols);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <POSNavHeader />

      {/* ── Sticky control bar ── */}
      <div className="sticky top-0 z-10 shrink-0 border-b border-gray-200 bg-white shadow-sm">
        {/* Row 1 — title · status tabs · actions */}
        <div className="flex h-14 items-center gap-4 px-5">
          {/* Left: title + context */}
          <div className="flex min-w-0 shrink-0 flex-col justify-center">
            <h1 className="text-[15px] font-bold tracking-tight text-gray-900">
              Sales Details
            </h1>
            <p className="text-[11px] leading-none text-gray-400">
              {loading ? (
                'Loading…'
              ) : (
                <>
                  {orders.length.toLocaleString()} orders
                  {truncated && (
                    <>
                      {' '}
                      ·{' '}
                      <button
                        type="button"
                        onClick={() => fetchOrders(true)}
                        className="text-[#b20202] underline hover:no-underline"
                      >
                        Load all
                      </button>
                    </>
                  )}
                  {filtered.length !== allRows.length && (
                    <>
                      {' '}
                      ·{' '}
                      <span className="font-medium text-gray-600">
                        {filtered.length.toLocaleString()} shown
                      </span>
                    </>
                  )}
                </>
              )}
            </p>
          </div>

          {/* Centre: status tabs */}
          <div className="flex flex-1 items-center justify-center">
            <div className="flex rounded-xl border border-gray-200 bg-gray-50 p-0.5">
              {(['all', 'active', 'voided'] as StatusFilter[]).map((s) => {
                const active = statusFilter === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatusFilter(s)}
                    className={`flex items-center gap-2 rounded-[10px] px-4 py-1.5 text-xs font-semibold transition-all ${
                      active
                        ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200/60'
                        : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    {s === 'all' ? 'All' : s === 'active' ? 'Active' : 'Voided'}
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums leading-none transition-colors ${
                        active
                          ? s === 'voided'
                            ? 'bg-red-100 text-red-600'
                            : 'bg-[#b20202]/10 text-[#b20202]'
                          : 'bg-gray-200 text-gray-400'
                      }`}
                    >
                      {statusCounts[s]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: view controls + actions */}
          <div className="flex shrink-0 items-center gap-1.5">
            {/* View toggle */}
            <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
              {(['lines', 'grouped'] as ViewMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setViewMode(m)}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all ${
                    viewMode === m
                      ? 'bg-[#b20202] text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  {m === 'lines' ? (
                    <>
                      <PiList className="h-3.5 w-3.5" />
                      Lines
                    </>
                  ) : (
                    <>
                      <PiRows className="h-3.5 w-3.5" />
                      Grouped
                    </>
                  )}
                </button>
              ))}
            </div>

            {viewMode === 'grouped' && (
              <CustomSelect
                value={groupBy}
                onChange={(v) => setGroupBy((v || 'product') as GroupByKey)}
                options={GROUP_BY_OPTIONS}
                placeholder="Group by…"
                minWidth={120}
                required
              />
            )}

            <div className="mx-1 h-5 w-px bg-gray-200" />

            {/* Column picker */}
            <div className="relative" ref={colMenuRef}>
              <button
                type="button"
                onClick={() => setShowColMenu((v) => !v)}
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-[7px] text-xs font-medium transition-colors ${
                  showColMenu || hiddenCols.size > 0
                    ? 'border-[#b20202]/40 bg-red-50 text-[#b20202]'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                Columns
                {hiddenCols.size > 0 && (
                  <span className="rounded-full bg-[#b20202] px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                    {TOGGLEABLE_COLS.length - hiddenCols.size}/
                    {TOGGLEABLE_COLS.length}
                  </span>
                )}
              </button>
              {showColMenu && (
                <div className="absolute right-0 top-full z-50 mt-1.5 w-44 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl ring-1 ring-black/5">
                  <div className="border-b border-gray-100 px-3 py-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      Show / Hide columns
                    </p>
                  </div>
                  <div className="space-y-0.5 p-1.5">
                    {TOGGLEABLE_COLS.map((col) => (
                      <button
                        key={col.key}
                        type="button"
                        onClick={() => toggleCol(col.key)}
                        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-gray-50"
                      >
                        <span
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-bold transition-all ${
                            vis(col.key)
                              ? 'border-[#b20202] bg-[#b20202] text-white'
                              : 'border-gray-300'
                          }`}
                        >
                          {vis(col.key) ? '✓' : ''}
                        </span>
                        <span
                          className={`text-xs ${vis(col.key) ? 'font-medium text-gray-800' : 'text-gray-400'}`}
                        >
                          {col.label}
                        </span>
                      </button>
                    ))}
                  </div>
                  {hiddenCols.size > 0 && (
                    <div className="border-t border-gray-100 p-1.5">
                      <button
                        type="button"
                        onClick={() => setHiddenCols(new Set())}
                        className="w-full rounded-lg px-2 py-1.5 text-xs font-semibold text-[#b20202] transition-colors hover:bg-red-50"
                      >
                        Show all columns
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="mx-1 h-5 w-px bg-gray-200" />

            <button
              type="button"
              onClick={() => fetchOrders()}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-[7px] text-xs text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
            >
              <PiArrowsClockwise
                className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}
              />
              Refresh
            </button>

            {/* Export dropdown */}
            <div className="relative" ref={exportRef}>
              <button
                type="button"
                onClick={() => setShowExport((v) => !v)}
                disabled={
                  (viewMode === 'lines' ? sorted.length : grouped.length) === 0
                }
                className={`flex items-center gap-1.5 rounded-lg px-3 py-[7px] text-xs font-semibold shadow-sm transition-colors disabled:opacity-50 ${
                  showExport
                    ? 'bg-[#9a0101] text-white'
                    : 'bg-[#b20202] text-white hover:bg-[#9a0101]'
                }`}
              >
                <PiDownloadSimple className="h-3.5 w-3.5" />
                Export
                <PiCaretDown
                  className={`h-3 w-3 opacity-70 transition-transform duration-150 ${showExport ? 'rotate-180' : ''}`}
                />
              </button>

              {showExport && (
                <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-44 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl ring-1 ring-black/5">
                  <div className="border-b border-gray-100 px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      Export as
                    </p>
                  </div>
                  <div className="space-y-0.5 p-1.5">
                    {(
                      [
                        {
                          fmt: 'csv' as const,
                          Icon: PiFileCsv,
                          label: 'CSV',
                          sub: '.csv',
                        },
                        {
                          fmt: 'excel' as const,
                          Icon: PiFileXls,
                          label: 'Excel',
                          sub: '.xlsx',
                        },
                        {
                          fmt: 'pdf' as const,
                          Icon: PiFilePdf,
                          label: 'PDF',
                          sub: '.pdf',
                        },
                      ] as const
                    ).map(({ fmt, Icon, label, sub }) => (
                      <button
                        key={fmt}
                        type="button"
                        onClick={() => handleExport(fmt)}
                        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs text-gray-700 transition-colors hover:bg-red-50 hover:text-[#b20202]"
                      >
                        <Icon className="h-4 w-4 shrink-0 opacity-60" />
                        <span className="flex-1 font-medium">{label}</span>
                        <span className="text-[10px] text-gray-400">{sub}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Row 2 — date presets + datetime range */}
        <div className="flex items-center gap-3 border-t border-gray-100 bg-gray-50/60 px-5 py-2">
          {DATE_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => applyPreset(preset)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-all ${
                activePreset === preset.label
                  ? 'bg-[#b20202] text-white shadow-sm'
                  : 'border border-gray-200 bg-white text-gray-600 hover:border-[#b20202] hover:text-[#b20202]'
              }`}
            >
              {preset.label}
            </button>
          ))}

          <div className="mx-1 h-5 w-px shrink-0 bg-gray-200" />

          <DateTimeRange
            dateFrom={dateFrom}
            dateTo={dateTo}
            timeFrom={timeFrom}
            timeTo={timeTo}
            onDateFrom={(v) => {
              setDateFrom(v);
              setActivePreset('');
            }}
            onDateTo={(v) => {
              setDateTo(v);
              setActivePreset('');
            }}
            onTimeFrom={setTimeFrom}
            onTimeTo={setTimeTo}
            onClear={clearDateRange}
          />
        </div>

        {/* Row 3 — field filters + search */}
        <div className="flex items-center gap-2 border-t border-gray-100 px-5 py-2">
          <CustomSelect
            value={cashierFilter}
            onChange={setCashierFilter}
            options={cashierOptions}
            placeholder="All cashiers"
            minWidth={140}
          />

          <CustomSelect
            value={methodFilter}
            onChange={setMethodFilter}
            options={PAYMENT_OPTIONS}
            placeholder="All payments"
            minWidth={140}
          />

          {hasCostData && (
            <label className="flex cursor-pointer select-none items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-600 transition-colors hover:bg-gray-50">
              <input
                type="checkbox"
                checked={showProfit}
                onChange={(e) => setShowProfit(e.target.checked)}
                className="accent-[#b20202]"
              />
              Show profit
            </label>
          )}

          {/* Active filter chips (inline) */}
          {filterChips.length > 0 && (
            <div className="ml-1 flex items-center gap-1.5">
              {filterChips.map((chip) => (
                <FilterChip
                  key={chip.label}
                  label={chip.label}
                  onRemove={chip.onRemove}
                />
              ))}
            </div>
          )}

          {/* Search + clear (right-aligned) */}
          <div className="ml-auto flex items-center gap-2">
            <div
              className={`relative transition-all duration-200 ${searchFocused || search ? 'w-72' : 'w-56'}`}
            >
              <PiMagnifyingGlass
                className={`absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 transition-colors duration-150 ${
                  searchFocused ? 'text-[#b20202]' : 'text-gray-400'
                }`}
              />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                placeholder="Search product, cashier, order #…"
                className={`w-full rounded-lg border py-1.5 pl-8 text-sm outline-none transition-all duration-150 ${
                  search
                    ? 'border-[#b20202]/50 bg-red-50/40 pr-14 text-gray-800 ring-2 ring-[#b20202]/10'
                    : searchFocused
                      ? 'border-[#b20202] bg-white pr-8 ring-2 ring-[#b20202]/10'
                      : 'border-gray-200 bg-white pr-16 hover:border-gray-300'
                }`}
              />
              {/* Result count — shown while debounced search is active */}
              {debouncedSearch && (
                <span className="absolute right-7 top-1/2 -translate-y-1/2 rounded-full bg-[#b20202]/10 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-[#b20202]">
                  {filtered.length}
                </span>
              )}
              {/* Clear */}
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                >
                  <PiX className="h-3.5 w-3.5" />
                </button>
              ) : !searchFocused ? (
                <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 font-mono text-[9px] leading-none text-gray-300">
                  ⌘K
                </kbd>
              ) : null}
            </div>

            {(filterChips.length > 0 ||
              cashierFilter ||
              methodFilter ||
              statusFilter !== 'active') && (
              <button
                type="button"
                onClick={clearAll}
                className="flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-[#b20202] transition-colors hover:bg-red-100"
              >
                <PiX className="h-3.5 w-3.5" />
                Clear all
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Summary strip ── */}
      <div className="shrink-0 border-b border-gray-200 bg-white">
        <div
          className="grid divide-x divide-gray-100"
          style={{
            gridTemplateColumns: `repeat(${hasCostData ? 6 : 5}, minmax(0, 1fr))`,
          }}
        >
          {[
            {
              icon: PiCurrencyNgn,
              label: 'Gross Revenue',
              value: formatCurrency(summary.gross),
              sub: `−${formatCurrency(summary.discount)} disc.`,
              color: 'text-gray-400',
              bg: 'bg-gray-50',
            },
            {
              icon: PiTrendUp,
              label: 'Net Revenue',
              value: formatCurrency(summary.revenue),
              sub: 'after discounts',
              color: 'text-green-500',
              bg: 'bg-green-50',
            },
            {
              icon: PiTag,
              label: 'Total Discount',
              value: formatCurrency(summary.discount),
              sub:
                summary.gross > 0
                  ? `${((summary.discount / summary.gross) * 100).toFixed(1)}% of gross`
                  : '',
              color: 'text-orange-400',
              bg: 'bg-orange-50',
            },
            {
              icon: PiShoppingCart,
              label: 'Items Sold',
              value: summary.items.toLocaleString(),
              sub: `across ${filtered.length.toLocaleString()} lines`,
              color: 'text-blue-500',
              bg: 'bg-blue-50',
            },
            {
              icon: PiRows,
              label: 'Distinct Orders',
              value: summary.orders.toLocaleString(),
              sub: `avg ${formatCurrency(summary.avgOrder)} / order`,
              color: 'text-purple-500',
              bg: 'bg-purple-50',
            },
            ...(hasCostData
              ? [
                  {
                    icon: PiPercent,
                    label: 'Est. Profit',
                    value: formatCurrency(summary.profit),
                    sub:
                      summary.revenue > 0
                        ? `${((summary.profit / summary.revenue) * 100).toFixed(1)}% margin`
                        : '',
                    color: 'text-teal-500',
                    bg: 'bg-teal-50',
                  },
                ]
              : []),
          ].map(({ icon: Icon, label, value, sub, color, bg }) => (
            <div key={label} className="flex items-center gap-3 px-4 py-3">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${bg}`}
              >
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-gray-400">{label}</p>
                <p className="text-sm font-semibold tabular-nums leading-tight text-gray-900">
                  {value}
                </p>
                {sub && (
                  <p className="text-[10px] tabular-nums text-gray-400">
                    {sub}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 space-y-3 px-5 py-4">
        {loading ? (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <div className="flex gap-4 border-b border-gray-100 bg-gray-50 px-4 py-3">
              {[100, 60, 80, 160, 70, 40, 70, 70, 70, 80, 70].map((w, i) => (
                <div
                  key={i}
                  className="h-3 animate-pulse rounded bg-gray-200"
                  style={{ width: w, flexShrink: 0 }}
                />
              ))}
            </div>
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className={`flex gap-4 border-b border-gray-50 px-4 py-3 ${i % 2 === 1 ? 'bg-gray-50/30' : ''}`}
              >
                {[90, 60, 80, 150, 70, 32, 70, 70, 70, 80, 70].map((w, j) => (
                  <div
                    key={j}
                    className="h-3.5 animate-pulse rounded bg-gray-100"
                    style={{ width: w, flexShrink: 0 }}
                  />
                ))}
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50 py-16">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-[#b20202]">
              <PiX className="h-6 w-6" />
            </div>
            <p className="mt-3 text-sm font-medium text-red-700">{error}</p>
            <button
              onClick={() => fetchOrders()}
              className="mt-2 rounded-md bg-[#b20202] px-4 py-1.5 text-xs font-medium text-white hover:bg-[#9a0101]"
            >
              Retry
            </button>
          </div>
        ) : viewMode === 'lines' ? (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    <th
                      onClick={() => toggleLineSort('date')}
                      className="cursor-pointer select-none whitespace-nowrap px-4 py-3 text-left hover:text-gray-700"
                    >
                      <span className="inline-flex items-center gap-1">
                        Date/Time
                        <SortChevron
                          active={lineSortField === 'date'}
                          dir={lineSortDir}
                        />
                      </span>
                    </th>
                    {vis('orderNumber') && (
                      <th
                        onClick={() => toggleLineSort('orderNumber')}
                        className="cursor-pointer select-none whitespace-nowrap px-4 py-3 text-left hover:text-gray-700"
                      >
                        <span className="inline-flex items-center gap-1">
                          Order #
                          <SortChevron
                            active={lineSortField === 'orderNumber'}
                            dir={lineSortDir}
                          />
                        </span>
                      </th>
                    )}
                    {vis('cashier') && (
                      <th
                        onClick={() => toggleLineSort('cashier')}
                        className="cursor-pointer select-none whitespace-nowrap px-4 py-3 text-left hover:text-gray-700"
                      >
                        <span className="inline-flex items-center gap-1">
                          Cashier
                          <SortChevron
                            active={lineSortField === 'cashier'}
                            dir={lineSortDir}
                          />
                        </span>
                      </th>
                    )}
                    <th
                      onClick={() => toggleLineSort('product')}
                      className="cursor-pointer select-none whitespace-nowrap px-4 py-3 text-left hover:text-gray-700"
                    >
                      <span className="inline-flex items-center gap-1">
                        Product
                        <SortChevron
                          active={lineSortField === 'product'}
                          dir={lineSortDir}
                        />
                      </span>
                    </th>
                    {vis('variant') && (
                      <th
                        onClick={() => toggleLineSort('variant')}
                        className="cursor-pointer select-none whitespace-nowrap px-4 py-3 text-left hover:text-gray-700"
                      >
                        <span className="inline-flex items-center gap-1">
                          Variant
                          <SortChevron
                            active={lineSortField === 'variant'}
                            dir={lineSortDir}
                          />
                        </span>
                      </th>
                    )}
                    {vis('category') && (
                      <th
                        onClick={() => toggleLineSort('category')}
                        className="cursor-pointer select-none whitespace-nowrap px-4 py-3 text-left hover:text-gray-700"
                      >
                        <span className="inline-flex items-center gap-1">
                          Category
                          <SortChevron
                            active={lineSortField === 'category'}
                            dir={lineSortDir}
                          />
                        </span>
                      </th>
                    )}
                    {vis('subcategory') && (
                      <th
                        onClick={() => toggleLineSort('subcategory')}
                        className="cursor-pointer select-none whitespace-nowrap px-4 py-3 text-left hover:text-gray-700"
                      >
                        <span className="inline-flex items-center gap-1">
                          Subcategory
                          <SortChevron
                            active={lineSortField === 'subcategory'}
                            dir={lineSortDir}
                          />
                        </span>
                      </th>
                    )}
                    {vis('brand') && (
                      <th
                        onClick={() => toggleLineSort('brand')}
                        className="cursor-pointer select-none whitespace-nowrap px-4 py-3 text-left hover:text-gray-700"
                      >
                        <span className="inline-flex items-center gap-1">
                          Brand
                          <SortChevron
                            active={lineSortField === 'brand'}
                            dir={lineSortDir}
                          />
                        </span>
                      </th>
                    )}
                    <th className="whitespace-nowrap px-4 py-3 text-left">
                      Warehouse
                    </th>
                    <th
                      onClick={() => toggleLineSort('qty')}
                      className="cursor-pointer select-none whitespace-nowrap px-4 py-3 text-center hover:text-gray-700"
                    >
                      <span className="inline-flex items-center justify-center gap-1">
                        Qty
                        <SortChevron
                          active={lineSortField === 'qty'}
                          dir={lineSortDir}
                        />
                      </span>
                    </th>
                    {vis('unitPrice') && (
                      <th
                        onClick={() => toggleLineSort('unitPrice')}
                        className="cursor-pointer select-none whitespace-nowrap px-4 py-3 text-right hover:text-gray-700"
                      >
                        <span className="inline-flex items-center gap-1">
                          Unit Price
                          <SortChevron
                            active={lineSortField === 'unitPrice'}
                            dir={lineSortDir}
                          />
                        </span>
                      </th>
                    )}
                    {vis('gross') && (
                      <th
                        onClick={() => toggleLineSort('gross')}
                        className="cursor-pointer select-none whitespace-nowrap px-4 py-3 text-right hover:text-gray-700"
                      >
                        <span className="inline-flex items-center gap-1">
                          Gross
                          <SortChevron
                            active={lineSortField === 'gross'}
                            dir={lineSortDir}
                          />
                        </span>
                      </th>
                    )}
                    {vis('discount') && (
                      <th
                        onClick={() => toggleLineSort('discount')}
                        className="cursor-pointer select-none whitespace-nowrap px-4 py-3 text-right hover:text-gray-700"
                      >
                        <span className="inline-flex items-center gap-1">
                          Discount
                          <SortChevron
                            active={lineSortField === 'discount'}
                            dir={lineSortDir}
                          />
                        </span>
                      </th>
                    )}
                    <th
                      onClick={() => toggleLineSort('subtotal')}
                      className="cursor-pointer select-none whitespace-nowrap px-4 py-3 text-right hover:text-gray-700"
                    >
                      <span className="inline-flex items-center gap-1">
                        Net Total
                        <SortChevron
                          active={lineSortField === 'subtotal'}
                          dir={lineSortDir}
                        />
                      </span>
                    </th>
                    {showProfit && hasCostData && (
                      <th
                        onClick={() => toggleLineSort('profit')}
                        className="cursor-pointer select-none whitespace-nowrap px-4 py-3 text-right hover:text-gray-700"
                      >
                        <span className="inline-flex items-center gap-1">
                          Profit
                          <SortChevron
                            active={lineSortField === 'profit'}
                            dir={lineSortDir}
                          />
                        </span>
                      </th>
                    )}
                    {vis('payment') && (
                      <th
                        onClick={() => toggleLineSort('paymentMethod')}
                        className="cursor-pointer select-none whitespace-nowrap px-4 py-3 text-left hover:text-gray-700"
                      >
                        <span className="inline-flex items-center gap-1">
                          Payment
                          <SortChevron
                            active={lineSortField === 'paymentMethod'}
                            dir={lineSortDir}
                          />
                        </span>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {paginated.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="py-20 text-center">
                        <p className="text-sm font-medium text-gray-400">
                          {allRows.length === 0
                            ? 'No sales data found.'
                            : 'No line items match the current filters.'}
                        </p>
                        {allRows.length > 0 && (
                          <button
                            type="button"
                            onClick={clearAll}
                            className="mt-2 text-xs text-[#b20202] underline"
                          >
                            Clear filters
                          </button>
                        )}
                      </td>
                    </tr>
                  ) : (
                    paginated.map((row, i) => (
                      <tr
                        key={`${row.orderId}-${i}`}
                        className={`border-b border-gray-50 transition-colors hover:bg-blue-50/20 ${
                          i % 2 === 1 ? 'bg-gray-50/30' : ''
                        } ${row.isVoided ? 'opacity-40' : ''}`}
                      >
                        <td className="whitespace-nowrap px-4 py-2.5 text-xs text-gray-500">
                          {fmtDateTime(row.date)}
                        </td>
                        {vis('orderNumber') && (
                          <td className="whitespace-nowrap px-4 py-2.5">
                            <span className="font-mono text-xs font-semibold text-gray-800">
                              {highlight(row.orderNumber, debouncedSearch)}
                            </span>
                            {row.isVoided && (
                              <span className="ml-1.5 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">
                                VOID
                              </span>
                            )}
                          </td>
                        )}
                        {vis('cashier') && (
                          <td className="whitespace-nowrap px-4 py-2.5 text-sm text-gray-600">
                            {highlight(row.cashier, debouncedSearch)}
                          </td>
                        )}
                        <td className="max-w-[200px] truncate px-4 py-2.5 font-medium text-gray-900">
                          {highlight(row.product, debouncedSearch)}
                        </td>
                        {vis('variant') && (
                          <td className="px-4 py-2.5 text-sm text-gray-500">
                            {row.variant ? (
                              highlight(row.variant, debouncedSearch)
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                        )}
                        {vis('category') && (
                          <td className="whitespace-nowrap px-4 py-2.5 text-sm text-gray-500">
                            {row.category ? (
                              highlight(row.category, debouncedSearch)
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                        )}
                        {vis('subcategory') && (
                          <td className="whitespace-nowrap px-4 py-2.5 text-sm text-gray-500">
                            {row.subcategory ? (
                              highlight(row.subcategory, debouncedSearch)
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                        )}
                        {vis('brand') && (
                          <td className="whitespace-nowrap px-4 py-2.5 text-sm text-gray-500">
                            {row.brand ? (
                              highlight(row.brand, debouncedSearch)
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                        )}
                        <td className="whitespace-nowrap px-4 py-2.5 text-sm text-gray-600">
                          {row.warehouse || (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-center text-sm font-medium tabular-nums text-gray-700">
                          {row.qty}
                        </td>
                        {vis('unitPrice') && (
                          <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm tabular-nums text-gray-600">
                            {formatCurrency(row.unitPrice)}
                          </td>
                        )}
                        {vis('gross') && (
                          <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm tabular-nums text-gray-500">
                            {formatCurrency(row.gross)}
                          </td>
                        )}
                        {vis('discount') && (
                          <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm tabular-nums">
                            {row.discount > 0 ? (
                              <span className="text-orange-500">
                                −{formatCurrency(row.discount)}
                              </span>
                            ) : (
                              <span className="text-gray-200">—</span>
                            )}
                          </td>
                        )}
                        <td className="whitespace-nowrap px-4 py-2.5 text-right font-semibold tabular-nums text-gray-900">
                          {formatCurrency(row.subtotal)}
                        </td>
                        {showProfit && hasCostData && (
                          <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm tabular-nums">
                            {row.profit > 0 ? (
                              <span className="font-medium text-teal-600">
                                {formatCurrency(row.profit)}
                              </span>
                            ) : (
                              <span className="text-gray-200">—</span>
                            )}
                          </td>
                        )}
                        {vis('payment') && (
                          <td className="whitespace-nowrap px-4 py-2.5">
                            <span
                              className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${METHOD_COLOR[row.paymentMethod] ?? 'border border-gray-200 bg-gray-100 text-gray-600'}`}
                            >
                              {METHOD_LABEL[row.paymentMethod] ??
                                row.paymentMethod}
                            </span>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
                {sorted.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-gray-200 bg-gray-50 text-xs font-semibold">
                      <td
                        colSpan={
                          1 +
                          (vis('orderNumber') ? 1 : 0) +
                          (vis('cashier') ? 1 : 0) +
                          1 +
                          (vis('variant') ? 1 : 0) +
                          (vis('category') ? 1 : 0) +
                          (vis('subcategory') ? 1 : 0) +
                          (vis('brand') ? 1 : 0)
                        }
                        className="px-4 py-3 text-gray-400"
                      >
                        {sorted.length.toLocaleString()} line
                        {sorted.length !== 1 ? 's' : ''}
                      </td>
                      <td className="px-4 py-3 text-center tabular-nums text-gray-700">
                        {sorted.reduce((s, r) => s + r.qty, 0).toLocaleString()}
                      </td>
                      {vis('unitPrice') && <td className="px-4 py-3" />}
                      {vis('gross') && (
                        <td className="px-4 py-3 text-right tabular-nums text-gray-500">
                          {formatCurrency(
                            sorted.reduce((s, r) => s + r.gross, 0)
                          )}
                        </td>
                      )}
                      {vis('discount') && (
                        <td className="px-4 py-3 text-right tabular-nums text-orange-500">
                          −
                          {formatCurrency(
                            sorted.reduce((s, r) => s + r.discount, 0)
                          )}
                        </td>
                      )}
                      <td className="px-4 py-3 text-right tabular-nums text-[#b20202]">
                        {formatCurrency(
                          sorted.reduce((s, r) => s + r.subtotal, 0)
                        )}
                      </td>
                      {showProfit && hasCostData && (
                        <td className="px-4 py-3 text-right tabular-nums text-teal-600">
                          {formatCurrency(
                            sorted.reduce((s, r) => s + r.profit, 0)
                          )}
                        </td>
                      )}
                      {vis('payment') && <td className="px-4 py-3" />}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            <PageBar
              page={page}
              totalPages={lineTotalPages}
              totalItems={sorted.length}
              pageSize={PAGE_SIZE}
              onPrev={() => setPage((p) => Math.max(1, p - 1))}
              onNext={() => setPage((p) => Math.min(lineTotalPages, p + 1))}
              onPage={setPage}
            />
          </div>
        ) : (
          /* ── Grouped view ── */
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    {[
                      {
                        field: 'key' as GroupSortField,
                        label: groupLabel,
                        align: 'text-left',
                      },
                      {
                        field: 'qty' as GroupSortField,
                        label: 'Qty Sold',
                        align: 'text-center',
                      },
                      {
                        field: 'gross' as GroupSortField,
                        label: 'Gross Revenue',
                        align: 'text-right',
                      },
                      {
                        field: 'discount' as GroupSortField,
                        label: 'Discount',
                        align: 'text-right',
                      },
                      {
                        field: 'revenue' as GroupSortField,
                        label: 'Net Revenue',
                        align: 'text-right',
                      },
                      ...(showProfit && hasCostData
                        ? [
                            {
                              field: 'profit' as GroupSortField,
                              label: 'Profit',
                              align: 'text-right',
                            },
                          ]
                        : []),
                      {
                        field: 'share' as GroupSortField,
                        label: 'Revenue Share',
                        align: 'text-left',
                      },
                      {
                        field: 'lineCount' as GroupSortField,
                        label: 'Lines',
                        align: 'text-center',
                      },
                      {
                        field: 'orderCount' as GroupSortField,
                        label: 'Orders',
                        align: 'text-center',
                      },
                    ].map(({ field, label, align }) => (
                      <th
                        key={field}
                        onClick={() => toggleGroupSort(field)}
                        className={`cursor-pointer select-none whitespace-nowrap px-4 py-3 ${align} hover:text-gray-700`}
                      >
                        <span className="inline-flex items-center gap-1">
                          {label}
                          <SortChevron
                            active={groupSortField === field}
                            dir={groupSortDir}
                          />
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedGroup.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="py-20 text-center text-sm text-gray-400"
                      >
                        {allRows.length === 0
                          ? 'No sales data found.'
                          : 'No data matches the current filters.'}
                      </td>
                    </tr>
                  ) : (
                    paginatedGroup.map((row, i) => (
                      <tr
                        key={row.key}
                        className={`border-b border-gray-50 transition-colors hover:bg-blue-50/20 ${i % 2 === 1 ? 'bg-gray-50/30' : ''}`}
                      >
                        <td className="max-w-[240px] truncate px-4 py-2.5 font-medium text-gray-900">
                          {highlight(row.key, debouncedSearch)}
                        </td>
                        <td className="px-4 py-2.5 text-center tabular-nums text-gray-700">
                          {row.qty.toLocaleString()}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-gray-500">
                          {formatCurrency(row.gross)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">
                          {row.discount > 0 ? (
                            <span className="text-orange-500">
                              −{formatCurrency(row.discount)}
                            </span>
                          ) : (
                            <span className="text-gray-200">—</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right font-semibold tabular-nums text-gray-900">
                          {formatCurrency(row.revenue)}
                        </td>
                        {showProfit && hasCostData && (
                          <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">
                            {row.profit > 0 ? (
                              <span className="font-medium text-teal-600">
                                {formatCurrency(row.profit)}
                              </span>
                            ) : (
                              <span className="text-gray-200">—</span>
                            )}
                          </td>
                        )}
                        <td className="min-w-[160px] px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                              <div
                                className="h-full rounded-full bg-[#b20202] transition-all"
                                style={{
                                  width: `${Math.min(100, row.share)}%`,
                                }}
                              />
                            </div>
                            <span className="w-10 shrink-0 text-right text-xs tabular-nums text-gray-500">
                              {row.share.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-center tabular-nums text-gray-500">
                          {row.lineCount}
                        </td>
                        <td className="px-4 py-2.5 text-center tabular-nums text-gray-500">
                          {row.orderCount}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {grouped.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-gray-200 bg-gray-50 text-xs font-semibold">
                      <td className="px-4 py-3 text-gray-400">
                        {grouped.length} group{grouped.length !== 1 ? 's' : ''}
                      </td>
                      <td className="px-4 py-3 text-center tabular-nums text-gray-700">
                        {grouped
                          .reduce((s, r) => s + r.qty, 0)
                          .toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-500">
                        {formatCurrency(
                          grouped.reduce((s, r) => s + r.gross, 0)
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-orange-500">
                        −
                        {formatCurrency(
                          grouped.reduce((s, r) => s + r.discount, 0)
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-[#b20202]">
                        {formatCurrency(
                          grouped.reduce((s, r) => s + r.revenue, 0)
                        )}
                      </td>
                      {showProfit && hasCostData && (
                        <td className="px-4 py-3 text-right tabular-nums text-teal-600">
                          {formatCurrency(
                            grouped.reduce((s, r) => s + r.profit, 0)
                          )}
                        </td>
                      )}
                      <td className="px-4 py-3" />
                      <td className="px-4 py-3 text-center tabular-nums text-gray-700">
                        {grouped
                          .reduce((s, r) => s + r.lineCount, 0)
                          .toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-center tabular-nums text-gray-700">
                        {new Set(
                          filtered.map((r) => r.orderId)
                        ).size.toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            <PageBar
              page={groupPage}
              totalPages={groupTotalPages}
              totalItems={grouped.length}
              pageSize={GROUP_PAGE_SIZE}
              onPrev={() => setGroupPage((p) => Math.max(1, p - 1))}
              onNext={() =>
                setGroupPage((p) => Math.min(groupTotalPages, p + 1))
              }
              onPage={setGroupPage}
            />
          </div>
        )}

        {/* Truncation notice */}
        {truncated && !loading && (
          <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-700">
            <span>
              Showing first 500 orders only — older data may be missing.
            </span>
            <button
              type="button"
              onClick={() => fetchOrders(true)}
              className="ml-4 font-medium underline hover:no-underline"
            >
              Load all
            </button>
          </div>
        )}
      </div>

      {/* Export column picker modal */}
      {exportDialog.open && (
        <ExportColumnModal
          format={exportDialog.format}
          isGrouped={viewMode === 'grouped'}
          hasCost={hasCostData && showProfit}
          lineCols={exportDialog.lineCols}
          groupCols={exportDialog.groupCols}
          onToggleLine={toggleExportLineCol}
          onToggleGroup={toggleExportGroupCol}
          onSelectAll={selectAllExportCols}
          onDeselectAll={deselectAllExportCols}
          onCancel={() => setExportDialog((prev) => ({ ...prev, open: false }))}
          onDownload={confirmExport}
        />
      )}
    </div>
  );
}
