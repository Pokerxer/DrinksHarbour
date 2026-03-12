// Utility functions for Inventory management

import type { StockAdjustment, SizeVariant } from './types';

/**
 * Get the default reason text based on adjustment type
 */
export const getDefaultReason = (type: string): string => {
  switch (type) {
    case 'add': return 'Stock added';
    case 'remove': return 'Stock removed';
    case 'set': return 'Stock set';
    default: return 'Adjustment';
  }
};

/**
 * Calculate stock map per size variant
 */
export const calculateSizeStockMap = (sizes: SizeVariant[]): Record<string, number> => {
  const map: Record<string, number> = {};
  if (sizes && Array.isArray(sizes)) {
    sizes.forEach((s) => {
      if (s?.size) {
        map[s.size] = s?.stockQuantity || 0;
      }
    });
  }
  return map;
};

/**
 * Filter history based on filters
 */
export const filterHistory = (
  history: StockAdjustment[],
  filters: {
    historyFilter: string;
    statusFilter: string;
    sizeFilter: string;
    searchQuery: string;
    dateRange: string;
    hasSizeVariants: boolean;
  }
): StockAdjustment[] => {
  let filtered = history;

  // Type filter
  if (filters.historyFilter !== 'all') {
    filtered = filtered.filter(h => h.type === filters.historyFilter);
  }

  // Status filter
  if (filters.statusFilter !== 'all') {
    filtered = filtered.filter(h => h.status === filters.statusFilter);
  }

  // Size filter
  if (filters.sizeFilter !== 'all' && filters.hasSizeVariants) {
    filtered = filtered.filter(h => h.sizeVariant === filters.sizeFilter);
  }

  // Search filter
  if (filters.searchQuery) {
    const query = filters.searchQuery.toLowerCase();
    filtered = filtered.filter(h =>
      h.reference?.toLowerCase().includes(query) ||
      h.productName?.toLowerCase().includes(query) ||
      h.reason?.toLowerCase().includes(query) ||
      h.sourceDocument?.toLowerCase().includes(query)
    );
  }

  // Date range filter
  const now = new Date();
  if (filters.dateRange === 'today') {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    filtered = filtered.filter(h => new Date(h.timestamp) >= today);
  } else if (filters.dateRange === 'week') {
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    filtered = filtered.filter(h => new Date(h.timestamp) >= weekAgo);
  } else if (filters.dateRange === 'month') {
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    filtered = filtered.filter(h => new Date(h.timestamp) >= monthAgo);
  }

  return filtered;
};

/**
 * Paginate array
 */
export const paginateArray = <T>(
  items: T[],
  currentPage: number,
  itemsPerPage: number
): T[] => {
  const startIndex = (currentPage - 1) * itemsPerPage;
  return items.slice(startIndex, startIndex + itemsPerPage);
};

/**
 * Calculate days until stockout
 */
export const calculateDaysUntilStockout = (
  availableStock: number,
  dailySalesRate: number
): number => {
  if (dailySalesRate <= 0 || availableStock <= 0) return Infinity;
  return Math.floor(availableStock / dailySalesRate);
};

/**
 * Calculate recommended order quantity
 */
export const calculateRecommendedOrderQty = (
  dailySalesRate: number,
  availableStock: number
): number => {
  const safetyStock = dailySalesRate * 7;
  const targetStock = safetyStock + (dailySalesRate * 30);
  return Math.max(0, Math.ceil(targetStock - availableStock));
};

/**
 * Calculate reorder date
 */
export const calculateReorderDate = (
  reorderPoint: number,
  dailySalesRate: number
): Date => {
  const daysUntilReorder = Math.max(0, reorderPoint / dailySalesRate);
  const date = new Date();
  date.setDate(date.getDate() + daysUntilReorder);
  return date;
};

/**
 * Get current stock status based on available stock
 */
export const getCurrentStockStatus = (
  stockStatus: string,
  availableStock: number,
  lowStockThreshold: number
): string => {
  if (stockStatus === 'pre_order' || stockStatus === 'discontinued') {
    return stockStatus;
  }
  if (availableStock === 0) return 'out_of_stock';
  if (availableStock <= lowStockThreshold) return 'low_stock';
  return 'in_stock';
};

/**
 * Generate stock report JSON
 */
export const exportStockReportJSON = (
  totalStock: number,
  availableStock: number,
  reservedStock: number,
  history: StockAdjustment[]
): void => {
  const report = {
    product: 'SubProduct',
    date: new Date().toISOString(),
    totalStock,
    availableStock,
    reservedStock,
    history,
  };
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `stock-report-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

/**
 * Generate stock report CSV
 */
export const exportStockReportCSV = (history: StockAdjustment[]): void => {
  const headers = [
    'Date',
    'Type',
    'Reference',
    'Quantity',
    'Previous Stock',
    'New Stock',
    'From Location',
    'To Location',
    'Reason',
    'Size Variant',
    'Notes',
  ];
  const rows = history.map(h => [
    new Date(h.timestamp).toISOString(),
    h.type,
    h.reference || h.transferReference || '',
    h.quantity.toString(),
    h.previousStock.toString(),
    h.newStock.toString(),
    h.fromLocationName || h.fromLocation || '',
    h.toLocationName || h.toLocation || '',
    h.reason,
    h.sizeLabel || h.sizeVariant || '',
    h.transferNotes || h.notes || '',
  ]);
  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `stock-report-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};
