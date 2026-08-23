'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { PiListChecks, PiMagnifyingGlass, PiTag } from 'react-icons/pi';
import toast from 'react-hot-toast';
import { vendorPricelistService, type VendorPricelist } from '@/services/vendorPricelist.service';
import { PriceCompare } from '../purchases-price-compare';
import BulkBar, { deletePricelists, duplicatePayload, exportOverviewCsv, runBulkAction } from './bulk-bar';
import ConfirmDialog from './confirm-dialog';
import type { SortKey } from './constants';
import {
  computeKpis, filterSortLists, KpiStrip, PageHeader, parseListParams,
  SegmentedControl, SOURCE_OPTIONS, STATUS_OPTIONS, TabsBar,
} from './list-parts';
import { PricelistsCards, PricelistsTable, type RowHandlers } from './pricelist-row';

export default function PurchasesPricelistsListView() {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const router = useRouter();
  const searchParams = useSearchParams();

  const [lists, setLists] = useState<VendorPricelist[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[] | null>(null);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const { tab, q, status, source, sort } = useMemo(
    () => parseListParams(searchParams),
    [searchParams]
  );

  function setParams(patch: Record<string, string | null>) {
    const sp = new URLSearchParams(searchParams.toString());
    Object.entries(patch).forEach(([k, v]) =>
      v === null || v === '' ? sp.delete(k) : sp.set(k, v)
    );
    router.replace(`?${sp.toString()}`, { scroll: false });
  }

  const load = useCallback(async (pageToLoad = 1) => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await vendorPricelistService.getPricelists(token, { page: pageToLoad, limit: 100 });
      const fresh = res.data ?? [];
      setLists((prev) => (pageToLoad > 1 ? [...prev, ...fresh] : fresh));
      setPage(pageToLoad);
      setTotalCount(res.pagination?.total ?? fresh.length);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const kpis = useMemo(() => computeKpis(lists), [lists]);
  const visible = useMemo(
    () => filterSortLists(lists, { q, status, source, sort }),
    [lists, q, status, source, sort]
  );

  const allSelected = visible.length > 0 && visible.every((l) => selected.has(l._id));
  const someSelected = visible.some((l) => selected.has(l._id)) && !allSelected;

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      visible.forEach((l) =>
        allSelected ? next.delete(l._id) : next.add(l._id)
      );
      return next;
    });
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function toggleActive(pl: VendorPricelist) {
    setBusyId(pl._id);
    try {
      await vendorPricelistService.updatePricelist(pl._id, { isActive: !pl.isActive }, token);
      setLists((prev) => prev.map((l) => (l._id === pl._id ? { ...l, isActive: !l.isActive } : l)));
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
      await vendorPricelistService.createPricelist(duplicatePayload(pl), token);
      toast.success('Pricelist duplicated');
      await load(1);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Duplicate failed');
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
        await load(1);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setBusyId(null);
    }
  }

  function bulk(label: string, action: (id: string) => Promise<unknown>) {
    setBulkBusy(true);
    runBulkAction(label, Array.from(selected), action, {
      clear: () => setSelected(new Set()),
      reload: () => load(1),
    }).finally(() => setBulkBusy(false));
  }

  async function confirmDelete() {
    if (!pendingDeleteIds?.length) return;
    setBulkBusy(true);
    try {
      await deletePricelists(pendingDeleteIds, token, {
        clear: () => setSelected(new Set()),
        reload: () => load(1),
      });
    } finally {
      setPendingDeleteIds(null);
      setBulkBusy(false);
    }
  }

  function exportSelectedCsv() {
    const n = exportOverviewCsv(lists, selected);
    toast.success(`Exported ${n} pricelist(s)`);
  }

  const onSortChange = (k: SortKey) =>
    setParams({ sort: k === 'recent' ? null : k });

  const handlers: RowHandlers = {
    busyId,
    selected,
    onToggleCheck: toggleOne,
    onSync: (pl) => void syncNow(pl),
    onToggleActive: (pl) => void toggleActive(pl),
    onDuplicate: (pl) => void duplicate(pl),
    onDelete: (id) => setPendingDeleteIds([id]),
  };

  const setIdActive = (isActive: boolean) => (id: string) =>
    vendorPricelistService.updatePricelist(id, { isActive }, token);

  const duplicateById = async (id: string) => {
    const pl = lists.find((l) => l._id === id);
    if (!pl) throw new Error('Pricelist not found');
    await vendorPricelistService.createPricelist(duplicatePayload(pl), token);
  };

  const deleteTitle = pendingDeleteIds && pendingDeleteIds.length > 1 ? `Delete ${pendingDeleteIds.length} pricelists?` : 'Delete pricelist?';

  return (
    <div>
      <PageHeader onRefresh={() => void load(1)} />
      <KpiStrip kpis={kpis} />
      <TabsBar active={tab} onChange={(t) => setParams({ tab: t === 'lists' ? null : t })} />
      {tab === 'compare' ? (
        <PriceCompare />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-[#ece4d6] bg-white px-3 py-2">
              <PiMagnifyingGlass className="h-4 w-4 shrink-0 text-gray-400" />
              <input
                value={q}
                onChange={(e) => setParams({ q: e.target.value || null })}
                placeholder="Search by name or vendor…"
                aria-label="Search pricelists"
                className="w-full text-sm outline-none placeholder:text-gray-400"
              />
            </div>
            <SegmentedControl value={status} options={STATUS_OPTIONS} ariaLabel="Filter by status" onChange={(v) => setParams({ status: v === 'all' ? null : v })} />
            <SegmentedControl value={source} options={SOURCE_OPTIONS} ariaLabel="Filter by source" onChange={(v) => setParams({ source: v === 'all' ? null : v })} />
            <div className="flex items-center gap-1.5 rounded-lg border border-[#ece4d6] bg-white px-3 py-2">
              <PiTag className="h-3.5 w-3.5 text-gray-400" />
              <select
                value={sort}
                aria-label="Sort pricelists"
                onChange={(e) => setParams({ sort: e.target.value === 'recent' ? null : e.target.value })}
                className="bg-transparent text-xs font-medium text-gray-600 outline-none"
              >
                <option value="recent">Most recent</option>
                <option value="name">Name (A–Z)</option>
                <option value="vendor">Vendor (A–Z)</option>
                <option value="items">Most lines</option>
              </select>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-[#ece4d6] bg-white shadow-sm">
            {loading ? (
              <div className="space-y-px p-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-12 animate-pulse rounded-lg bg-[#FAF8F3]" />
                ))}
              </div>
            ) : visible.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#b20202]/5"><PiListChecks className="h-5 w-5 text-[#b20202]/40" /></span>
                <p className="text-sm text-gray-500">
                  {lists.length === 0 ? 'No pricelists yet — create your first one' : 'No pricelists match your filters'}
                </p>
              </div>
            ) : (
              <>
                <PricelistsTable
                  rows={visible} sort={sort} onSortChange={onSortChange}
                  allSelected={allSelected} someSelected={someSelected}
                  onToggleAll={toggleAll} handlers={handlers}
                />
                <PricelistsCards rows={visible} handlers={handlers} />
              </>
            )}
          </div>

          {!loading && lists.length < totalCount && (
            <div className="mt-3 flex justify-center">
              <button
                type="button"
                onClick={() => void load(page + 1)}
                disabled={loading}
                className="rounded-lg border border-[#ece4d6] bg-white px-4 py-2 text-xs font-semibold text-gray-600 transition-colors hover:border-[#b20202]/30 hover:text-[#b20202]"
              >
                Load more ({lists.length}/{totalCount})
              </button>
            </div>
          )}
        </>
      )}

      {selected.size > 0 && tab === 'lists' && (
        <BulkBar
          count={selected.size}
          busy={bulkBusy}
          onActivate={() => bulk('Activate', setIdActive(true))}
          onDeactivate={() => bulk('Deactivate', setIdActive(false))}
          onDuplicate={() => bulk('Duplicate', duplicateById)}
          onExport={exportSelectedCsv}
          onDelete={() => setPendingDeleteIds(Array.from(selected))}
          onClear={() => setSelected(new Set())}
        />
      )}

      <ConfirmDialog
        open={pendingDeleteIds !== null}
        title={deleteTitle}
        message="This cannot be undone."
        confirmLabel="Delete"
        busy={bulkBusy}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDeleteIds(null)}
      />
    </div>
  );
}
