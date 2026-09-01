'use client';

// client/apps/admin/src/app/shared/inventory/inventory-stock-filter-panel.tsx
//
// The stock browser's twin of sales-list-filter-panel.tsx: a thin adapter that
// feeds the shared AdvancedSearch panel this module's own filter configs,
// groupings and presets. All of the decisions it makes are declarative — the
// evaluation lives in inventory-stock-search.ts, where it can be tested.

import { useMemo } from 'react';
import { AdvancedSearch } from '../advanced-search';
import type {
  CustomGroup,
  FilterValue,
  SavedSearch,
} from '../advanced-search/advanced-search-types';
import {
  EXPIRY_PRESET_IDS,
  EXPIRY_PRESET_LABELS,
  STATUS_BADGE,
  STATUS_KEYS,
  STOCK_FILTER_CONFIGS,
  STOCK_GROUP_OPTIONS,
  type StatusKey,
} from './inventory-stock-search';

const EXPIRY_PRESETS = EXPIRY_PRESET_IDS.map((id) => ({
  id,
  label: EXPIRY_PRESET_LABELS[id],
}));

// The status checkboxes reuse the panel's "doc type" slot — the same shape the
// sales page uses for Quotations / Sales Orders.
const STATUS_TOGGLES = STATUS_KEYS.map((key) => ({
  id: key,
  label: STATUS_BADGE[key].label,
  field: 'status',
  value: key,
}));

interface Props {
  open: boolean;
  onClose: () => void;
  activeFilters: FilterValue[];
  onAddFilter: (f: FilterValue) => void;
  onRemoveFilter: (fieldId: string) => void;
  onClearFilters: () => void;
  groupBy: string;
  onSetGroupBy: (id: string) => void;
  /** The single source of truth shared with the browser's status tab row. */
  statusSel: Set<StatusKey>;
  onToggleStatus: (key: StatusKey) => void;
  expiryPreset: string | null;
  onSetExpiryPreset: (id: string | null) => void;
  expiryFrom: string;
  expiryTo: string;
  onExpiryFrom: (v: string) => void;
  onExpiryTo: (v: string) => void;
  favorites: SavedSearch[];
  onApplyFavorite: (s: SavedSearch) => void;
  onSaveFavorite: (name: string) => void;
  onDeleteFavorite: (id: string) => void;
  customGroups: CustomGroup[];
  onAddCustomGroup: (g: CustomGroup) => void;
  onRemoveCustomGroup: (id: string) => void;
  triggerRef: React.RefObject<HTMLDivElement | null>;
}

export default function InventoryStockFilterPanel({
  open,
  onClose,
  activeFilters,
  onAddFilter,
  onRemoveFilter,
  onClearFilters,
  groupBy,
  onSetGroupBy,
  statusSel,
  onToggleStatus,
  expiryPreset,
  onSetExpiryPreset,
  expiryFrom,
  expiryTo,
  onExpiryFrom,
  onExpiryTo,
  favorites,
  onApplyFavorite,
  onSaveFavorite,
  onDeleteFavorite,
  customGroups,
  onAddCustomGroup,
  onRemoveCustomGroup,
  triggerRef,
}: Props) {
  const activeStatuses = useMemo(() => Array.from(statusSel), [statusSel]);

  if (!open) return null;

  return (
    <AdvancedSearch
      open={open}
      onClose={onClose}
      activeFilters={activeFilters}
      onAddFilter={onAddFilter}
      onRemoveFilter={onRemoveFilter}
      onClearFilters={onClearFilters}
      groupBy={groupBy}
      onSetGroupBy={(id) => onSetGroupBy(id)}
      customGroups={customGroups}
      onAddCustomGroup={onAddCustomGroup}
      onRemoveCustomGroup={onRemoveCustomGroup}
      favorites={favorites}
      onSaveFavorite={onSaveFavorite}
      onApplyFavorite={onApplyFavorite}
      onDeleteFavorite={onDeleteFavorite}
      docTypeLabel="Status"
      docTypeFilters={STATUS_TOGGLES}
      onToggleDocType={(id) => onToggleStatus(id as StatusKey)}
      activeDocTypes={activeStatuses}
      // StockRow has no createdAt; the only date it carries is earliestExpiry.
      dateSectionLabel="Expiry"
      datePresets={EXPIRY_PRESETS}
      onSetDatePreset={onSetExpiryPreset}
      activeDatePreset={expiryPreset}
      dateFrom={expiryFrom}
      dateTo={expiryTo}
      onDateFrom={onExpiryFrom}
      onDateTo={onExpiryTo}
      filterConfigs={STOCK_FILTER_CONFIGS}
      groupOptions={STOCK_GROUP_OPTIONS}
      triggerRef={triggerRef}
    />
  );
}
