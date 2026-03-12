'use client';

import { Text } from 'rizzui';
import { motion } from 'framer-motion';
import { PiMagnifyingGlass } from 'react-icons/pi';
import type { SizeVariant, HistoryFilter, StatusFilter, DateRangeFilter } from '../shared/types';

interface HistoryFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  historyFilter: HistoryFilter;
  onHistoryFilterChange: (filter: HistoryFilter) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (filter: StatusFilter) => void;
  dateRange: DateRangeFilter;
  onDateRangeChange: (range: DateRangeFilter) => void;
  sizeFilter: string;
  onSizeFilterChange: (filter: string) => void;
  itemsPerPage: number;
  onItemsPerPageChange: (count: number) => void;
  hasSizeVariants: boolean;
  sizes: SizeVariant[];
}

const TYPE_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'add', label: 'Receipt', color: 'green' },
  { value: 'remove', label: 'Delivery', color: 'red' },
  { value: 'transfer', label: 'Transfer', color: 'purple' },
  { value: 'set', label: 'Adjust', color: 'amber' },
];

const STATUS_FILTERS = [
  { value: 'all', label: 'All', color: 'gray' },
  { value: 'done', label: 'Done', color: 'green' },
  { value: 'ready', label: 'Ready', color: 'blue' },
  { value: 'waiting', label: 'Waiting', color: 'amber' },
  { value: 'pending', label: 'Pending', color: 'purple' },
  { value: 'draft', label: 'Draft', color: 'gray' },
  { value: 'returned', label: 'Returned', color: 'amber' },
  { value: 'cancel', label: 'Cancelled', color: 'red' },
];

export function HistoryFilters({
  searchQuery,
  onSearchChange,
  historyFilter,
  onHistoryFilterChange,
  statusFilter,
  onStatusFilterChange,
  dateRange,
  onDateRangeChange,
  sizeFilter,
  onSizeFilterChange,
  itemsPerPage,
  onItemsPerPageChange,
  hasSizeVariants,
  sizes,
}: HistoryFiltersProps) {
  const getTypeFilterClass = (value: string, isActive: boolean) => {
    if (!isActive) return 'bg-gray-100 text-gray-600 hover:bg-gray-200';
    switch (value) {
      case 'add':
        return 'bg-green-100 text-green-700';
      case 'remove':
        return 'bg-red-100 text-red-700';
      case 'transfer':
        return 'bg-purple-100 text-purple-700';
      case 'set':
        return 'bg-amber-100 text-amber-700';
      default:
        return 'bg-gray-200 text-gray-700';
    }
  };

  const getStatusFilterClass = (color: string, isActive: boolean) => {
    if (!isActive) return 'bg-gray-100 text-gray-600 hover:bg-gray-200';
    switch (color) {
      case 'green':
        return 'bg-green-100 text-green-700';
      case 'blue':
        return 'bg-blue-100 text-blue-700';
      case 'amber':
        return 'bg-amber-100 text-amber-700';
      case 'purple':
        return 'bg-purple-100 text-purple-700';
      case 'red':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-200 text-gray-700';
    }
  };

  return (
    <motion.div
      className="rounded-xl border border-gray-200 p-4 bg-white shadow-sm"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search by reference, product, or reason..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full rounded-lg border border-gray-300 pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <PiMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        </div>

        <div className="h-6 w-px bg-gray-300" />

        {/* Type Filter */}
        <div className="flex items-center gap-2">
          <Text className="text-sm font-medium text-gray-600">Type:</Text>
          <div className="flex gap-1">
            {TYPE_FILTERS.map((type) => (
              <button
                key={type.value}
                onClick={() => onHistoryFilterChange(type.value as HistoryFilter)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${getTypeFilterClass(
                  type.value,
                  historyFilter === type.value
                )}`}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>

        <div className="h-6 w-px bg-gray-300" />

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <Text className="text-sm font-medium text-gray-600">Status:</Text>
          <div className="flex gap-1">
            {STATUS_FILTERS.map((status) => (
              <button
                key={status.value}
                onClick={() => onStatusFilterChange(status.value as StatusFilter)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${getStatusFilterClass(
                  status.color,
                  statusFilter === status.value
                )}`}
              >
                {status.label}
              </button>
            ))}
          </div>
        </div>

        <div className="h-6 w-px bg-gray-300" />

        {/* Date Filter */}
        <select
          value={dateRange}
          onChange={(e) => onDateRangeChange(e.target.value as DateRangeFilter)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
        >
          <option value="all">Any Date</option>
          <option value="today">Today</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
        </select>

        {/* Size Filter */}
        {hasSizeVariants && (
          <>
            <div className="h-6 w-px bg-gray-300" />
            <select
              value={sizeFilter}
              onChange={(e) => onSizeFilterChange(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
            >
              <option value="all">All Sizes</option>
              {sizes.map((s) => (
                <option key={s?.size} value={s?.size}>
                  {s?.label || s?.size}
                </option>
              ))}
            </select>
          </>
        )}

        {/* Items per page */}
        <select
          value={itemsPerPage}
          onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
        >
          <option value={5}>5 / page</option>
          <option value={10}>10 / page</option>
          <option value={20}>20 / page</option>
          <option value={50}>50 / page</option>
        </select>
      </div>
    </motion.div>
  );
}
