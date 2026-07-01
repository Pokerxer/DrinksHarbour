'use client';

import { useMemo, useCallback } from 'react';
import { AdvancedSearch } from '../advanced-search';
import type { FilterValue, SavedSearch as AdvSavedSearch, CustomGroup } from '../advanced-search/advanced-search-types';
import { FILTER_CONFIGS } from '../advanced-search/filter-config-data';
import { DOC_TYPE_FILTERS } from '../advanced-search/filter-config-data';
import type { ActiveFilter, GroupByKey, GroupBySubOption, SavedSearch, DatePreset } from './sales-list-helpers';
import { activeFilterToFilterValue, filterValueToActiveFilter } from './sales-list-helpers';

interface SalesListFilterPanelProps {
  open: boolean;
  onClose: () => void;
  activeFilters: ActiveFilter[];
  onAddFilter: (f: ActiveFilter) => void;
  onRemoveFilter: (id: string) => void;
  onClearFilters: () => void;
  groupBy: GroupByKey;
  groupBySubOption?: GroupBySubOption;
  onSetGroupBy: (key: GroupByKey, subOption?: GroupBySubOption) => void;
  onSetDate: (preset: DatePreset | null) => void;
  customGroups: CustomGroup[];
  onAddCustomGroup: (group: CustomGroup) => void;
  onRemoveCustomGroup: (id: string) => void;
  favorites: SavedSearch[];
  onApplyFavorite: (fav: SavedSearch) => void;
  onSaveFavorite: (name: string) => void;
  onDeleteFavorite: (id: string) => void;
  dateFrom: string;
  dateTo: string;
  onDateFrom: (v: string) => void;
  onDateTo: (v: string) => void;
  triggerRef: React.RefObject<HTMLDivElement | null>;
}

export default function SalesListFilterPanel({
  open, onClose, activeFilters, onAddFilter, onRemoveFilter, onClearFilters,
  groupBy, groupBySubOption, onSetGroupBy, onSetDate,
  customGroups, onAddCustomGroup, onRemoveCustomGroup,
  favorites, onApplyFavorite, onSaveFavorite,
  onDeleteFavorite, dateFrom, dateTo, onDateFrom, onDateTo, triggerRef,
}: SalesListFilterPanelProps) {
  const advSavedSearches: AdvSavedSearch[] = useMemo(
    () => favorites.map((f) => ({
      id: f.id, name: f.name, groupBy: f.groupBy === 'none' ? '' : f.groupBy, search: f.search,
      filters: f.filters.map(activeFilterToFilterValue).filter((fv): fv is FilterValue => fv !== null),
    })),
    [favorites],
  );

  const activeDocTypes: string[] = useMemo(
    () => activeFilters.filter((f) => f.type === 'docType' || f.type === 'my').map((f) => f.id),
    [activeFilters],
  );

  const activeDatePreset: string | null = useMemo(() => {
    const df = activeFilters.find((f) => f.type === 'date');
    if (df?.value) return df.value;
    if (dateFrom || dateTo) return 'custom';
    return null;
  }, [activeFilters, dateFrom, dateTo]);

  const handleToggleDocType = useCallback((id: string) => {
    const existing = activeFilters.find((f) => f.type === 'docType' && f.id === id)
      || activeFilters.find((f) => f.type === 'my' && f.id === id);
    if (existing) {
      onRemoveFilter(existing.id);
    } else {
      if (id === 'my') {
        onAddFilter({ id: 'my', label: 'My Quotations', type: 'my' });
      } else if (id === 'quotation') {
        onAddFilter({ id: 'quotation', label: 'Quotations', type: 'docType', value: 'quotation' });
      } else if (id === 'order') {
        onAddFilter({ id: 'order', label: 'Sales Orders', type: 'docType', value: 'order' });
      }
    }
  }, [activeFilters, onAddFilter, onRemoveFilter]);

  const handleSetDatePreset = useCallback((presetId: string | null) => {
    if (presetId === 'custom') {
      if (dateFrom || dateTo) {
        onDateFrom('');
        onDateTo('');
      }
      return;
    }
    const mapper: Record<string, DatePreset | null> = {
      'today': 'today', 'yesterday': 'yesterday', 'last7': 'last7',
      'this-week': 'week', 'this-month': 'month', 'last-month': 'last-month',
      'this-quarter': 'quarter', 'last-quarter': 'last-quarter',
      'this-year': 'year', 'last-year': 'last-year',
    };
    onSetDate(presetId ? (mapper[presetId] ?? null) : null);
    if (presetId) {
      onDateFrom('');
      onDateTo('');
    }
  }, [onSetDate, dateFrom, dateTo, onDateFrom, onDateTo]);

  const handleAddFilter = useCallback((fv: FilterValue) => {
    onAddFilter(filterValueToActiveFilter(fv, FILTER_CONFIGS));
  }, [onAddFilter]);

  const handleRemoveFilter = useCallback((fieldId: string) => {
    const found = activeFilters.find(
      (f) => f.id === fieldId || f.filterValue?.fieldId === fieldId,
    );
    if (found) onRemoveFilter(found.id);
  }, [activeFilters, onRemoveFilter]);

  const syncedFilterValues: FilterValue[] = useMemo(
    () => activeFilters.map(activeFilterToFilterValue).filter((fv): fv is FilterValue => fv !== null),
    [activeFilters],
  );

  const handleSetGroupBy = useCallback((id: string, subOption?: string) => {
    onSetGroupBy((id || 'none') as GroupByKey, (subOption || undefined) as GroupBySubOption | undefined);
  }, [onSetGroupBy]);

  const handleApplyFavorite = useCallback((adv: AdvSavedSearch) => {
    onApplyFavorite({
      id: adv.id, name: adv.name,
      groupBy: (adv.groupBy || 'none') as GroupByKey,
      groupBySubOption: adv.groupBySubOption as GroupBySubOption | undefined,
      search: adv.search,
      filters: adv.filters.map((fv) => filterValueToActiveFilter(fv, FILTER_CONFIGS)),
    });
  }, [onApplyFavorite]);

  if (!open) return null;

  return (
    <AdvancedSearch
      open={open}
      onClose={onClose}
      activeFilters={syncedFilterValues}
      onAddFilter={handleAddFilter}
      onRemoveFilter={handleRemoveFilter}
      onClearFilters={onClearFilters}
      groupBy={groupBy === 'none' ? '' : groupBy}
      groupBySubOption={groupBySubOption || ''}
      onSetGroupBy={handleSetGroupBy}
      customGroups={customGroups}
      onAddCustomGroup={onAddCustomGroup}
      onRemoveCustomGroup={onRemoveCustomGroup}
      favorites={advSavedSearches}
      onSaveFavorite={onSaveFavorite}
      onApplyFavorite={handleApplyFavorite}
      onDeleteFavorite={onDeleteFavorite}
      docTypeFilters={DOC_TYPE_FILTERS}
      onToggleDocType={handleToggleDocType}
      activeDocTypes={activeDocTypes}
      onSetDatePreset={handleSetDatePreset}
      activeDatePreset={activeDatePreset}
      dateFrom={dateFrom}
      dateTo={dateTo}
      onDateFrom={onDateFrom}
      onDateTo={onDateTo}
      triggerRef={triggerRef}
    />
  );
}
