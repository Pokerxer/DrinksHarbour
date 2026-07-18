// @ts-nocheck
'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Text, Badge, Flex } from 'rizzui';
import cn from '@core/utils/class-names';
import {
  PiPackageBold,
  PiCheckCircleBold,
  PiWarningBold,
  PiXCircleBold,
  PiTrendUpBold,
  PiTrendDownBold,
  PiArrowsClockwiseBold,
  PiFunnelBold,
} from 'react-icons/pi';
import type { FilterConfig } from './AdvancedFilters';

export interface Stats {
  total: number;
  active: number;
  lowStock: number;
  outOfStock: number;
  published?: number;
  draft?: number;
}

// Enhanced Loading Skeleton
export function LoadingSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {[...Array(5)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.08, duration: 0.3 }}
          className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
        >
          <div className="relative overflow-hidden">
            <div className="h-16 w-16 rounded-2xl bg-gray-200" />
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/40 to-transparent" />
          </div>
          <div className="flex-1 space-y-3">
            <div className="h-5 w-3/4 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-gray-100" />
          </div>
          <div className="space-y-2">
            <div className="h-8 w-24 animate-pulse rounded-full bg-gray-200" />
            <div className="h-6 w-20 animate-pulse rounded-full bg-gray-100" />
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// Stats Header Component
export function StatsHeader({
  stats,
  activeFilter,
  onFilterChange,
}: {
  stats: Stats;
  activeFilter: string;
  onFilterChange: (filter: string) => void;
}) {
  const statCards = [
    {
      id: '',
      label: 'Total',
      value: stats.total,
      icon: PiPackageBold,
      color: 'blue',
      trend: '+12%',
      trendUp: true,
    },
    {
      id: 'active',
      label: 'Active',
      value: stats.active,
      icon: PiCheckCircleBold,
      color: 'green',
      trend: '+5%',
      trendUp: true,
    },
    {
      id: 'low_stock',
      label: 'Low Stock',
      value: stats.lowStock,
      icon: PiWarningBold,
      color: 'amber',
      trend: '-3%',
      trendUp: false,
    },
    {
      id: 'out_of_stock',
      label: 'Out of Stock',
      value: stats.outOfStock,
      icon: PiXCircleBold,
      color: 'red',
      trend: '+2%',
      trendUp: false,
    },
  ];

  const colorMap: Record<
    string,
    { bg: string; text: string; iconBg: string; ring: string }
  > = {
    blue: {
      bg: 'from-blue-500/10 to-blue-500/5',
      text: 'text-blue-600',
      iconBg: 'bg-blue-500',
      ring: 'ring-blue-500/30',
    },
    green: {
      bg: 'from-green-500/10 to-green-500/5',
      text: 'text-green-600',
      iconBg: 'bg-green-500',
      ring: 'ring-green-500/30',
    },
    amber: {
      bg: 'from-amber-500/10 to-amber-500/5',
      text: 'text-amber-600',
      iconBg: 'bg-amber-500',
      ring: 'ring-amber-500/30',
    },
    red: {
      bg: 'from-red-500/10 to-red-500/5',
      text: 'text-red-600',
      iconBg: 'bg-red-500',
      ring: 'ring-red-500/30',
    },
  };

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {statCards.map((stat, index) => {
        const colors = colorMap[stat.color];
        const isActive = activeFilter === stat.id;
        const Icon = stat.icon;

        return (
          <motion.button
            key={stat.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onFilterChange(stat.id)}
            className={cn(
              'group relative overflow-hidden rounded-2xl bg-gradient-to-br p-5 text-left transition-all',
              colors.bg,
              isActive && 'ring-4 ' + colors.ring
            )}
          >
            <motion.div
              className="absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-20 transition-transform duration-500 group-hover:scale-150"
              style={{ backgroundColor: 'currentColor' }}
            />

            <Flex justify="between" align="start">
              <div>
                <Text
                  className={cn(
                    'text-xs font-bold uppercase tracking-wider opacity-70',
                    colors.text
                  )}
                >
                  {stat.label}
                </Text>
                <motion.div
                  key={stat.value}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="mt-1"
                >
                  <Text className="text-3xl font-black">{stat.value}</Text>
                </motion.div>
              </div>

              <motion.div
                whileHover={{ scale: 1.1, rotate: 5 }}
                className={cn(
                  'flex h-12 w-12 items-center justify-center rounded-xl text-white shadow-lg',
                  colors.iconBg
                )}
              >
                <Icon className="h-6 w-6" />
              </motion.div>
            </Flex>

            <Flex
              align="center"
              gap="1"
              className="mt-3 border-t border-black/5 pt-3"
            >
              {stat.trendUp ? (
                <PiTrendUpBold className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <PiTrendDownBold className="h-3.5 w-3.5 text-red-500" />
              )}
              <Text
                className={cn(
                  'text-xs font-semibold',
                  stat.trendUp ? 'text-green-600' : 'text-red-500'
                )}
              >
                {stat.trend}
              </Text>
              <Text className="text-xs text-gray-400">vs last month</Text>
            </Flex>
          </motion.button>
        );
      })}
    </div>
  );
}

