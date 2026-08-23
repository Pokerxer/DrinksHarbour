'use client';

import toast from 'react-hot-toast';
import {
  PiCopySimple,
  PiDownloadSimple,
  PiToggleLeft,
  PiToggleRight,
  PiTrash,
  PiX,
} from 'react-icons/pi';
import {
  vendorPricelistService,
  type VendorPricelist,
} from '@/services/vendorPricelist.service';
import { isAutoList } from './list-parts';

export function duplicatePayload(
  pl: VendorPricelist
): Partial<VendorPricelist> {
  return {
    name: `${pl.name} (copy)`,
    vendor: pl.vendor,
    vendorName: pl.vendorName,
    currency: pl.currency,
    discountPercent: pl.discountPercent,
    notes: pl.notes,
    isActive: false,
    items: pl.items,
  };
}

export async function runBulkAction(
  label: string,
  ids: string[],
  action: (id: string) => Promise<unknown>,
  after: { clear: () => void; reload: () => Promise<void> }
): Promise<void> {
  if (ids.length === 0) return;
  const results = await Promise.allSettled(ids.map(action));
  const ok = results.filter((r) => r.status === 'fulfilled').length;
  const summary = `${label}: ${ok} succeeded, ${ids.length - ok} failed`;
  if (ok === ids.length) toast.success(summary);
  else toast.error(summary);
  after.clear();
  await after.reload();
}

export async function deletePricelists(
  ids: string[],
  token: string,
  after: { clear: () => void; reload: () => Promise<void> }
): Promise<boolean> {
  if (ids.length === 0) return false;
  const results = await Promise.allSettled(
    ids.map((id) => vendorPricelistService.deletePricelist(id, token))
  );
  const ok = results.filter((r) => r.status === 'fulfilled').length;
  if (ok === ids.length) {
    toast.success(
      ids.length === 1 ? 'Pricelist deleted' : `${ok} pricelists deleted`
    );
  } else {
    toast.error(`Delete: ${ok} succeeded, ${ids.length - ok} failed`);
  }
  after.clear();
  await after.reload();
  return true;
}

export function exportOverviewCsv(
  lists: VendorPricelist[],
  ids: Set<string>
): number {
  const rows = lists
    .filter((l) => ids.has(l._id))
    .map((l) => ({
      name: l.name,
      vendorName: l.vendorName,
      currency: l.currency,
      auto: isAutoList(l),
      isActive: l.isActive,
      lineCount: l.items?.length ?? 0,
      lastSyncedAt: l.lastSyncedAt,
    }));
  downloadCsv(buildOverviewCsv(rows), 'vendor-pricelists.csv');
  return rows.length;
}

export interface OverviewCsvRow {
  name: string;
  vendorName: string;
  currency: string;
  auto: boolean;
  isActive: boolean;
  lineCount: number;
  lastSyncedAt?: string;
}

const OVERVIEW_COLUMNS = [
  'name',
  'vendorName',
  'currency',
  'source',
  'isActive',
  'lineCount',
  'lastSyncedAt',
];

export function buildOverviewCsv(rows: OverviewCsvRow[]): string {
  const cell = (v: unknown): string => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = rows.map((r) =>
    [
      cell(r.name),
      cell(r.vendorName),
      cell(r.currency),
      cell(r.auto ? 'auto' : 'manual'),
      cell(r.isActive),
      cell(r.lineCount),
      cell(r.lastSyncedAt ?? ''),
    ].join(',')
  );
  return [OVERVIEW_COLUMNS.join(','), ...lines].join('\n');
}

export function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const btnCls =
  'flex items-center gap-1 whitespace-nowrap rounded-lg border border-white/25 px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/10 disabled:opacity-50';

export default function BulkBar({
  count,
  busy,
  onActivate,
  onDeactivate,
  onDuplicate,
  onExport,
  onDelete,
  onClear,
}: {
  count: number;
  busy: boolean;
  onActivate: () => void;
  onDeactivate: () => void;
  onDuplicate: () => void;
  onExport: () => void;
  onDelete: () => void;
  onClear: () => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-4 z-40 mx-auto flex w-fit max-w-[95vw] items-center gap-2 overflow-x-auto rounded-xl bg-[#2a2420] px-4 py-2.5 shadow-2xl">
      <span className="whitespace-nowrap text-xs font-semibold text-white">
        {count} selected
      </span>
      <button type="button" className={btnCls} disabled={busy} onClick={onActivate}>
        <PiToggleRight className="h-3.5 w-3.5" /> Activate
      </button>
      <button type="button" className={btnCls} disabled={busy} onClick={onDeactivate}>
        <PiToggleLeft className="h-3.5 w-3.5" /> Deactivate
      </button>
      <button type="button" className={btnCls} disabled={busy} onClick={onDuplicate}>
        <PiCopySimple className="h-3.5 w-3.5" /> Duplicate
      </button>
      <button type="button" className={btnCls} disabled={busy} onClick={onExport}>
        <PiDownloadSimple className="h-3.5 w-3.5" /> Export CSV
      </button>
      <button
        type="button"
        className={`${btnCls} hover:bg-red-500/20`}
        disabled={busy}
        onClick={onDelete}
      >
        <PiTrash className="h-3.5 w-3.5" /> Delete
      </button>
      <button
        type="button"
        aria-label="Clear selection"
        title="Clear selection"
        className="rounded-lg p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
        onClick={onClear}
      >
        <PiX className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
