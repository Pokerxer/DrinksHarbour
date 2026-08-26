// app/shared/accounting/accounting-helpers.ts
//
// Pure display/format logic for the Accounting module (dashboard, journal
// browser, reports, chart of accounts). No React, no fetch — unit-testable.

import type { Account, JournalEntry, JournalEntryType } from '@/services/accounting.service';

export const ENTRY_TYPE_LABELS: Record<JournalEntryType | string, string> = {
  accrued_revenue: 'Accrued Revenue',
  sales_revenue: 'Sales Revenue',
  refund: 'Refund',
  manual: 'Manual',
  expense_accrual: 'Expense Accrual',
  cogs: 'COGS',
  tax_collected: 'Tax Collected',
  tax_paid: 'Tax Paid',
  inventory_adjust: 'Inventory Adjust',
  reversal: 'Reversal',
  customer_payment: 'Customer Payment',
  vendor_payment: 'Vendor Payment',
};

export const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  asset: 'Assets',
  liability: 'Liabilities',
  equity: 'Equity',
  income: 'Income',
  expense: 'Expenses',
};

export const ACCOUNT_TYPE_ORDER = ['asset', 'liability', 'equity', 'income', 'expense'] as const;

export const REFDOC_LABELS: Record<string, string> = {
  SalesOrder: 'Sales Order',
  PurchaseOrder: 'Purchase Order',
  VendorBill: 'Vendor Bill',
  VendorReturn: 'Vendor Return',
  StockTransfer: 'Stock Transfer',
  Manual: 'Manual',
};

export const fmtMoney = (n: number) =>
  `₦ ${(Number(n) || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

/** Compact naira for chart axes: ₦1.2m · ₦450k · ₦250. */
export const fmtAxisMoney = (n: number): string => {
  const v = Number(n) || 0;
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `₦${(v / 1_000_000).toFixed(1)}m`;
  if (abs >= 1_000) return `₦${(v / 1_000).toFixed(0)}k`;
  return `₦${Math.round(v)}`;
};

export const fmtDate = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    : '—';

export const STATUS_STYLES: Record<string, string> = {
  posted: 'bg-emerald-100 text-emerald-700',
  draft: 'bg-amber-100 text-amber-700',
};

/** Live balanced check for the manual-entry form. */
export const linesBalanced = (
  lines: Array<{ debit: string; credit: string }>
): { balanced: boolean; debit: number; credit: number } => {
  const num = (v: string) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const debit = Math.round(lines.reduce((s, l) => s + num(l.debit), 0) * 100) / 100;
  const credit = Math.round(lines.reduce((s, l) => s + num(l.credit), 0) * 100) / 100;
  return { balanced: Math.abs(debit - credit) <= 0.01 && debit > 0, debit, credit };
};

/** Debit/credit totals of a single entry, kobo-safe. */
export const entryTotals = (entry: JournalEntry): { debit: number; credit: number } => {
  const sum = (key: 'debit' | 'credit') =>
    Math.round(entry.lines.reduce((s, l) => s + (l[key] || 0), 0) * 100) / 100;
  return { debit: sum('debit'), credit: sum('credit') };
};

/** "1–25 of 132" window label for paginated toolbars; "" when nothing matches. */
export const pageWindowLabel = (page: number, size: number, total: number): string => {
  if (!total) return '';
  const start = (page - 1) * size + 1;
  const end = Math.min(page * size, total);
  return `${start}–${end} of ${total}`;
};

/** Group accounts by type in canonical order for the COA table. */
export function groupAccountsByType(accounts: Account[]) {
  return ACCOUNT_TYPE_ORDER.map((type) => ({
    type,
    label: ACCOUNT_TYPE_LABELS[type],
    rows: accounts.filter((a) => a.type === type),
  })).filter((g) => g.rows.length > 0);
}

export const entryTypeLabel = (t: string) => ENTRY_TYPE_LABELS[t] ?? t;
export const refDocLabel = (t: string) => REFDOC_LABELS[t] ?? t;

export const postedByLabel = (e: JournalEntry) =>
  e.postedBy?.name || e.postedBy?._id || '—';

/**
 * Quote a value for CSV and neutralise spreadsheet formula injection (values
 * beginning with = + - @ get a leading apostrophe). Mirrors the inventory
 * receipts guard.
 */
export function csvCell(v: string | number | null | undefined): string {
  const s = String(v ?? '');
  const guarded = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${guarded.replace(/"/g, '""')}"`;
}

/** Download rows as CSV with the formula-injection guard applied. */
export function downloadCsv(
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>,
  prefix = 'accounting'
) {
  const csv = [
    headers.map(csvCell).join(','),
    ...rows.map((r) => r.map(csvCell).join(',')),
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${prefix}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const esc = (s: string | number | null | undefined) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Open a print window for a tabular report. Shared by all report tables so
 * styling stays identical; rows are HTML-escaped and amounts pre-formatted.
 */
export function printReport({
  title,
  subtitle,
  headers,
  rows,
  foot,
}: {
  title: string;
  subtitle?: string;
  headers: string[];
  rows: Array<Array<string | number | null | undefined>>;
  foot?: Array<string | number | null | undefined>;
}) {
  const body = rows
    .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`)
    .join('');
  const tfoot = foot ? `<tfoot><tr>${foot.map((c) => `<td>${esc(c)}</td>`).join('')}</tr></tfoot>` : '';
  const html = `<!doctype html><html><head><title>${esc(title)}</title><style>
    body{font-family:-apple-system,'Segoe UI',Roboto,sans-serif;margin:32px;color:#111827}
    h1{font-size:18px}.sub{color:#6b7280;font-size:12px}
    table{width:100%;border-collapse:collapse;font-size:12px;margin-top:16px}
    th{text-align:left;border-bottom:1px solid #e5e7eb;padding:6px 8px;text-transform:uppercase;font-size:9px;color:#6b7280}
    td{border-bottom:1px solid #f3f4f6;padding:7px 8px}
    td.num,th.num{text-align:right;font-variant-numeric:tabular-nums}
    tfoot td{font-weight:700;border-top:2px solid #e5e7eb}
  </style></head><body>
  <h1>${esc(title)}</h1><p class="sub">${esc(subtitle ?? '')} · printed ${new Date().toLocaleString()}</p>
  <table><thead><tr>${headers.map((h, i) => `<th${i > 0 && /amount|debit|credit|balance|closing/i.test(h) ? ' class="num"' : ''}>${esc(h)}</th>`).join('')}</tr></thead>
  <tbody>${body}</tbody>${tfoot}</table><script>window.onload=()=>window.print()</script></body></html>`;
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) return;
  win.document.write(html);
  win.document.close();
}

/** Human label for a from/to date window, e.g. "1 Aug – 26 Aug 2026". */
export const dateWindowLabel = (from?: string, to?: string): string => {
  const fmt = (iso?: string) =>
    iso
      ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
      : '…';
  if (!from && !to) return 'All time';
  return `${from ? fmt(from) : 'Start'} – ${to ? `${fmt(to)} ${new Date(to).getFullYear()}` : 'Today'}`;
};

/** Month label for YYYY-MM period keys, e.g. "August 2026". */
export const periodLabel = (period: string): string => {
  const [y, m] = period.split('-').map(Number);
  if (!y || !m) return period;
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
};
