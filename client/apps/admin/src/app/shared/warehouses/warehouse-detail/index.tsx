'use client';

// app/shared/warehouses/warehouse-detail/index.tsx
// Orchestrator for the warehouse detail page. Owns view state (search /
// status filter / view mode / sort — all mirrored into the URL query so a
// refresh or shared link restores the exact view) and the action modals
// (adjust, transfer, edit). Data lives in use-warehouse-detail.

import { useCallback, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import { AnimatePresence } from 'framer-motion';
import {
  warehouseService,
  type WarehouseBatch,
  type WarehouseInput,
} from '@/services/warehouse.service';
import type { WarehouseStockRow } from '@/services/warehouseStock.service';
import WarehouseFormModal, {
  warehouseToForm,
} from '../warehouse-form-modal';
import {
  productNameOf,
  sizeLabelOf,
  skuOf,
  sizeIdOf,
  subProductIdOf,
} from '../warehouse-ref-helpers';
import {
  availOf,
  sortValueOf,
  statusOf,
  type SortKey,
} from './row-utils';
import { buildExportColumns } from './export-helpers';
import { useWarehouseDetail } from './use-warehouse-detail';
import DetailHeader from './detail-header';
import StatsCards from './stats-cards';
import StockToolbar, { type DetailView } from './stock-toolbar';
import StockCard from './stock-card';
import StockTable from './stock-table';
import ExportMenu from './export-menu';
import AdjustStockModal from './adjust-stock-modal';
import TransferStockModal from './transfer-stock-modal';
import SubProductInventoryDrawer from './subproduct-inventory-drawer';
import { GridSkeleton, TableSkeleton } from './skeletons';
import {
  EmptyState,
  ErrorState,
  FilteredEmptyState,
  NotFoundState,
} from './states';

type SortDir = 'asc' | 'desc';

const SORT_KEYS: SortKey[] = [
  'name',
  'size',
  'onHand',
  'reserved',
  'available',
  'status',
];

export default function WarehouseDetail({
  warehouseId,
}: {
  warehouseId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';

  // ── URL-synced view state (initialised once from the query string) ──
  const [view, setViewState] = useState<DetailView>(() =>
    searchParams.get('view') === 'table' ? 'table' : 'grid'
  );
  const [search, setSearchState] = useState(() => searchParams.get('q') ?? '');
  const [filter, setFilterState] = useState(
    () => searchParams.get('f') ?? ''
  );
  const [sortKey, setSortKeyState] = useState<SortKey | null>(() => {
    const v = searchParams.get('sort');
    return v && (SORT_KEYS as string[]).includes(v) ? (v as SortKey) : null;
  });
  const [sortDir, setSortDirState] = useState<SortDir>(() =>
    searchParams.get('dir') === 'desc' ? 'desc' : 'asc'
  );

  const syncUrl = useCallback(
    (patch: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === '') params.delete(k);
        else params.set(k, v);
      }
      const qs = params.toString();
      router.replace(qs ? `?${qs}` : '?', { scroll: false });
    },
    [router, searchParams]
  );

  const setView = useCallback(
    (v: DetailView) => {
      setViewState(v);
      syncUrl({ view: v === 'grid' ? null : v });
    },
    [syncUrl]
  );
  const setSearch = useCallback(
    (q: string) => {
      setSearchState(q);
      syncUrl({ q });
    },
    [syncUrl]
  );
  const setFilter = useCallback(
    (f: string) => {
      setFilterState(f);
      syncUrl({ f });
    },
    [syncUrl]
  );
  const toggleSort = useCallback(
    (k: SortKey) => {
      if (sortKey === k && sortDir === 'asc') {
        setSortDirState('desc');
        syncUrl({ dir: 'desc' });
      } else if (sortKey === k && sortDir === 'desc') {
        setSortKeyState(null);
        syncUrl({ sort: null, dir: null });
      } else {
        setSortKeyState(k);
        setSortDirState('asc');
        syncUrl({ sort: k, dir: null });
      }
    },
    [sortKey, sortDir, syncUrl]
  );

  // ── Data ──
  const { phase, errorMessage, warehouse, rows, lowStock, stats, reload } =
    useWarehouseDetail(warehouseId);

  // ── Batches (expanded row cache) ──
  const [expanded, setExpanded] = useState<string | null>(null);
  const [batchesByRow, setBatchesByRow] = useState<
    Record<string, WarehouseBatch[]>
  >({});
  const [batchLoading, setBatchLoading] = useState<string | null>(null);

  const toggleBatches = useCallback(
    async (r: WarehouseStockRow) => {
      if (expanded === r._id) {
        setExpanded(null);
        return;
      }
      setExpanded(r._id);
      if (batchesByRow[r._id]) return;
      const subProduct = subProductIdOf(r);
      const size = sizeIdOf(r);
      if (!subProduct || !size || !token) return;
      setBatchLoading(r._id);
      try {
        const res = await warehouseService.getBatches(warehouseId, token, {
          subProduct,
          size,
        });
        setBatchesByRow((prev) => ({ ...prev, [r._id]: res.data ?? [] }));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to load batches');
        setExpanded((cur) => (cur === r._id ? null : cur));
      } finally {
        setBatchLoading((cur) => (cur === r._id ? null : cur));
      }
    },
    [expanded, batchesByRow, token, warehouseId]
  );

  // ── Action modals ──
  const [adjustRow, setAdjustRow] = useState<WarehouseStockRow | null>(null);
  const [viewRow, setViewRow] = useState<WarehouseStockRow | null>(null);
  const [transferRow, setTransferRow] = useState<WarehouseStockRow | null>(
    null
  );
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<WarehouseInput | null>(null);
  const [saving, setSaving] = useState(false);

  const openEdit = useCallback(() => {
    if (!warehouse) return;
    setForm(warehouseToForm(warehouse));
    setEditOpen(true);
  }, [warehouse]);

  const saveEdit = async () => {
    if (!warehouse || !form) return;
    if (!form.name.trim()) return toast.error('Name is required');
    setSaving(true);
    try {
      await warehouseService.updateWarehouse(warehouse._id, form, token);
      toast.success('Warehouse updated');
      setEditOpen(false);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleActionDone = useCallback(async () => {
    setAdjustRow(null);
    setTransferRow(null);
    setViewRow(null);
    // Batch caches are stale after any quantity change.
    setBatchesByRow({});
    setExpanded(null);
    await reload();
  }, [reload]);

  // Opening an action modal from the drawer hands control over to the modal.
  const openFromDrawer = useCallback(
    (fn: (r: WarehouseStockRow) => void) => (r: WarehouseStockRow) => {
      setViewRow(null);
      fn(r);
    },
    []
  );

  // ── Derived rows ──
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const out = rows.filter((r) => {
      if (filter === 'low_out' && statusOf(r, lowStock) === 'in_stock')
        return false;
      if (!q) return true;
      return (
        String(productNameOf(r)).toLowerCase().includes(q) ||
        String(skuOf(r)).toLowerCase().includes(q) ||
        String(sizeLabelOf(r)).toLowerCase().includes(q)
      );
    });
    if (sortKey) {
      const dir = sortDir === 'asc' ? 1 : -1;
      out.sort((a, b) => {
        const va = sortValueOf(a, sortKey, lowStock);
        const vb = sortValueOf(b, sortKey, lowStock);
        if (va < vb) return -1 * dir;
        if (va > vb) return 1 * dir;
        return 0;
      });
    }
    return out;
  }, [rows, search, filter, sortKey, sortDir, lowStock]);

  const totals = useMemo(
    () => ({
      onHand: filteredRows.reduce((s, r) => s + r.currentQuantity, 0),
      reserved: filteredRows.reduce((s, r) => s + r.reservedQuantity, 0),
      available: filteredRows.reduce((s, r) => s + availOf(r), 0),
    }),
    [filteredRows]
  );

  const exportColumns = useMemo(
    () => buildExportColumns(lowStock),
    [lowStock]
  );

  const lowOutCount = useMemo(
    () => rows.filter((r) => statusOf(r, lowStock) !== 'in_stock').length,
    [rows, lowStock]
  );

  // ── Render ──
  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-3 py-4 sm:px-4 sm:py-6">
      <DetailHeader
        warehouse={phase === 'ready' ? warehouse : null}
        loading={phase === 'loading'}
        onEdit={openEdit}
        onRefresh={reload}
        exportSlot={
          phase === 'ready' ? (
            <ExportMenu
              rows={filteredRows}
              warehouse={warehouse}
              warehouseId={warehouseId}
              filter={filter}
              search={search}
              columns={exportColumns}
              totals={totals}
            />
          ) : undefined
        }
      />

      {phase === 'not_found' ? (
        <NotFoundState />
      ) : phase === 'error' ? (
        <ErrorState message={errorMessage} onRetry={reload} />
      ) : (
        <>
          <StatsCards
            stats={{ ...stats, lowOut: lowOutCount }}
            activeFilter={filter}
            onFilterChange={setFilter}
          />

          <StockToolbar
            search={search}
            onSearchChange={setSearch}
            filter={filter}
            onFilterChange={setFilter}
            view={view}
            onViewChange={setView}
            shownCount={filteredRows.length}
            totalCount={rows.length}
          />

          {phase === 'loading' ? (
            view === 'grid' ? (
              <GridSkeleton />
            ) : (
              <TableSkeleton />
            )
          ) : filteredRows.length === 0 ? (
            rows.length === 0 ? (
              <EmptyState />
            ) : (
              <FilteredEmptyState
                onClearFilters={() => {
                  setSearch('');
                  setFilter('');
                }}
              />
            )
          ) : view === 'grid' ? (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <AnimatePresence initial={false}>
                  {filteredRows.map((r) => (
                    <StockCard
                      key={r._id}
                      r={r}
                      isOpen={expanded === r._id}
                      batchLoading={batchLoading === r._id}
                      batches={batchesByRow[r._id]}
                      onToggleBatches={toggleBatches}
                      onAdjust={setAdjustRow}
                      onTransfer={setTransferRow}
                      onView={setViewRow}
                      lowStock={lowStock}
                    />
                  ))}
                </AnimatePresence>
              </div>
              <TotalsBar totals={totals} count={filteredRows.length} />
            </>
          ) : (
            <>
              <StockTable
                rows={filteredRows}
                lowStock={lowStock}
                expandedId={expanded}
                batchLoadingId={batchLoading}
                batchesByRow={batchesByRow}
                sortKey={sortKey}
                sortDir={sortDir}
                totals={totals}
                onSortToggle={toggleSort}
                onToggleBatches={toggleBatches}
                onAdjust={setAdjustRow}
                onTransfer={setTransferRow}
                onView={setViewRow}
              />
              <TotalsBar totals={totals} count={filteredRows.length} inline />
            </>
          )}
        </>
      )}

      {/* ── Modals ── */}
      {viewRow && (
        <SubProductInventoryDrawer
          warehouseId={warehouseId}
          row={viewRow}
          onClose={() => setViewRow(null)}
          onAdjust={openFromDrawer(setAdjustRow)}
          onTransfer={openFromDrawer(setTransferRow)}
        />
      )}
      {adjustRow && (
        <AdjustStockModal
          warehouseId={warehouseId}
          row={adjustRow}
          onClose={() => setAdjustRow(null)}
          onDone={handleActionDone}
        />
      )}
      {transferRow && (
        <TransferStockModal
          warehouseId={warehouseId}
          row={transferRow}
          onClose={() => setTransferRow(null)}
          onDone={handleActionDone}
        />
      )}
      {editOpen && form && (
        <WarehouseFormModal
          editing={warehouse}
          form={form}
          setForm={setForm}
          saving={saving}
          onClose={() => setEditOpen(false)}
          onSave={saveEdit}
        />
      )}
    </main>
  );
}

function TotalsBar({
  totals,
  count,
  inline = false,
}: {
  totals: { onHand: number; reserved: number; available: number };
  count: number;
  inline?: boolean;
}) {
  return (
    <div
      className={`flex flex-wrap items-center gap-x-6 gap-y-1 rounded-2xl border border-[#ece4d6] bg-white px-5 py-3 text-sm shadow-sm ${
        inline ? '' : 'mt-4'
      }`}
    >
      <span className="mr-auto font-bold text-gray-700">
        Totals · {count} lines
      </span>
      <span className="text-gray-500">
        On hand{' '}
        <b className="tabular-nums text-gray-900">
          {totals.onHand.toLocaleString()}
        </b>
      </span>
      <span className="text-gray-500">
        Reserved{' '}
        <b className="tabular-nums text-gray-600">
          {totals.reserved.toLocaleString()}
        </b>
      </span>
      <span className="text-gray-500">
        Available{' '}
        <b className="tabular-nums text-[#b20202]">
          {totals.available.toLocaleString()}
        </b>
      </span>
    </div>
  );
}
