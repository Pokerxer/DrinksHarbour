'use client';

import { Text, Badge, Button } from 'rizzui';
import { motion } from 'framer-motion';
import { PiPackage, PiPlus, PiDownload } from 'react-icons/pi';
import { fieldStaggerVariants } from '../../animations';
import { InventorySummaryCard } from './InventorySummaryCard';
import { ServerMovementsList } from './ServerMovementsList';
import { HistoryFilters } from './HistoryFilters';
import { HistoryListItem } from './HistoryListItem';
import { HistoryPagination } from './HistoryPagination';
import type { StockAdjustment, SizeVariant, HistoryFilter, StatusFilter, DateRangeFilter } from '../shared/types';
import type { InventoryMovement, InventorySummary } from '@/services/inventory.service';

interface HistoryTabProps {
  // Server data
  subProductId: string | undefined;
  inventorySummary: InventorySummary | null;
  serverMovements: InventoryMovement[];
  isLoadingMovements: boolean;
  onRecordStock: () => void;
  
  // Local history
  filteredHistory: StockAdjustment[];
  paginatedHistory: StockAdjustment[];
  
  // Filters
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
  
  // Pagination
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (count: number) => void;
  
  // Selection
  selectedItems: string[];
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onItemClick: (item: StockAdjustment) => void;
  
  // Size variants
  hasSizeVariants: boolean;
  sizes: SizeVariant[];
  
  // Actions
  onExportCSV: () => void;
}

export function HistoryTab({
  subProductId,
  inventorySummary,
  serverMovements,
  isLoadingMovements,
  onRecordStock,
  filteredHistory,
  paginatedHistory,
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
  currentPage,
  totalPages,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
  selectedItems,
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  onItemClick,
  hasSizeVariants,
  sizes,
  onExportCSV,
}: HistoryTabProps) {
  return (
    <motion.div
      variants={fieldStaggerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Server-side Inventory Summary */}
      <InventorySummaryCard
        subProductId={subProductId}
        inventorySummary={inventorySummary}
        isLoading={isLoadingMovements}
        onRecordStock={onRecordStock}
      />

      {/* Recent Server Movements */}
      <ServerMovementsList movements={serverMovements} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Text className="font-semibold text-xl">Stock Moves</Text>
          <Badge color="primary" variant="flat">
            {filteredHistory.length} moves
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onExportCSV}>
            <PiDownload className="mr-1 h-4 w-4" /> Export
          </Button>
          <Button size="sm">
            <PiPlus className="mr-1 h-4 w-4" /> New
          </Button>
        </div>
      </div>

      {/* Filters */}
      <HistoryFilters
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        historyFilter={historyFilter}
        onHistoryFilterChange={onHistoryFilterChange}
        statusFilter={statusFilter}
        onStatusFilterChange={onStatusFilterChange}
        dateRange={dateRange}
        onDateRangeChange={onDateRangeChange}
        sizeFilter={sizeFilter}
        onSizeFilterChange={onSizeFilterChange}
        itemsPerPage={itemsPerPage}
        onItemsPerPageChange={onItemsPerPageChange}
        hasSizeVariants={hasSizeVariants}
        sizes={sizes}
      />

      {/* Bulk Actions */}
      {selectedItems.length > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="flex items-center gap-4 p-3 bg-blue-50 rounded-lg border border-blue-200"
        >
          <Text className="text-sm font-medium text-blue-700">
            {selectedItems.length} item(s) selected
          </Text>
          <div className="flex-1" />
          <Button variant="outline" size="sm" className="border-blue-300 text-blue-700">
            Mark as Done
          </Button>
          <Button variant="outline" size="sm" className="border-blue-300 text-blue-700">
            Cancel
          </Button>
          <Button variant="text" size="sm" onClick={onClearSelection}>
            Clear
          </Button>
        </motion.div>
      )}

      {/* History List */}
      {filteredHistory.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-xl border-2 border-dashed border-gray-300 p-12 text-center"
        >
          <PiPackage className="mx-auto h-16 w-16 text-gray-300" />
          <Text className="mt-4 text-lg font-medium text-gray-500">No stock moves found</Text>
          <Text className="text-sm text-gray-400 mt-1">
            Try adjusting your filters or create a new stock move
          </Text>
          <Button className="mt-4">
            <PiPlus className="mr-2 h-4 w-4" /> Create Stock Move
          </Button>
        </motion.div>
      ) : (
        <motion.div
          className="space-y-3"
          variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
        >
          {paginatedHistory.map((item) => (
            <HistoryListItem
              key={item.id}
              item={item}
              isSelected={selectedItems.includes(item.id)}
              onSelect={() => onToggleSelect(item.id)}
              onClick={() => onItemClick(item)}
            />
          ))}
        </motion.div>
      )}

      {/* Pagination */}
      <HistoryPagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={filteredHistory.length}
        itemsPerPage={itemsPerPage}
        onPageChange={onPageChange}
      />
    </motion.div>
  );
}

// Re-export components
export { InventorySummaryCard } from './InventorySummaryCard';
export { ServerMovementsList } from './ServerMovementsList';
export { HistoryFilters } from './HistoryFilters';
export { HistoryListItem } from './HistoryListItem';
export { HistoryPagination } from './HistoryPagination';