// Bulk Actions Bar
export function BulkActionsBar({
  selectedCount,
  totalCount,
  onSelectAll,
  onDelete,
  onExport,
  onDuplicate,
  onArchive,
  onUnarchive,
  onClear,
  onSetStatus,
  onSetChannel,
}: {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onDelete: () => void;
  onExport: () => void;
  onDuplicate: () => void;
  onArchive: () => void;
  onUnarchive: () => void;
  onClear: () => void;
  onSetStatus: (status: string) => void;
  onSetChannel: (field: string, value: boolean) => void;
}) {
  const [actionsOpen, setActionsOpen] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 50, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className="fixed bottom-6 left-1/2 z-50 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-2xl border border-gray-700/50 bg-gray-900/95 px-4 py-3 text-white shadow-2xl backdrop-blur-xl sm:gap-4 sm:px-6 sm:py-4"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#b20202]"
      >
        <Text className="text-lg font-bold">{selectedCount}</Text>
      </motion.div>
      <Text className="font-semibold">selected</Text>

      {selectedCount < totalCount && (
        <button
          type="button"
          onClick={onSelectAll}
          className="flex items-center gap-1.5 rounded-lg bg-[#b20202]/90 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#b20202]"
        >
          <span aria-hidden>→</span>
          Select all {totalCount}
        </button>
      )}

      <div className="h-8 w-px bg-gray-700" />

      <select
        defaultValue=""
        onChange={(e) => {
          if (e.target.value) {
            onSetStatus(e.target.value);
            e.currentTarget.value = '';
          }
        }}
        className="h-9 cursor-pointer rounded-xl border border-gray-700 bg-gray-800 px-2.5 text-sm font-medium text-white outline-none transition-colors hover:bg-gray-700"
      >
        <option value="" disabled>
          Set status…
        </option>
        <option value="active">Active</option>
        <option value="draft">Draft</option>
        <option value="pending">Pending</option>
        <option value="hidden">Hidden</option>
        <option value="out_of_stock">Out of Stock</option>
        <option value="discontinued">Discontinued</option>
        <option value="archived">Archived</option>
      </select>

      <select
        defaultValue=""
        onChange={(e) => {
          const v = e.target.value;
          if (v) {
            const [field, val] = v.split(':');
            onSetChannel(field, val === 'on');
            e.currentTarget.value = '';
          }
        }}
        className="h-9 cursor-pointer rounded-xl border border-gray-700 bg-gray-800 px-2.5 text-sm font-medium text-white outline-none transition-colors hover:bg-gray-700"
      >
        <option value="" disabled>
          Channels…
        </option>
        <option value="visibleInPOS:on">POS — show</option>
        <option value="visibleInPOS:off">POS — hide</option>
        <option value="visibleInOnlineStore:on">Online store — show</option>
        <option value="visibleInOnlineStore:off">Online store — hide</option>
        <option value="isPublished:on">Platform — publish</option>
        <option value="isPublished:off">Platform — unpublish</option>
      </select>

      <div className="relative">
        <button
          type="button"
          onClick={() => setActionsOpen((v) => !v)}
          className={cn(
            'flex h-9 items-center gap-1.5 rounded-xl border border-gray-600 px-3.5 text-sm font-semibold transition-colors',
            actionsOpen
              ? 'bg-white/10 text-white'
              : 'text-gray-200 hover:bg-white/10'
          )}
        >
          ⚙ Actions
        </button>
        {actionsOpen && (
          <div className="absolute bottom-full right-0 z-50 mb-2 w-44 overflow-hidden rounded-xl border border-gray-700 bg-gray-900 py-1 shadow-2xl">
            {[
              { label: 'Export', action: onExport },
              { label: 'Duplicate', action: onDuplicate },
              { label: 'Archive', action: onArchive },
              { label: 'Unarchive', action: onUnarchive },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  setActionsOpen(false);
                  item.action();
                }}
                className="block w-full px-4 py-2 text-left text-sm text-gray-200 transition-colors hover:bg-white/10"
              >
                {item.label}
              </button>
            ))}
            <div className="my-1 border-t border-gray-700" />
            <button
              type="button"
              onClick={() => {
                setActionsOpen(false);
                onDelete();
              }}
              className="block w-full px-4 py-2 text-left text-sm text-red-400 transition-colors hover:bg-red-500/20"
            >
              Delete
            </button>
          </div>
        )}
      </div>

      <div className="h-8 w-px bg-gray-700" />

      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={onClear}
        className="rounded-xl p-2 transition-colors hover:bg-white/10"
      >
        <PiXCircleBold className="h-5 w-5 text-gray-400" />
      </motion.button>
    </motion.div>
  );
}

