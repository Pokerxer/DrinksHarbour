'use client';
import { useState } from 'react';
import {
  DATE_PRESETS,
  type GroupKey,
  type SavedSearch,
  type SortCol,
  type SortDir,
} from './inventory-receipts-support';
import { useMovementSavedSearches, type MovementSavedSearch } from './inventory-movement-saved';
export function useMovementFilterState(savedKey: string, resetPage: () => void) {
  const [productFilter, setProductFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showPanel, setShowPanel] = useState(false);
  const [groupBy, setGroupBy] = useState<GroupKey | null>(null);
  const { savedSearches, save, deleteSaved } = useMovementSavedSearches(savedKey);
  const [tabFilter, setTabFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortCol, setSortCol] = useState<SortCol>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [timeFrom, setTimeFrom] = useState('00:00');
  const [timeTo, setTimeTo] = useState('23:59');
  const [activePreset, setActivePreset] = useState('');

  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [fromWarehouse, setFromWarehouse] = useState('');
  const [toWarehouse, setToWarehouse] = useState('');

  function saveSearch(name: string) {
    const entry: MovementSavedSearch = {
      id: Date.now().toString(),
      name,
      query: search,
      groupBy,
      products: productFilter,
      warehouse: warehouseFilter,
      supplier: supplierFilter,
      source: sourceFilter,
      fromWarehouse,
      toWarehouse,
      status: statusFilter,
      tab: tabFilter,
      from: dateFrom,
      to: dateTo,
      timeFrom,
      timeTo,
      sortCol,
      sortDir,
    };
    save(entry);
  }
  function loadSavedSearch(s: SavedSearch) {
    const view = s as MovementSavedSearch;
    setProductFilter(view.products || '');
    setWarehouseFilter(view.warehouse || '');
    setSupplierFilter(view.supplier || '');
    setSourceFilter(view.source || '');
    setFromWarehouse(view.fromWarehouse || '');
    setToWarehouse(view.toWarehouse || '');
    setStatusFilter(view.status || '');
    setTabFilter(view.tab || 'all');
    setDateFrom(view.from || '');
    setDateTo(view.to || '');
    setTimeFrom(view.timeFrom || '00:00');
    setTimeTo(view.timeTo || '23:59');
    setSortCol(view.sortCol || 'date');
    setSortDir(view.sortDir || 'desc');
    setActivePreset('');
    setSearch(s.query);
    setGroupBy(s.groupBy);
    resetPage();
  }
  function applyPreset(p: (typeof DATE_PRESETS)[0]) {
    setDateFrom(p.from());
    setDateTo(p.to());
    setTimeFrom(p.tf);
    setTimeTo(p.tt);
    setActivePreset(p.label);
  }
  function clearDateRange() {
    setDateFrom('');
    setDateTo('');
    setTimeFrom('00:00');
    setTimeTo('23:59');
    setActivePreset('');
  }
  function clearAllFilters() {
    setSearch('');
    setProductFilter('');
    setGroupBy(null);
    setTabFilter('all');
    setStatusFilter('');
    clearDateRange();
    setWarehouseFilter('');
    setSupplierFilter('');
    setSourceFilter('');
    setFromWarehouse('');
    setToWarehouse('');
    setSortCol('date');
    setSortDir('desc');
    resetPage();
  }

  function handleSort(col: SortCol) {
    if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortCol(col);
      setSortDir(col === 'date' ? 'desc' : 'asc');
    }
  }
  const hasAnyFilter =
    !!search ||
    !!productFilter ||
    !!dateFrom ||
    !!dateTo ||
    timeFrom !== '00:00' ||
    timeTo !== '23:59' ||
    sortCol !== 'date' ||
    sortDir !== 'desc' ||
    !!warehouseFilter ||
    !!supplierFilter ||
    !!sourceFilter ||
    !!fromWarehouse ||
    !!toWarehouse ||
    !!statusFilter ||
    tabFilter !== 'all' ||
    !!groupBy;

  return {
    productFilter,
    setProductFilter,
    search,
    setSearch,
    showPanel,
    setShowPanel,
    groupBy,
    setGroupBy,
    savedSearches,
    tabFilter,
    setTabFilter,
    statusFilter,
    setStatusFilter,
    sortCol,
    sortDir,
    dateFrom,
    dateTo,
    timeFrom,
    timeTo,
    setDateFrom,
    setDateTo,
    setTimeFrom,
    setTimeTo,
    activePreset,
    setActivePreset,
    warehouseFilter,
    setWarehouseFilter,
    supplierFilter,
    setSupplierFilter,
    sourceFilter,
    setSourceFilter,
    fromWarehouse,
    setFromWarehouse,
    toWarehouse,
    setToWarehouse,
    saveSearch,
    loadSavedSearch,
    deleteSaved,
    applyPreset,
    clearDateRange,
    clearAllFilters,
    handleSort,
    hasAnyFilter,
  };
}
