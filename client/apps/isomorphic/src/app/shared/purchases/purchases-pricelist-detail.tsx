'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  PiArrowLeft,
  PiCheck,
  PiTrash,
  PiFloppyDisk,
  PiCloudArrowDown,
  PiRobot,
} from 'react-icons/pi';
import toast from 'react-hot-toast';
import { routes } from '@/config/routes';
import {
  vendorPricelistService,
  type VendorPricelist,
  type PricelistItem,
} from '@/services/vendorPricelist.service';
import { fmtCur } from './purchases-analytics-helpers';
import { fraunces } from './purchases-fonts';
import {
  LineItemsEditor,
  netPrice,
  isBigJump,
} from './purchases-pricelist-shared';

const CURRENCIES = ['NGN', 'USD', 'EUR', 'GBP'];

export default function PurchasesPricelistDetail({ id }: { id: string }) {
  const router = useRouter();
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';

  const [pl, setPl] = useState<VendorPricelist | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await vendorPricelistService.getPricelist(id, token);
      setPl(res.data);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => {
    load();
  }, [load]);

  function patch(p: Partial<VendorPricelist>) {
    setPl((prev) => (prev ? { ...prev, ...p } : prev));
  }
  function setLines(items: PricelistItem[]) {
    setPl((prev) => (prev ? { ...prev, items } : prev));
  }

  const totals = useMemo(() => {
    const items = pl?.items ?? [];
    const value = items.reduce((s, l) => s + netPrice(l), 0);
    const preferred = items.filter((l) => l.isPreferred).length;
    const alerts = items.filter((l) => isBigJump(l)).length;
    return { lines: items.length, value, preferred, alerts };
  }, [pl]);

  async function save() {
    if (!pl) return;
    if (!pl.name?.trim()) {
      toast.error('Pricelist name is required');
      return;
    }
    setSaving(true);
    try {
      await vendorPricelistService.updatePricelist(
        id,
        {
          name: pl.name,
          vendorName: pl.vendorName,
          currency: pl.currency,
          isActive: pl.isActive,
          discountPercent: pl.discountPercent,
          notes: pl.notes,
          autoManaged: pl.autoManaged,
          source: pl.source,
          startDate: pl.startDate,
          endDate: pl.endDate,
          items: pl.items,
        },
        token
      );
      toast.success('Pricelist saved');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function syncFromLastPO() {
    if (!pl) return;
    setSyncing(true);
    try {
      const res = await vendorPricelistService.syncNow(id, token);
      if (!res.success) {
        toast.error(res.message || 'Nothing to sync');
      } else {
        toast.success(
          `Synced from ${res.result?.poNumber ?? 'last PO'} — ${res.result?.changed ?? 0} price change(s)`
        );
        if (res.data) setPl(res.data);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }

  async function remove() {
    if (!pl) return;
    if (!confirm(`Delete pricelist "${pl.name}"? This cannot be undone.`))
      return;
    setDeleting(true);
    try {
      await vendorPricelistService.deletePricelist(id, token);
      toast.success('Pricelist deleted');
      router.push(routes.eCommerce.vendorPricelists);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div>
        <div className="mb-6 h-28 animate-pulse rounded-2xl border border-[#ece4d6] bg-white" />
        <div className="h-[440px] animate-pulse rounded-2xl border border-[#ece4d6] bg-white" />
      </div>
    );
  }

  if (!pl) {
    return (
      <div className="rounded-2xl border border-[#ece4d6] bg-white py-20 text-center">
        <p className="text-sm text-gray-500">Pricelist not found</p>
        <Link
          href={routes.eCommerce.vendorPricelists}
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[#b20202]"
        >
          <PiArrowLeft className="h-4 w-4" /> Back to pricelists
        </Link>
      </div>
    );
  }

  const inputCls =
    'w-full rounded-lg border border-[#ece4d6] px-3 py-2 text-sm focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/15';

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="relative overflow-hidden rounded-2xl border border-[#ece4d6] bg-white px-6 py-5 shadow-sm">
        <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-[#b20202] via-[#d9a05b] to-[#b20202]" />
        <Link
          href={routes.eCommerce.vendorPricelists}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-[#b20202]"
        >
          <PiArrowLeft className="h-3.5 w-3.5" /> Pricelists
        </Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#b20202]/70">
              {pl.vendorName || 'Vendor pricelist'}
            </p>
            <h1
              className={`${fraunces.className} mt-1 text-[26px] font-semibold leading-tight text-[#2a2420] sm:text-[30px]`}
            >
              {pl.name}
            </h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
              {pl.autoManaged || pl.source === 'auto' ? (
                <span className="bg-[#b20202]/8 inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold text-[#b20202]">
                  <PiRobot className="h-3 w-3" /> Auto-managed
                </span>
              ) : (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-500">
                  Manual
                </span>
              )}
              {pl.lastSyncedPO?.poNumber && (
                <span className="text-gray-400">
                  Last synced from{' '}
                  <span className="font-medium text-gray-600">
                    {pl.lastSyncedPO.poNumber}
                  </span>
                  {pl.lastSyncedAt
                    ? ` · ${new Date(pl.lastSyncedAt).toLocaleDateString()}`
                    : ''}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => patch({ isActive: !pl.isActive })}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                pl.isActive
                  ? 'bg-[#3d6b5c]/12 text-[#3d6b5c] hover:bg-[#3d6b5c]/20'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {pl.isActive ? 'Active' : 'Inactive'}
            </button>
            <button
              type="button"
              onClick={syncFromLastPO}
              disabled={syncing}
              className="flex items-center gap-1.5 rounded-lg border border-[#ece4d6] px-3 py-2 text-xs font-semibold text-gray-600 hover:border-[#b20202]/30 hover:bg-[#b20202]/5 hover:text-[#b20202] disabled:opacity-50"
            >
              <PiCloudArrowDown className="h-3.5 w-3.5" />
              {syncing ? 'Syncing…' : 'Sync from last PO'}
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={deleting}
              className="flex items-center gap-1.5 rounded-lg border border-[#ece4d6] px-3 py-2 text-xs font-semibold text-gray-500 hover:border-red-200 hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
            >
              <PiTrash className="h-3.5 w-3.5" /> Delete
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9a0101] disabled:opacity-50"
            >
              <PiFloppyDisk className="h-4 w-4" />
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>

        {/* quick stats */}
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[#f1ece2] pt-4 sm:grid-cols-4">
          {[
            { label: 'Price Lines', value: String(totals.lines) },
            {
              label: 'Catalogue Value',
              value: fmtCur(totals.value, pl.currency),
            },
            { label: 'Preferred', value: String(totals.preferred) },
            { label: 'Price Alerts', value: String(totals.alerts) },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                {s.label}
              </p>
              <p
                className={`${fraunces.className} mt-0.5 text-lg font-semibold tabular-nums text-[#2a2420]`}
              >
                {s.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Metadata ── */}
      <div className="rounded-2xl border border-[#ece4d6] bg-white p-5 shadow-sm">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Pricelist Name
            </label>
            <input
              value={pl.name}
              onChange={(e) => patch({ name: e.target.value })}
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Vendor
            </label>
            <input
              value={pl.vendorName ?? ''}
              onChange={(e) => patch({ vendorName: e.target.value })}
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Currency
            </label>
            <select
              value={pl.currency}
              onChange={(e) => patch({ currency: e.target.value })}
              className={inputCls}
            >
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Global Discount %
            </label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={pl.discountPercent ?? 0}
              onChange={(e) =>
                patch({ discountPercent: Number(e.target.value) })
              }
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Auto-managed
            </label>
            <button
              type="button"
              onClick={() => {
                const turningOn = !(pl.autoManaged || pl.source === 'auto');
                patch({
                  autoManaged: turningOn,
                  source: turningOn ? 'auto' : 'manual',
                });
              }}
              className={`w-full rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                pl.autoManaged || pl.source === 'auto'
                  ? 'border-[#b20202]/30 bg-[#b20202]/5 text-[#b20202]'
                  : 'border-[#ece4d6] text-gray-500 hover:bg-[#FAF8F3]'
              }`}
            >
              {pl.autoManaged || pl.source === 'auto'
                ? 'Auto-syncs from POs'
                : 'Manual (locked)'}
            </button>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Start Date
            </label>
            <input
              type="date"
              value={pl.startDate ? pl.startDate.slice(0, 10) : ''}
              onChange={(e) => patch({ startDate: e.target.value })}
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              End Date
            </label>
            <input
              type="date"
              value={pl.endDate ? pl.endDate.slice(0, 10) : ''}
              onChange={(e) => patch({ endDate: e.target.value })}
              className={inputCls}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Notes
            </label>
            <input
              value={pl.notes ?? ''}
              onChange={(e) => patch({ notes: e.target.value })}
              placeholder="Optional notes…"
              className={inputCls}
            />
          </div>
        </div>
      </div>

      {/* ── Line items ── */}
      <LineItemsEditor
        lines={pl.items ?? []}
        currency={pl.currency}
        onChange={setLines}
      />

      <div className="flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9a0101] disabled:opacity-50"
        >
          <PiCheck className="h-4 w-4" />
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