// Empty State
export function EmptyState({ onClear }: { onClear: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl border border-gray-200 bg-white p-16 text-center shadow-sm"
    >
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', delay: 0.2 }}
        className="mx-auto mb-6 flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br from-gray-100 to-gray-200"
      >
        <PiPackageBold className="h-16 w-16 text-gray-400" />
      </motion.div>

      <Text className="mb-3 text-2xl font-bold text-gray-700">
        No sub-products found
      </Text>
      <Text className="mx-auto mb-8 max-w-md text-lg text-gray-500">
        We couldn't find any products matching your criteria.
      </Text>

      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onClear}
        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#b20202] to-[#7f1d1d] px-8 py-3 font-semibold text-white shadow-lg shadow-[#b20202]/30 transition-all hover:shadow-xl"
      >
        <PiArrowsClockwiseBold className="h-5 w-5" />
        Clear Filters
      </motion.button>
    </motion.div>
  );
}

// Error State
export function ErrorState({
  onRetry,
  message,
}: {
  onRetry: () => void;
  message: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-3xl border border-red-200 bg-white p-12 text-center shadow-sm"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-red-100"
      >
        <PiWarningBold className="h-12 w-12 text-red-500" />
      </motion.div>

      <Text className="mb-2 text-xl font-bold text-red-600">
        Something went wrong
      </Text>
      <Text className="mb-8 text-gray-500">{message}</Text>

      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onRetry}
        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-500 to-red-600 px-8 py-3 font-semibold text-white shadow-lg shadow-red-500/30 transition-all"
      >
        <PiArrowsClockwiseBold className="h-5 w-5" />
        Try Again
      </motion.button>
    </motion.div>
  );
}

