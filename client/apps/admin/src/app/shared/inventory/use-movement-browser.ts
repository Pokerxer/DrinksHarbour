'use client';
import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import type { InventoryMovement } from '@/services/inventory.service';
import { PAGE_SIZE, whCell, productLabel } from './inventory-receipts-support';
import { PRESETS, type MovesPresetKey } from './inventory-movements-presets';
import { computeMoveStats } from './inventory-movements-summary';
import { useInventoryMovements } from './use-inventory-movements';
import {
  matchesMovement,
  movementBounds,
  movementProducts,
  movementWarehouses,
  movementStats,
  toggleMovementPage,
} from './inventory-movement-view';
import {
  sortMovements,
  groupMovements,
  MOVEMENT_HEADERS as HEADERS,
} from './inventory-movement-groups';
import { matchesInternalRoute } from './inventory-internal-view';
import { useMovementFilterState } from './use-movement-filter-state';
import { canAdjustInventory } from '@/utils/authorization';
import type { UserRole } from '@/types/authorization';
export function useMovementBrowser(presetKey: MovesPresetKey) {
  const preset = PRESETS[presetKey];
  const { data: session, status: sessionStatus } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const role = (session?.user as { role?: UserRole })?.role;

  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<InventoryMovement | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const filters = useMovementFilterState(preset.savedKey, () => setPage(1));
  const {
    productFilter,
    search,
    groupBy,
    tabFilter,
    statusFilter,
    sortCol,
    sortDir,
    dateFrom,
    dateTo,
    timeFrom,
    timeTo,
    warehouseFilter,
    supplierFilter,
    sourceFilter,
    fromWarehouse,
    toWarehouse,
  } = filters;

  const { moves, loading, errorMsg, truncated, fetchMoves } = useInventoryMovements(
    token,
    sessionStatus,
    presetKey,
    dateFrom,
    dateTo,
    timeFrom,
    timeTo,
  );
  const refreshing = false;

  useEffect(() => {
    setExpandedGroups(new Set());
  }, [groupBy]);
  useEffect(() => {
    setPage(1);
  }, [
    search,
    productFilter,
    tabFilter,
    statusFilter,
    dateFrom,
    dateTo,
    timeFrom,
    timeTo,
    warehouseFilter,
    supplierFilter,
    sourceFilter,
    fromWarehouse,
    toWarehouse,
    sortCol,
    sortDir,
  ]);

  // Escape closes the detail panel.
  useEffect(() => {
    if (!selected) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setSelected(null);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  const warehouses = useMemo(() => movementWarehouses(moves), [moves]);
  const products = useMemo(() => movementProducts(moves), [moves]);
  const sources = useMemo(
    () => Array.from(new Set(moves.map((m) => m.source).filter(Boolean))).sort(),
    [moves],
  );
  const suppliers = useMemo(
    () => Array.from(new Set(moves.map((m) => m.supplierName).filter(Boolean) as string[])).sort(),
    [moves],
  );

  // ── Filter + sort ────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...moves];

    const tab = preset.tabs.find((t) => t.key === tabFilter);
    if (tab?.match) list = list.filter(tab.match);

    if (statusFilter) list = list.filter((m) => m.status === statusFilter);

    const bounds = movementBounds(dateFrom, dateTo, timeFrom, timeTo);
    if (bounds.error) return [];
    list = list.filter((m) =>
      matchesMovement(m, {
        search,
        products: productFilter,
        warehouse: warehouseFilter,
        start: bounds.start,
        end: bounds.end,
        receipt: preset.showSupplier,
      }),
    );
    if (supplierFilter) list = list.filter((m) => m.supplierName === supplierFilter);

    if (sourceFilter) list = list.filter((m) => m.source === sourceFilter);

    if (preset.showRoute)
      list = list.filter((m) => matchesInternalRoute(m, fromWarehouse, toWarehouse));
    sortMovements(list, sortCol, sortDir, preset.showSupplier);
    return list;
  }, [
    moves,
    preset.tabs,
    tabFilter,
    statusFilter,
    search,
    productFilter,
    dateFrom,
    dateTo,
    timeFrom,
    timeTo,
    warehouseFilter,
    supplierFilter,
    sourceFilter,
    fromWarehouse,
    toWarehouse,
    sortCol,
    sortDir,
  ]);

  const stats = useMemo(() => computeMoveStats(filtered, whCell, productLabel), [filtered]);

  // Group by
  const grouped = useMemo((): [string, InventoryMovement[]][] | null => {
    if (!groupBy) return null;
    return groupMovements(filtered, groupBy, preset.showSupplier);
  }, [filtered, groupBy, preset.showSupplier]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  useEffect(() => {
    setPage((p) => Math.min(p, totalPages));
  }, [totalPages]);
  useEffect(() => {
    const ids = new Set(filtered.map((m) => m._id));
    setChecked((prev) => new Set(Array.from(prev).filter((id) => ids.has(id))));
    setSelected((prev) => (prev ? filtered.find((m) => m._id === prev._id) || null : null));
  }, [filtered]);
  const exportDisabled = loading || !!errorMsg || truncated || filtered.length === 0;
  const paginated = grouped ? [] : filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const displayList = grouped ? filtered : paginated;
  const filteredTotalCost = stats.cost;

  const allChecked = displayList.length > 0 && displayList.every((m) => checked.has(m._id));
  const someChecked = checked.size > 0 && !allChecked;
  const checkedMoves = filtered.filter((m) => checked.has(m._id));
  const checkedUnits = movementStats(checkedMoves).units;
  function toggleAll() {
    setChecked((prev) => toggleMovementPage(prev, displayList, allChecked));
  }
  function toggleOne(id: string) {
    setChecked((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function toggleGroup(name: string) {
    setExpandedGroups((prev) => {
      const n = new Set(prev);
      if (n.has(name)) n.delete(name);
      else n.add(name);
      return n;
    });
  }

  const columns = preset.showSupplier
    ? [...HEADERS.slice(0, 4), { col: 'supplier' as const, label: 'Supplier' }, ...HEADERS.slice(4)]
    : preset.showSource
      ? [...HEADERS.slice(0, 4), { col: 'source' as const, label: 'Source' }, ...HEADERS.slice(4)]
      : HEADERS;

  return {
    ...filters,
    preset,
    token,
    canAdjust: !!role && canAdjustInventory(role),
    sessionStatus,
    moves,
    loading,
    errorMsg,
    truncated,
    fetchMoves,
    refreshing,
    page,
    setPage,
    selected,
    setSelected,
    checked,
    setChecked,
    expandedGroups,
    warehouses,
    products,
    suppliers,
    sources,
    filtered,
    stats,
    grouped,
    totalPages,
    paginated,
    displayList,
    filteredTotalCost,
    allChecked,
    someChecked,
    checkedMoves,
    checkedUnits,
    toggleAll,
    toggleOne,
    toggleGroup,
    HEADERS: preset.showReason
      ? [
          ...columns.slice(
            0,
            columns.findIndex((h) => h.col === 'qty'),
          ),
          { col: 'reason' as const, label: 'Reason' },
          ...columns.slice(columns.findIndex((h) => h.col === 'qty')),
        ]
      : columns,
    exportDisabled,
  };
}
export type MovementBrowserView = ReturnType<typeof useMovementBrowser>;
