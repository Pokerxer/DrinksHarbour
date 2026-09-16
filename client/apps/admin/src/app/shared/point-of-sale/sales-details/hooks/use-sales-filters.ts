'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import type {
  StatusFilter,
  ViewMode,
  GroupByKey,
  LineSortField,
  GroupSortField,
  ToggleableCol,
} from '../types';
import { TOGGLEABLE_COLS, DATE_PRESETS } from '../constants';

export function useSalesFilters() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [timeFrom, setTimeFrom] = useState('00:00');
  const [timeTo, setTimeTo] = useState('23:59');
  const [activePreset, setActivePreset] = useState('');

  const [cashierFilter, setCashierFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const [lineSortField, setLineSortField] = useState<LineSortField>('date');
  const [lineSortDir, setLineSortDir] = useState<'asc' | 'desc'>('desc');
  const [groupSortField, setGroupSortField] = useState<GroupSortField>('revenue');
  const [groupSortDir, setGroupSortDir] = useState<'asc' | 'desc'>('desc');

  const [viewMode, setViewMode] = useState<ViewMode>('lines');
  const [groupBy, setGroupBy] = useState<GroupByKey>('product');
  const [showProfit, setShowProfit] = useState(false);
  const [hiddenCols, setHiddenCols] = useState<Set<ToggleableCol>>(
    new Set<ToggleableCol>(
      TOGGLEABLE_COLS.filter((c) => c.defaultHidden).map((c) => c.key)
    )
  );

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 280);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
      if (e.key === 'Escape' && document.activeElement === searchRef.current) {
        setSearch('');
        searchRef.current?.blur();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  function applyPreset(preset: (typeof DATE_PRESETS)[0]) {
    setDateFrom(preset.from());
    setDateTo(preset.to());
    setTimeFrom(preset.tf);
    setTimeTo(preset.tt);
    setActivePreset(preset.label);
  }

  function clearDateRange() {
    setDateFrom('');
    setDateTo('');
    setTimeFrom('00:00');
    setTimeTo('23:59');
    setActivePreset('');
  }

  function clearAll() {
    clearDateRange();
    setCashierFilter('');
    setMethodFilter('');
    setStatusFilter('active');
    setSearch('');
  }

  function toggleLineSort(field: LineSortField) {
    if (lineSortField === field)
      setLineSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setLineSortField(field);
      setLineSortDir(field === 'date' ? 'desc' : 'asc');
    }
  }

  function toggleGroupSort(field: GroupSortField) {
    if (groupSortField === field)
      setGroupSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setGroupSortField(field);
      setGroupSortDir('desc');
    }
  }

  function toggleCol(key: ToggleableCol) {
    setHiddenCols((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  const vis = (key: ToggleableCol) => !hiddenCols.has(key);

  const filterChips = useMemo(() => {
    const chips: { label: string; onRemove: () => void }[] = [];
    if (dateFrom || dateTo)
      chips.push({
        label: `${dateFrom || '…'}${timeFrom !== '00:00' ? ` ${timeFrom}` : ''} → ${dateTo || '…'}${timeTo !== '23:59' ? ` ${timeTo}` : ''}`,
        onRemove: clearDateRange,
      });
    if (cashierFilter)
      chips.push({
        label: cashierFilter,
        onRemove: () => setCashierFilter(''),
      });
    if (methodFilter)
      chips.push({
        label: methodFilter === 'card' ? 'Card/POS' : methodFilter,
        onRemove: () => setMethodFilter(''),
      });
    if (search)
      chips.push({
        label: `"${search.slice(0, 24)}${search.length > 24 ? '…' : ''}"`,
        onRemove: () => setSearch(''),
      });
    return chips;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo, timeFrom, timeTo, cashierFilter, methodFilter, search]);

  return {
    dateFrom, setDateFrom, dateTo, setDateTo,
    timeFrom, setTimeFrom, timeTo, setTimeTo,
    activePreset, setActivePreset, applyPreset, clearDateRange,
    cashierFilter, setCashierFilter,
    methodFilter, setMethodFilter,
    statusFilter, setStatusFilter,
    search, setSearch, debouncedSearch,
    searchFocused, setSearchFocused, searchRef,
    lineSortField, lineSortDir, toggleLineSort,
    groupSortField, groupSortDir, toggleGroupSort,
    viewMode, setViewMode, groupBy, setGroupBy,
    showProfit, setShowProfit,
    hiddenCols, setHiddenCols, toggleCol, vis,
    filterChips,
    clearAll,
  };
}