// Active Filters Display
export function ActiveFiltersBar({
  statusFilter,
  visibilityFilter,
  searchQuery,
  advancedFilters,
  filterCount,
  onClearStatus,
  onClearVisibility,
  onClearSearch,
  onClearAdvanced,
  onClearAll,
}: {
  statusFilter: string;
  visibilityFilter: string;
  searchQuery: string;
  advancedFilters: FilterConfig;
  filterCount: number;
  onClearStatus: () => void;
  onClearVisibility: () => void;
  onClearSearch: () => void;
  onClearAdvanced: (key: keyof FilterConfig) => void;
  onClearAll: () => void;
}) {
  const hasFilters =
    statusFilter ||
    visibilityFilter !== 'all' ||
    searchQuery ||
    filterCount > 0;

  if (!hasFilters) return null;

  const FilterBadge = ({
    label,
    color,
    onClear,
  }: {
    label: string;
    color: string;
    onClear: () => void;
  }) => (
    <Badge size="sm" variant="flat" color={color as any} className="gap-1">
      {label}
      <button onClick={onClear} className="ml-1 font-bold hover:text-red-500">
        ×
      </button>
    </Badge>
  );

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="flex flex-wrap items-center gap-2 rounded-xl border border-red-100 bg-red-50/60 px-4 py-3"
    >
      <PiFunnelBold className="h-4 w-4 flex-shrink-0 text-[#b20202]" />
      <Text className="flex-shrink-0 text-sm font-medium text-[#b20202]">
        Active filters:
      </Text>

      {searchQuery && (
        <FilterBadge
          label={`"${searchQuery}"`}
          color="primary"
          onClear={onClearSearch}
        />
      )}
      {statusFilter && (
        <FilterBadge
          label={statusFilter.replace('_', ' ')}
          color="success"
          onClear={onClearStatus}
        />
      )}
      {visibilityFilter !== 'all' && (
        <FilterBadge
          label={visibilityFilter}
          color="warning"
          onClear={onClearVisibility}
        />
      )}

      {advancedFilters.status.length > 0 && (
        <FilterBadge
          label={`Status: ${advancedFilters.status.length}`}
          color="secondary"
          onClear={() => onClearAdvanced('status')}
        />
      )}
      {advancedFilters.stockStatus.length > 0 && (
        <FilterBadge
          label={`Stock: ${advancedFilters.stockStatus.length}`}
          color="danger"
          onClear={() => onClearAdvanced('stockStatus')}
        />
      )}
      {advancedFilters.visibility.length > 0 && (
        <FilterBadge
          label={`Visibility: ${advancedFilters.visibility.length}`}
          color="warning"
          onClear={() => onClearAdvanced('visibility')}
        />
      )}

      {(advancedFilters.priceRange[0] > 0 ||
        advancedFilters.priceRange[1] > 0) && (
        <FilterBadge
          label={`₦${advancedFilters.priceRange[0].toLocaleString()}-${advancedFilters.priceRange[1].toLocaleString()}`}
          color="info"
          onClear={() => onClearAdvanced('priceRange')}
        />
      )}
      {(advancedFilters.marginRange[0] > 0 ||
        advancedFilters.marginRange[1] > 0) && (
        <FilterBadge
          label={`Margin: ${advancedFilters.marginRange[0]}-${advancedFilters.marginRange[1]}%`}
          color="success"
          onClear={() => onClearAdvanced('marginRange')}
        />
      )}
      {advancedFilters.onSale !== null && (
        <FilterBadge
          label={advancedFilters.onSale ? 'On Sale' : 'Not On Sale'}
          color="danger"
          onClear={() => onClearAdvanced('onSale')}
        />
      )}

      {(advancedFilters.stockRange[0] > 0 ||
        advancedFilters.stockRange[1] > 0) && (
        <FilterBadge
          label={`Stock: ${advancedFilters.stockRange[0]}-${advancedFilters.stockRange[1]}`}
          color="secondary"
          onClear={() => onClearAdvanced('stockRange')}
        />
      )}
      {advancedFilters.hasVariants !== null && (
        <FilterBadge
          label={advancedFilters.hasVariants ? 'Has Variants' : 'No Variants'}
          color="info"
          onClear={() => onClearAdvanced('hasVariants')}
        />
      )}
      {advancedFilters.needsReorder !== null && (
        <FilterBadge
          label={advancedFilters.needsReorder ? 'Needs Reorder' : 'Stock OK'}
          color="warning"
          onClear={() => onClearAdvanced('needsReorder')}
        />
      )}

      {advancedFilters.beverageTypes.length > 0 && (
        <FilterBadge
          label={`Types: ${advancedFilters.beverageTypes.length}`}
          color="secondary"
          onClear={() => onClearAdvanced('beverageTypes')}
        />
      )}
      {advancedFilters.isAlcoholic !== null && (
        <FilterBadge
          label={advancedFilters.isAlcoholic ? 'Alcoholic' : 'Non-Alcoholic'}
          color="danger"
          onClear={() => onClearAdvanced('isAlcoholic')}
        />
      )}
      {(advancedFilters.abvRange[0] > 0 || advancedFilters.abvRange[1] > 0) && (
        <FilterBadge
          label={`ABV: ${advancedFilters.abvRange[0]}-${advancedFilters.abvRange[1]}%`}
          color="warning"
          onClear={() => onClearAdvanced('abvRange')}
        />
      )}
      {(advancedFilters.volumeRange[0] > 0 ||
        advancedFilters.volumeRange[1] > 0) && (
        <FilterBadge
          label={`Vol: ${advancedFilters.volumeRange[0]}-${advancedFilters.volumeRange[1]}ml`}
          color="info"
          onClear={() => onClearAdvanced('volumeRange')}
        />
      )}
      {advancedFilters.originCountries.length > 0 && (
        <FilterBadge
          label={`Origins: ${advancedFilters.originCountries.length}`}
          color="success"
          onClear={() => onClearAdvanced('originCountries')}
        />
      )}

      {advancedFilters.isFeatured !== null && (
        <FilterBadge
          label={advancedFilters.isFeatured ? 'Featured' : 'Not Featured'}
          color="warning"
          onClear={() => onClearAdvanced('isFeatured')}
        />
      )}
      {advancedFilters.isBestSeller !== null && (
        <FilterBadge
          label={
            advancedFilters.isBestSeller ? 'Best Seller' : 'Not Best Seller'
          }
          color="success"
          onClear={() => onClearAdvanced('isBestSeller')}
        />
      )}
      {advancedFilters.isNewArrival !== null && (
        <FilterBadge
          label={advancedFilters.isNewArrival ? 'New Arrival' : 'Not New'}
          color="primary"
          onClear={() => onClearAdvanced('isNewArrival')}
        />
      )}

      {advancedFilters.visibleInPOS !== null && (
        <FilterBadge
          label={advancedFilters.visibleInPOS ? 'In POS' : 'Not in POS'}
          color="secondary"
          onClear={() => onClearAdvanced('visibleInPOS')}
        />
      )}
      {advancedFilters.visibleInOnlineStore !== null && (
        <FilterBadge
          label={advancedFilters.visibleInOnlineStore ? 'Online' : 'Not Online'}
          color="info"
          onClear={() => onClearAdvanced('visibleInOnlineStore')}
        />
      )}

      {(advancedFilters.salesRange[0] > 0 ||
        advancedFilters.salesRange[1] > 0) && (
        <FilterBadge
          label={`Sales: ${advancedFilters.salesRange[0]}-${advancedFilters.salesRange[1]}`}
          color="success"
          onClear={() => onClearAdvanced('salesRange')}
        />
      )}

      {advancedFilters.seasons.length > 0 && (
        <FilterBadge
          label={`Seasons: ${advancedFilters.seasons.length}`}
          color="warning"
          onClear={() => onClearAdvanced('seasons')}
        />
      )}
      {advancedFilters.occasions.length > 0 && (
        <FilterBadge
          label={`Occasions: ${advancedFilters.occasions.length}`}
          color="danger"
          onClear={() => onClearAdvanced('occasions')}
        />
      )}

      {(advancedFilters.dateRange.from || advancedFilters.dateRange.to) && (
        <FilterBadge
          label="Date Added"
          color="secondary"
          onClear={() => onClearAdvanced('dateRange')}
        />
      )}
      {(advancedFilters.lastSoldRange.from ||
        advancedFilters.lastSoldRange.to) && (
        <FilterBadge
          label="Last Sold"
          color="info"
          onClear={() => onClearAdvanced('lastSoldRange')}
        />
      )}
      {(advancedFilters.lastRestockRange.from ||
        advancedFilters.lastRestockRange.to) && (
        <FilterBadge
          label="Last Restock"
          color="warning"
          onClear={() => onClearAdvanced('lastRestockRange')}
        />
      )}

      <button
        onClick={onClearAll}
        className="ml-auto flex-shrink-0 text-xs font-medium text-red-500 hover:text-red-700"
      >
        Clear all
      </button>
    </motion.div>
  );
}