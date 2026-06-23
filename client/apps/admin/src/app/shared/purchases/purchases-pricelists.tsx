'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  PiPlus,
  PiArrowsClockwise,
  PiEye,
  PiMagnifyingGlass,
  PiCopySimple,
  PiTrash,
  PiToggleLeft,
  PiToggleRight,
  PiListChecks,
  PiScales,
  PiStack,
  PiTag,
  PiCloudArrowDown,
  PiBell,
  PiRobot,
} from 'react-icons/pi';
import toast from 'react-hot-toast';
import { routes } from '@/config/routes';
import {
  vendorPricelistService,
  type VendorPricelist,
} from '@/services/vendorPricelist.service';
import { fraunces } from './purchases-fonts';
import { PriceCompare } from './purchases-price-compare';
import { isBigJump } from './purchases-pricelist-shared';

type Tab = 'lists' | 'compare';
type StatusFilter = 'all' | 'active' | 'inactive';
type SourceFilter = 'all' | 'auto' | 'manual';
type SortKey = 'name' | 'vendor' | 'items' | 'recent';

export default function PurchasesPricelists() {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const [lists, setLists] = useState<VendorPricelist[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [tab, setTab] = useState<Tab>('lists');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('recent');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await vendorPricelistService.getPricelists(token);
      setLists(res.data ?? []);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  // ── Derived KPIs ─────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const active = lists.filter((l) => l.isActive).length;
    const vendors = new Set(
      lists.map((l) => l.vendorName?.trim()).filter(Boolean)
    ).size;
    const lines = lists.reduce((s, l) => s + (l.items?.length ?? 0), 0);
    const auto = lists.filter(
      (l) => l.autoManaged || l.source === 'auto'
    ).length;
    const alerts = lists.reduce(
      (s, l) => s + (l.items?.filter((it) => isBigJump(it)).length ?? 0),
      0
    );
    return { total: lists.length, active, vendors, lines, auto, alerts };
  }, [lists]);

  // ── Filter + sort ────────────────────────────────────────────────────
  const visible = useMemo(() => {
    let out = [...lists];
    const q = search.trim().toLowerCase();
    if (q) {
      out = out.filter(
        (l) =>
          l.name?.toLowerCase().includes(q) ||
          l.vendorName?.toLowerCase().includes(q)
      );
    }
    if (status !== 'all') {
      out = out.filter((l) => (status === 'active' ? l.isActive : !l.isActive));
    }
    if (sourceFilter !== 'all') {
      out = out.filter((l) =>
        sourceFilter === 'auto'
          ? l.autoManaged || l.source === 'auto'
          : !(l.autoManaged || l.source === 'auto')
      );
    }
    out.sort((a, b) => {
      switch (sortKey) {
        case 'name':
          return (a.name ?? '').localeCompare(b.name ?? '');
        case 'vendor':
          return (a.vendorName ?? '').localeCompare(b.vendorName ?? '');
        case 'items':
          return (b.items?.length ?? 0) - (a.items?.length ?? 0);
        default:
          return (
            new Date(b.createdAt ?? 0).getTime() -
            new Date(a.createdAt ?? 0).getTime()
          );
      }
    });
    return out;
  }, [lists, search, status, sourceFilter, sortKey]);

  // ── Row actions ──────────────────────────────────────────────────────
  async function toggleActive(pl: VendorPricelist) {
    setBusyId(pl._id);
    try {
      await vendorPricelistService.updatePricelist(
        pl._id,
        { isActive: !pl.isActive },
        token
      );
      setLists((prev) =>
        prev.map((l) =>
          l._id === pl._id ? { ...l, isActive: !l.isActive } : l
        )
      );
      toast.success(pl.isActive ? 'Deactivated' : 'Activated');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setBusyId(null);
    }
  }

  async function duplicate(pl: VendorPricelist) {
    setBusyId(pl._id);
    try {
      await vendorPricelistService.createPricelist(
        {
          name: `${pl.name} (copy)`,
          vendor: pl.vendor,
          vendorName: pl.vendorName,
          currency: pl.currency,
          discountPercent: pl.discountPercent,
          notes: pl.notes,
          isActive: false,
          items: pl.items,
        },
        token
      );
      toast.success('Pricelist duplicated');
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Duplicate failed');
    } finally {
      setBusyId(null);
    }
  }

  async function remove(pl: VendorPricelist) {
    if (!confirm(`Delete pricelist "${pl.name}"? This cannot be undone.`))
      return;
    setBusyId(pl._id);
    try {
      await vendorPricelistService.deletePricelist(pl._id, token);
      setLists((prev) => prev.filter((l) => l._id !== pl._id));
      toast.success('Pricelist deleted');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setBusyId(null);
    }
  }

  async function syncNow(pl: VendorPricelist) {
    setBusyId(pl._id);
    try {
      const res = await vendorPricelistService.syncNow(pl._id, token);
      if (!res.success) {
        toast.error(res.message || 'Nothing to sync');
      } else {
        toast.success(
          `Synced from ${res.result?.poNumber ?? 'last PO'} — ${res.result?.changed ?? 0} price change(s)`
        );
        load();
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setBusyId(null);
    }
  }

  const kpiCards = [
    { label: 'Pricelists', value: kpis.total, icon: <PiListChecks /> },
    { label: 'Auto-managed', value: kpis.auto, icon: <PiRobot /> },
    { label: 'Price Lines', value: kpis.lines, icon: <PiStack /> },
    { label: 'Price Alerts', value: kpis.alerts, icon: <PiBell /> },
  ];

  return (
    <div>
      {/* ── Header ── */}
      <div className="relative mb-6 overflow-hidden rounded-2xl border border-[#ece4d6] bg-white px-6 py-5 shadow-sm">
        <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-[#b20202] via-[#d9a05b] to-[#b20202]" />
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#b20202]/70">
              Configuration
            </p>
            <h1
              className={`${fraunces.className} mt-1 text-[28px] font-semibold leading-tight text-[#2a2420] sm:text-[32px]`}
            >
              Vendor Pricelists
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Negotiated catalogues and per-vendor pricing for purchasing
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={load}
              title="Refresh"
              className="group flex items-center gap-1.5 rounded-lg border border-[#ece4d6] bg-white px-3.5 py-2 text-xs font-semibold text-gray-600 transition-colors hover:border-[#b20202]/30 hover:bg-[#b20202]/5 hover:text-[#b20202]"
            >
              <PiArrowsClockwise className="h-3.5 w-3.5 transition-transform duration-500 group-active:-rotate-180" />
              Refresh
            </button>
            <Link
              href={routes.eCommerce.createVendorPricelist}
              className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#9a0101]"
            >
              <PiPlus className="h-4 w-4" /> New Pricelist
            </Link>
          </div>
        </div>
      </div>

      {/* ── KPI strip ── */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpiCards.map((k) => (
          <div
            key={k.label}
            className="rounded-2xl border border-[#ece4d6] bg-white p-4 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                {k.label}
              </p>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#b20202]/10 text-[#b20202]">
                <span className="[&>svg]:h-4 [&>svg]:w-4">{k.icon}</span>
              </span>
            </div>
            <p
              className={`${fraunces.className} mt-2 text-2xl font-semibold tabular-nums text-[#2a2420]`}
            >
              {k.value}
            </p>
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div className="mb-4 flex items-center gap-1 border-b border-[#ece4d6]">
        {(
          [
            { id: 'lists', label: 'Pricelists', icon: <PiListChecks /> },
            { id: 'compare', label: 'Price Compare', icon: <PiScales /> },
          ] as { id: Tab; label: string; icon: React.ReactNode }[]
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`-mb-px flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
              tab === t.id
                ? 'border-[#b20202] text-[#b20202]'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <span className="[&>svg]:h-4 [&>svg]:w-4">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'compare' ? (
        <PriceCompare />
      ) : (
        <>
          {/* ── Controls ── */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="flex flex-1 items-center gap-2 rounded-lg border border-[#ece4d6] bg-white px-3 py-2">
              <PiMagnifyingGlass className="h-4 w-4 shrink-0 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or vendor…"
                className="w-full text-sm outline-none placeholder:text-gray-400"
              />
            </div>
            <div className="flex overflow-hidden rounded-lg border border-[#ece4d6]">
              {(['all', 'active', 'inactive'] as StatusFilter[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={`px-3 py-2 text-xs font-semibold capitalize transition-colors ${
                    status === s
                      ? 'bg-[#b20202] text-white'
                      : 'bg-white text-gray-500 hover:bg-[#FAF8F3]'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="flex overflow-hidden rounded-lg border border-[#ece4d6]">
              {(['all', 'auto', 'manual'] as SourceFilter[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSourceFilter(s)}
                  className={`px-3 py-2 text-xs font-semibold capitalize transition-colors ${
                    sourceFilter === s
                      ? 'bg-[#b20202] text-white'
                      : 'bg-white text-gray-500 hover:bg-[#FAF8F3]'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5 rounded-lg border border-[#ece4d6] bg-white px-3 py-2">
              <PiTag className="h-3.5 w-3.5 text-gray-400" />
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                className="bg-transparent text-xs font-medium text-gray-600 outline-none"
              >
                <option value="recent">Most recent</option>
                <option value="name">Name (A–Z)</option>
                <option value="vendor">Vendor (A–Z)</option>
                <option value="items">Most lines</option>
              </select>
            </div>
          </div>

          {/* ── Table ── */}
          <div className="overflow-hidden rounded-2xl border border-[#ece4d6] bg-white shadow-sm">
            {loading ? (
              <div className="space-y-px p-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-12 animate-pulse rounded-lg bg-[#FAF8F3]"
                  />
                ))}
              </div>
            ) : visible.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#b20202]/5">
                  <PiListChecks className="h-5 w-5 text-[#b20202]/40" />
                </span>
                <p className="text-sm text-gray-500">
                  {lists.length === 0
                    ? 'No pricelists yet — create your first one'
                    : 'No pricelists match your filters'}
                </p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#ece4d6] bg-[#FAF8F3] text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Vendor</th>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3">Last Synced</th>
                    <th className="px-4 py-3">Currency</th>
                    <th className="px-4 py-3 text-right">Lines</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1ece2]">
                  {visible.map((pl) => (
                    <tr
                      key={pl._id}
                      className={`group transition-colors hover:bg-[#FAF8F3]/60 ${
                        busyId === pl._id ? 'opacity-50' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={routes.eCommerce.vendorPricelistDetails(pl._id)}
                          className="font-medium text-[#2a2420] hover:text-[#b20202]"
                        >
                          {pl.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {pl.vendorName || '—'}
                      </td>
                      <td className="px-4 py-3">
                        {pl.autoManaged || pl.source === 'auto' ? (
                          <span className="bg-[#b20202]/8 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold text-[#b20202]">
                            <PiRobot className="h-3 w-3" /> Auto
                          </span>
                        ) : (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
                            Manual
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {pl.lastSyncedAt
                          ? new Date(pl.lastSyncedAt).toLocaleDateString()
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-md bg-[#FAF8F3] px-2 py-0.5 text-xs font-medium text-gray-600">
                          {pl.currency}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-600">
                        {pl.items?.length ?? 0}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            pl.isActive
                              ? 'bg-[#3d6b5c]/12 text-[#3d6b5c]'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {pl.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-0.5 text-gray-400">
                          <button
                            type="button"
                            onClick={() => syncNow(pl)}
                            disabled={busyId === pl._id}
                            title="Sync now from last PO"
                            className="rounded p-1.5 hover:bg-[#b20202]/10 hover:text-[#b20202]"
                          >
                            <PiCloudArrowDown className="h-4 w-4" />
                          </button>
                          <Link
                            href={routes.eCommerce.vendorPricelistDetails(
                              pl._id
                            )}
                            title="View / edit"
                            className="rounded p-1.5 hover:bg-[#b20202]/10 hover:text-[#b20202]"
                          >
                            <PiEye className="h-4 w-4" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => toggleActive(pl)}
                            disabled={busyId === pl._id}
                            title={pl.isActive ? 'Deactivate' : 'Activate'}
                            className="rounded p-1.5 hover:bg-gray-100 hover:text-gray-700"
                          >
                            {pl.isActive ? (
                              <PiToggleRight className="h-4 w-4 text-[#3d6b5c]" />
                            ) : (
                              <PiToggleLeft className="h-4 w-4" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => duplicate(pl)}
                            disabled={busyId === pl._id}
                            title="Duplicate"
                            className="rounded p-1.5 hover:bg-gray-100 hover:text-gray-700"
                          >
                            <PiCopySimple className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => remove(pl)}
                            disabled={busyId === pl._id}
                            title="Delete"
                            className="rounded p-1.5 hover:bg-red-50 hover:text-red-500"
                          >
                            <PiTrash className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
