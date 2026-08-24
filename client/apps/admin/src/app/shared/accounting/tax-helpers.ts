// app/shared/accounting/tax-helpers.ts
//
// Pure display/format logic for the Taxes screen (rates, ledger, summary).
// No React, no fetch — everything here is unit-testable in isolation.

import type { Tax } from '@/services/tax.service';

export const SOURCE_LABELS: Record<string, string> = {
  sales_order: 'Sales Order',
  purchase_order: 'Purchase Order',
  vendor_bill: 'Vendor Bill',
  stock_transfer: 'Stock Transfer',
  vendor_return: 'Vendor Return',
};

export const DIRECTION_LABELS: Record<string, string> = {
  collected: 'Collected',
  paid: 'Paid',
  internal: 'Internal',
};

export const fmtMoney = (n: number, currency = 'NGN') =>
  `${currency === 'NGN' ? '₦' : currency} ${(Number(n) || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export const fmtDate = (iso: string) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '—';

export const appliesToLabel = (flows: Tax['appliesTo']) =>
  flows.length === 4 ? 'All flows' : flows.join(', ');

export const isValidTaxForm = (t: { name: string; rate: string; type: string }) =>
  t.name.trim().length > 0 &&
  t.name.trim().length <= 100 &&
  Number.isFinite(Number(t.rate)) &&
  Number(t.rate) >= 0 &&
  Number(t.rate) <= 100 &&
  ['output', 'input'].includes(t.type);
