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
