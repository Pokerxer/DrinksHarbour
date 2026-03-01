// @ts-nocheck
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import Table from '@core/components/table';
import { useTanStackTable } from '@core/components/table/custom/use-TanStack-Table';
import TablePagination from '@core/components/table/pagination';
import { subProductListColumns } from './columns';
import TableFooter from '@core/components/table/footer';
import { TableClassNameProps } from '@core/components/table/table-types';
import cn from '@core/utils/class-names';
import { exportToCSV } from '@core/utils/export-to-csv';
import { subproductService } from '@/services/subproduct.service';
import { Text, Badge, Button, Flex, Checkbox } from 'rizzui';
import {
  PiArrowsClockwiseBold,
  PiPackageBold,
  PiWarningBold,
  PiTrashBold,
  PiDownloadBold,
  PiCheckCircleBold,
  PiXCircleBold,
  PiTrendUpBold,
  PiTrendDownBold,
  PiSparkle,
  PiFunnelBold,
} from 'react-icons/pi';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

// Import new components
import {
  AdvancedFilters,
  EnhancedSearch,
  ColumnToggle,
  StatusPillsInline,
  VisibilityToggle,
  ProductGridCard,
  ProductGridCardCompact,
  ViewToggle,
} from './components';
import type { FilterConfig, ViewMode } from './components';

export interface SizeVariant {
  _id: string;
  size: string;
  displayName?: string;
  sellingPrice?: number;
  stock?: number;
  availability?: string;
  lowStockThreshold?: number;
}

export interface SubProductListItem {
  _id: string;
  id: string;
  sku: string;
  product?: {
    _id: string;
    name: string;
    slug: string;
    type?: string;
    images?: Array<{ url: string }>;
    isAlcoholic?: boolean;
    abv?: number;
    volumeMl?: number;
    originCountry?: string;
    brand?: { name: string };
    category?: { name: string };
  };
  sizes?: SizeVariant[];
  baseSellingPrice: number;
  costPrice: number;
  currency: string;
  totalStock: number;
  availableStock: number;
  stockStatus: string;
  status: string;
  isPublished: boolean;
  isFeaturedByTenant?: boolean;
  isBestSeller?: boolean;
  isNewArrival?: boolean;
  isOnSale?: boolean;
  descriptionOverride?: string;
  imagesOverride?: Array<{ url: string }>;
  totalSold?: number;
  totalRevenue?: number;
  viewCount?: number;
  conversionRate?: number;
  marginPercentage?: number;
  reorderPoint?: number;
  visibleInPOS?: boolean;
  visibleInOnlineStore?: boolean;
  seasonality?: { spring?: boolean; summer?: boolean; fall?: boolean; winter?: boolean };
  specialOccasions?: string[];
  lastSoldDate?: string;
  lastRestockDate?: string;
  createdAt: string;
  updatedAt: string;
}

// Initial filter state - expanded with all new filters
const initialFilters: FilterConfig = {
  // Status & Visibility
  status: [],
  stockStatus: [],
  visibility: [],
  
  // Pricing
  priceRange: [0, 0],
  marginRange: [0, 0],
  onSale: null,
  hasDiscount: null,
  
  // Inventory
  stockRange: [0, 0],
  hasVariants: null,
  needsReorder: null,
  
  // Beverage Specific
  beverageTypes: [],
  isAlcoholic: null,
  abvRange: [0, 0],
  volumeRange: [0, 0],
  originCountries: [],
  
  // Product Flags
  isFeatured: null,
  isBestSeller: null,
  isNewArrival: null,
  
  // Sales Channels
  visibleInPOS: null,
  visibleInOnlineStore: null,
  
  // Performance
  salesRange: [0, 0],
  viewsRange: [0, 0],
  conversionRange: [0, 0],
  
  // Seasonality
  seasons: [],
  occasions: [],
  
  // Date filters
  dateRange: { from: '', to: '' },
  lastSoldRange: { from: '', to: '' },
  lastRestockRange: { from: '', to: '' },
};

// Enhanced Loading Skeleton
function LoadingSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {[...Array(5)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.08, duration: 0.3 }}
          className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm"
        >
          <div className="relative overflow-hidden">
            <div className="w-16 h-16 bg-gray-200 rounded-2xl" />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]" />
          </div>
          <div className="flex-1 space-y-3">
            <div className="h-5 bg-gray-200 rounded w-3/4 animate-pulse" />
            <div className="h-4 bg-gray-100 rounded w-1/2 animate-pulse" />
          </div>
          <div className="space-y-2">
            <div className="h-8 w-24 bg-gray-200 rounded-full animate-pulse" />
            <div className="h-6 w-20 bg-gray-100 rounded-full animate-pulse" />
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// Stats Header Component
function StatsHeader({
  stats,
  activeFilter,
  onFilterChange,
}: {
  stats: { total: number; active: number; lowStock: number; outOfStock: number };
  activeFilter: string;
  onFilterChange: (filter: string) => void;
}) {
  const statCards = [
    { id: '', label: 'Total', value: stats.total, icon: PiPackageBold, color: 'blue', trend: '+12%', trendUp: true },
    { id: 'active', label: 'Active', value: stats.active, icon: PiCheckCircleBold, color: 'green', trend: '+5%', trendUp: true },
    { id: 'low_stock', label: 'Low Stock', value: stats.lowStock, icon: PiWarningBold, color: 'amber', trend: '-3%', trendUp: false },
    { id: 'out_of_stock', label: 'Out of Stock', value: stats.outOfStock, icon: PiXCircleBold, color: 'red', trend: '+2%', trendUp: false },
  ];

  const colorMap: Record<string, { bg: string; text: string; iconBg: string; ring: string }> = {
    blue: { bg: 'from-blue-500/10 to-blue-500/5', text: 'text-blue-600', iconBg: 'bg-blue-500', ring: 'ring-blue-500/30' },
    green: { bg: 'from-green-500/10 to-green-500/5', text: 'text-green-600', iconBg: 'bg-green-500', ring: 'ring-green-500/30' },
    amber: { bg: 'from-amber-500/10 to-amber-500/5', text: 'text-amber-600', iconBg: 'bg-amber-500', ring: 'ring-amber-500/30' },
    red: { bg: 'from-red-500/10 to-red-500/5', text: 'text-red-600', iconBg: 'bg-red-500', ring: 'ring-red-500/30' },
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
              'relative p-5 rounded-2xl bg-gradient-to-br text-left transition-all overflow-hidden group',
              colors.bg,
              isActive && 'ring-4 ' + colors.ring
            )}
          >
            <motion.div 
              className="absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-20 group-hover:scale-150 transition-transform duration-500"
              style={{ backgroundColor: 'currentColor' }}
            />
            
            <Flex justify="between" align="start">
              <div>
                <Text className={cn("text-xs font-bold uppercase tracking-wider opacity-70", colors.text)}>
                  {stat.label}
                </Text>
                <motion.div key={stat.value} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mt-1">
                  <Text className="text-3xl font-black">{stat.value}</Text>
                </motion.div>
              </div>
              
              <motion.div
                whileHover={{ scale: 1.1, rotate: 5 }}
                className={cn("w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg", colors.iconBg)}
              >
                <Icon className="w-6 h-6" />
              </motion.div>
            </Flex>
            
            <Flex align="center" gap="1" className="mt-3 pt-3 border-t border-black/5">
              {stat.trendUp ? (
                <PiTrendUpBold className="w-3.5 h-3.5 text-green-500" />
              ) : (
                <PiTrendDownBold className="w-3.5 h-3.5 text-red-500" />
              )}
              <Text className={cn("text-xs font-semibold", stat.trendUp ? "text-green-600" : "text-red-500")}>
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
function BulkActionsBar({
  selectedCount,
  onDelete,
  onExport,
  onClear,
}: {
  selectedCount: number;
  onDelete: () => void;
  onExport: () => void;
  onClear: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 50, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900/95 backdrop-blur-xl text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 z-50 border border-gray-700/50"
    >
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center justify-center w-10 h-10 bg-blue-500 rounded-xl">
        <Text className="text-lg font-bold">{selectedCount}</Text>
      </motion.div>
      <Text className="font-semibold">selected</Text>
      
      <div className="h-8 w-px bg-gray-700" />
      
      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={onExport} className="flex items-center gap-2 px-4 py-2 rounded-xl hover:bg-white/10 transition-colors">
        <PiDownloadBold className="w-5 h-5" />
        <Text className="font-medium">Export</Text>
      </motion.button>
      
      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={onDelete} className="flex items-center gap-2 px-4 py-2 rounded-xl hover:bg-red-500/20 text-red-400 transition-colors">
        <PiTrashBold className="w-5 h-5" />
        <Text className="font-medium">Delete</Text>
      </motion.button>
      
      <div className="h-8 w-px bg-gray-700" />
      
      <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={onClear} className="p-2 rounded-xl hover:bg-white/10 transition-colors">
        <PiXCircleBold className="w-5 h-5 text-gray-400" />
      </motion.button>
    </motion.div>
  );
}

// Empty State
function EmptyState({ onClear }: { onClear: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-3xl shadow-sm border border-gray-200 p-16 text-center">
      <motion.div initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", delay: 0.2 }} className="w-32 h-32 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-6">
        <PiPackageBold className="w-16 h-16 text-gray-400" />
      </motion.div>
      
      <Text className="text-gray-700 font-bold text-2xl mb-3">No sub-products found</Text>
      <Text className="text-gray-500 text-lg mb-8 max-w-md mx-auto">
        We couldn't find any products matching your criteria.
      </Text>
      
      <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={onClear} className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-semibold shadow-lg shadow-blue-500/30 hover:shadow-xl transition-all">
        <PiArrowsClockwiseBold className="w-5 h-5" />
        Clear Filters
      </motion.button>
    </motion.div>
  );
}

// Error State
function ErrorState({ onRetry, message }: { onRetry: () => void; message: string }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-3xl shadow-sm border border-red-200 p-12 text-center">
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <PiWarningBold className="w-12 h-12 text-red-500" />
      </motion.div>
      
      <Text className="text-red-600 font-bold text-xl mb-2">Something went wrong</Text>
      <Text className="text-gray-500 mb-8">{message}</Text>
      
      <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={onRetry} className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-semibold shadow-lg shadow-red-500/30 transition-all">
        <PiArrowsClockwiseBold className="w-5 h-5" />
        Try Again
      </motion.button>
    </motion.div>
  );
}

// Active Filters Display
function ActiveFiltersBar({
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
  const hasFilters = statusFilter || visibilityFilter !== 'all' || searchQuery || filterCount > 0;

  if (!hasFilters) return null;

  // Helper to create filter badges
  const FilterBadge = ({ label, color, onClear }: { label: string; color: string; onClear: () => void }) => (
    <Badge size="sm" variant="flat" color={color as any} className="gap-1">
      {label}
      <button onClick={onClear} className="ml-1 hover:text-red-500 font-bold">×</button>
    </Badge>
  );

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="flex items-center gap-2 flex-wrap px-4 py-3 bg-blue-50 rounded-xl border border-blue-100"
    >
      <PiFunnelBold className="w-4 h-4 text-blue-500 flex-shrink-0" />
      <Text className="text-sm font-medium text-blue-700 flex-shrink-0">Active filters:</Text>
      
      {searchQuery && <FilterBadge label={`"${searchQuery}"`} color="primary" onClear={onClearSearch} />}
      {statusFilter && <FilterBadge label={statusFilter.replace('_', ' ')} color="success" onClear={onClearStatus} />}
      {visibilityFilter !== 'all' && <FilterBadge label={visibilityFilter} color="warning" onClear={onClearVisibility} />}
      
      {/* Status & Visibility */}
      {advancedFilters.status.length > 0 && <FilterBadge label={`Status: ${advancedFilters.status.length}`} color="secondary" onClear={() => onClearAdvanced('status')} />}
      {advancedFilters.stockStatus.length > 0 && <FilterBadge label={`Stock: ${advancedFilters.stockStatus.length}`} color="danger" onClear={() => onClearAdvanced('stockStatus')} />}
      {advancedFilters.visibility.length > 0 && <FilterBadge label={`Visibility: ${advancedFilters.visibility.length}`} color="warning" onClear={() => onClearAdvanced('visibility')} />}
      
      {/* Pricing */}
      {(advancedFilters.priceRange[0] > 0 || advancedFilters.priceRange[1] > 0) && (
        <FilterBadge label={`₦${advancedFilters.priceRange[0].toLocaleString()}-${advancedFilters.priceRange[1].toLocaleString()}`} color="info" onClear={() => onClearAdvanced('priceRange')} />
      )}
      {(advancedFilters.marginRange[0] > 0 || advancedFilters.marginRange[1] > 0) && (
        <FilterBadge label={`Margin: ${advancedFilters.marginRange[0]}-${advancedFilters.marginRange[1]}%`} color="success" onClear={() => onClearAdvanced('marginRange')} />
      )}
      {advancedFilters.onSale !== null && <FilterBadge label={advancedFilters.onSale ? 'On Sale' : 'Not On Sale'} color="danger" onClear={() => onClearAdvanced('onSale')} />}
      
      {/* Inventory */}
      {(advancedFilters.stockRange[0] > 0 || advancedFilters.stockRange[1] > 0) && (
        <FilterBadge label={`Stock: ${advancedFilters.stockRange[0]}-${advancedFilters.stockRange[1]}`} color="secondary" onClear={() => onClearAdvanced('stockRange')} />
      )}
      {advancedFilters.hasVariants !== null && <FilterBadge label={advancedFilters.hasVariants ? 'Has Variants' : 'No Variants'} color="info" onClear={() => onClearAdvanced('hasVariants')} />}
      {advancedFilters.needsReorder !== null && <FilterBadge label={advancedFilters.needsReorder ? 'Needs Reorder' : 'Stock OK'} color="warning" onClear={() => onClearAdvanced('needsReorder')} />}
      
      {/* Beverage */}
      {advancedFilters.beverageTypes.length > 0 && <FilterBadge label={`Types: ${advancedFilters.beverageTypes.length}`} color="secondary" onClear={() => onClearAdvanced('beverageTypes')} />}
      {advancedFilters.isAlcoholic !== null && <FilterBadge label={advancedFilters.isAlcoholic ? 'Alcoholic' : 'Non-Alcoholic'} color="danger" onClear={() => onClearAdvanced('isAlcoholic')} />}
      {(advancedFilters.abvRange[0] > 0 || advancedFilters.abvRange[1] > 0) && (
        <FilterBadge label={`ABV: ${advancedFilters.abvRange[0]}-${advancedFilters.abvRange[1]}%`} color="warning" onClear={() => onClearAdvanced('abvRange')} />
      )}
      {(advancedFilters.volumeRange[0] > 0 || advancedFilters.volumeRange[1] > 0) && (
        <FilterBadge label={`Vol: ${advancedFilters.volumeRange[0]}-${advancedFilters.volumeRange[1]}ml`} color="info" onClear={() => onClearAdvanced('volumeRange')} />
      )}
      {advancedFilters.originCountries.length > 0 && <FilterBadge label={`Origins: ${advancedFilters.originCountries.length}`} color="success" onClear={() => onClearAdvanced('originCountries')} />}
      
      {/* Flags */}
      {advancedFilters.isFeatured !== null && <FilterBadge label={advancedFilters.isFeatured ? 'Featured' : 'Not Featured'} color="warning" onClear={() => onClearAdvanced('isFeatured')} />}
      {advancedFilters.isBestSeller !== null && <FilterBadge label={advancedFilters.isBestSeller ? 'Best Seller' : 'Not Best Seller'} color="success" onClear={() => onClearAdvanced('isBestSeller')} />}
      {advancedFilters.isNewArrival !== null && <FilterBadge label={advancedFilters.isNewArrival ? 'New Arrival' : 'Not New'} color="primary" onClear={() => onClearAdvanced('isNewArrival')} />}
      
      {/* Channels */}
      {advancedFilters.visibleInPOS !== null && <FilterBadge label={advancedFilters.visibleInPOS ? 'In POS' : 'Not in POS'} color="secondary" onClear={() => onClearAdvanced('visibleInPOS')} />}
      {advancedFilters.visibleInOnlineStore !== null && <FilterBadge label={advancedFilters.visibleInOnlineStore ? 'Online' : 'Not Online'} color="info" onClear={() => onClearAdvanced('visibleInOnlineStore')} />}
      
      {/* Performance */}
      {(advancedFilters.salesRange[0] > 0 || advancedFilters.salesRange[1] > 0) && (
        <FilterBadge label={`Sales: ${advancedFilters.salesRange[0]}-${advancedFilters.salesRange[1]}`} color="success" onClear={() => onClearAdvanced('salesRange')} />
      )}
      
      {/* Seasonality */}
      {advancedFilters.seasons.length > 0 && <FilterBadge label={`Seasons: ${advancedFilters.seasons.length}`} color="warning" onClear={() => onClearAdvanced('seasons')} />}
      {advancedFilters.occasions.length > 0 && <FilterBadge label={`Occasions: ${advancedFilters.occasions.length}`} color="danger" onClear={() => onClearAdvanced('occasions')} />}
      
      {/* Dates */}
      {(advancedFilters.dateRange.from || advancedFilters.dateRange.to) && <FilterBadge label="Date Added" color="secondary" onClear={() => onClearAdvanced('dateRange')} />}
      {(advancedFilters.lastSoldRange.from || advancedFilters.lastSoldRange.to) && <FilterBadge label="Last Sold" color="info" onClear={() => onClearAdvanced('lastSoldRange')} />}
      {(advancedFilters.lastRestockRange.from || advancedFilters.lastRestockRange.to) && <FilterBadge label="Last Restock" color="warning" onClear={() => onClearAdvanced('lastRestockRange')} />}
      
      <button onClick={onClearAll} className="ml-auto text-xs font-medium text-red-500 hover:text-red-700 flex-shrink-0">
        Clear all
      </button>
    </motion.div>
  );
}

export default function SubProductsTable({
  pageSize = 10,
  hideFilters = false,
  hidePagination = false,
  hideFooter = false,
  classNames = {
    container: 'border-0 shadow-none rounded-2xl overflow-auto',
    rowClassName: 'group hover:!bg-gray-50/80 transition-all duration-200',
    headerClassName: '!bg-gradient-to-r from-gray-50 to-gray-100',
    cellClassName: 'py-3 px-2',
  },
  paginationClassName,
}: {
  pageSize?: number;
  hideFilters?: boolean;
  hidePagination?: boolean;
  hideFooter?: boolean;
  classNames?: TableClassNameProps;
  paginationClassName?: string;
}) {
  const { data: session, status: sessionStatus } = useSession();
  
  // State - Raw data from API
  const [allSubProducts, setAllSubProducts] = useState<SubProductListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'published' | 'draft' | 'hidden'>('all');
  const [advancedFilters, setAdvancedFilters] = useState<FilterConfig>(initialFilters);
  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'compact'>('list');
  const [gridSelection, setGridSelection] = useState<Record<string, boolean>>({});

  // Page size based on view mode
  const currentPageSize = useMemo(() => {
    switch (viewMode) {
      case 'list': return 80;
      case 'grid': return 50;
      case 'compact': return 100;
      default: return 80;
    }
  }, [viewMode]);

  // Handle view mode change with pagination reset
  const handleViewModeChange = useCallback((newMode: 'list' | 'grid' | 'compact') => {
    setViewMode(newMode);
    setGridSelection({});
  }, []);

  // Stats from raw data
  const stats = useMemo(() => {
    const total = allSubProducts.length;
    const active = allSubProducts.filter(p => p.status === 'active').length;
    const lowStock = allSubProducts.filter(p => p.totalStock > 0 && p.totalStock <= 10).length;
    const outOfStock = allSubProducts.filter(p => p.totalStock === 0).length;
    const published = allSubProducts.filter(p => p.isPublished).length;
    const draft = allSubProducts.filter(p => !p.isPublished).length;
    return { total, active, lowStock, outOfStock, published, draft };
  }, [allSubProducts]);

  // CLIENT-SIDE FILTERING - Comprehensive filtering logic
  const filteredSubProducts = useMemo(() => {
    let result = [...allSubProducts];
    
    // ═══════════════════════════════════════════════════════════
    // SEARCH FILTER
    // ═══════════════════════════════════════════════════════════
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(p => 
        p.sku?.toLowerCase().includes(query) ||
        p.product?.name?.toLowerCase().includes(query) ||
        p.product?.type?.toLowerCase().includes(query) ||
        p.product?.brand?.name?.toLowerCase().includes(query) ||
        p.product?.category?.name?.toLowerCase().includes(query)
      );
    }
    
    // ═══════════════════════════════════════════════════════════
    // STATUS FILTER (from stats cards)
    // ═══════════════════════════════════════════════════════════
    if (statusFilter) {
      switch (statusFilter) {
        case 'active':
          result = result.filter(p => p.status === 'active');
          break;
        case 'low_stock':
          result = result.filter(p => p.totalStock > 0 && p.totalStock <= 10);
          break;
        case 'out_of_stock':
          result = result.filter(p => p.totalStock === 0);
          break;
        default:
          result = result.filter(p => p.status === statusFilter);
      }
    }
    
    // ═══════════════════════════════════════════════════════════
    // VISIBILITY FILTER (dropdown)
    // ═══════════════════════════════════════════════════════════
    if (visibilityFilter !== 'all') {
      switch (visibilityFilter) {
        case 'published':
          result = result.filter(p => p.isPublished);
          break;
        case 'draft':
          result = result.filter(p => !p.isPublished);
          break;
        case 'hidden':
          result = result.filter(p => p.status === 'hidden');
          break;
      }
    }
    
    // ═══════════════════════════════════════════════════════════
    // ADVANCED FILTERS - STATUS & VISIBILITY
    // ═══════════════════════════════════════════════════════════
    if (advancedFilters.status.length > 0) {
      result = result.filter(p => advancedFilters.status.includes(p.status));
    }
    
    if (advancedFilters.stockStatus.length > 0) {
      result = result.filter(p => {
        if (advancedFilters.stockStatus.includes('in_stock') && p.totalStock > 10) return true;
        if (advancedFilters.stockStatus.includes('low_stock') && p.totalStock > 0 && p.totalStock <= 10) return true;
        if (advancedFilters.stockStatus.includes('out_of_stock') && p.totalStock === 0) return true;
        if (advancedFilters.stockStatus.includes('pre_order') && p.stockStatus === 'pre_order') return true;
        return false;
      });
    }
    
    if (advancedFilters.visibility.length > 0) {
      result = result.filter(p => {
        if (advancedFilters.visibility.includes('published') && p.isPublished) return true;
        if (advancedFilters.visibility.includes('draft') && !p.isPublished) return true;
        if (advancedFilters.visibility.includes('hidden') && p.status === 'hidden') return true;
        return false;
      });
    }
    
    // ═══════════════════════════════════════════════════════════
    // ADVANCED FILTERS - PRICING
    // ═══════════════════════════════════════════════════════════
    if (advancedFilters.priceRange[0] > 0 || advancedFilters.priceRange[1] > 0) {
      const [minPrice, maxPrice] = advancedFilters.priceRange;
      result = result.filter(p => {
        const price = p.baseSellingPrice || 0;
        if (minPrice > 0 && price < minPrice) return false;
        if (maxPrice > 0 && price > maxPrice) return false;
        return true;
      });
    }
    
    if (advancedFilters.marginRange[0] > 0 || advancedFilters.marginRange[1] > 0) {
      const [minMargin, maxMargin] = advancedFilters.marginRange;
      result = result.filter(p => {
        const margin = p.marginPercentage || ((p.baseSellingPrice - p.costPrice) / p.baseSellingPrice * 100) || 0;
        if (minMargin > 0 && margin < minMargin) return false;
        if (maxMargin > 0 && margin > maxMargin) return false;
        return true;
      });
    }
    
    if (advancedFilters.onSale === true) {
      result = result.filter(p => p.isOnSale);
    } else if (advancedFilters.onSale === false) {
      result = result.filter(p => !p.isOnSale);
    }
    
    // ═══════════════════════════════════════════════════════════
    // ADVANCED FILTERS - INVENTORY
    // ═══════════════════════════════════════════════════════════
    if (advancedFilters.stockRange[0] > 0 || advancedFilters.stockRange[1] > 0) {
      const [minStock, maxStock] = advancedFilters.stockRange;
      result = result.filter(p => {
        const stock = p.totalStock || 0;
        if (minStock > 0 && stock < minStock) return false;
        if (maxStock > 0 && stock > maxStock) return false;
        return true;
      });
    }
    
    if (advancedFilters.hasVariants === true) {
      result = result.filter(p => p.sizes && p.sizes.length > 1);
    } else if (advancedFilters.hasVariants === false) {
      result = result.filter(p => !p.sizes || p.sizes.length <= 1);
    }
    
    if (advancedFilters.needsReorder === true) {
      result = result.filter(p => p.totalStock <= (p.reorderPoint || 5));
    } else if (advancedFilters.needsReorder === false) {
      result = result.filter(p => p.totalStock > (p.reorderPoint || 5));
    }
    
    // ═══════════════════════════════════════════════════════════
    // ADVANCED FILTERS - BEVERAGE SPECIFIC
    // ═══════════════════════════════════════════════════════════
    if (advancedFilters.beverageTypes.length > 0) {
      result = result.filter(p => {
        const productType = p.product?.type?.toLowerCase() || '';
        return advancedFilters.beverageTypes.some(type => productType.includes(type.toLowerCase()));
      });
    }
    
    if (advancedFilters.isAlcoholic === true) {
      result = result.filter(p => p.product?.isAlcoholic);
    } else if (advancedFilters.isAlcoholic === false) {
      result = result.filter(p => !p.product?.isAlcoholic);
    }
    
    if (advancedFilters.abvRange[0] > 0 || advancedFilters.abvRange[1] > 0) {
      const [minAbv, maxAbv] = advancedFilters.abvRange;
      result = result.filter(p => {
        const abv = p.product?.abv || 0;
        if (minAbv > 0 && abv < minAbv) return false;
        if (maxAbv > 0 && abv > maxAbv) return false;
        return true;
      });
    }
    
    if (advancedFilters.volumeRange[0] > 0 || advancedFilters.volumeRange[1] > 0) {
      const [minVol, maxVol] = advancedFilters.volumeRange;
      result = result.filter(p => {
        const volume = p.product?.volumeMl || 0;
        if (minVol > 0 && volume < minVol) return false;
        if (maxVol > 0 && volume > maxVol) return false;
        return true;
      });
    }
    
    if (advancedFilters.originCountries.length > 0) {
      result = result.filter(p => {
        const origin = p.product?.originCountry?.toUpperCase() || '';
        return advancedFilters.originCountries.includes(origin);
      });
    }
    
    // ═══════════════════════════════════════════════════════════
    // ADVANCED FILTERS - PRODUCT FLAGS
    // ═══════════════════════════════════════════════════════════
    if (advancedFilters.isFeatured === true) {
      result = result.filter(p => p.isFeaturedByTenant);
    } else if (advancedFilters.isFeatured === false) {
      result = result.filter(p => !p.isFeaturedByTenant);
    }
    
    if (advancedFilters.isBestSeller === true) {
      result = result.filter(p => p.isBestSeller);
    } else if (advancedFilters.isBestSeller === false) {
      result = result.filter(p => !p.isBestSeller);
    }
    
    if (advancedFilters.isNewArrival === true) {
      result = result.filter(p => p.isNewArrival);
    } else if (advancedFilters.isNewArrival === false) {
      result = result.filter(p => !p.isNewArrival);
    }
    
    // ═══════════════════════════════════════════════════════════
    // ADVANCED FILTERS - SALES CHANNELS
    // ═══════════════════════════════════════════════════════════
    if (advancedFilters.visibleInPOS === true) {
      result = result.filter(p => p.visibleInPOS !== false);
    } else if (advancedFilters.visibleInPOS === false) {
      result = result.filter(p => p.visibleInPOS === false);
    }
    
    if (advancedFilters.visibleInOnlineStore === true) {
      result = result.filter(p => p.visibleInOnlineStore !== false);
    } else if (advancedFilters.visibleInOnlineStore === false) {
      result = result.filter(p => p.visibleInOnlineStore === false);
    }
    
    // ═══════════════════════════════════════════════════════════
    // ADVANCED FILTERS - PERFORMANCE
    // ═══════════════════════════════════════════════════════════
    if (advancedFilters.salesRange[0] > 0 || advancedFilters.salesRange[1] > 0) {
      const [minSales, maxSales] = advancedFilters.salesRange;
      result = result.filter(p => {
        const sales = p.totalSold || 0;
        if (minSales > 0 && sales < minSales) return false;
        if (maxSales > 0 && sales > maxSales) return false;
        return true;
      });
    }
    
    if (advancedFilters.viewsRange[0] > 0 || advancedFilters.viewsRange[1] > 0) {
      const [minViews, maxViews] = advancedFilters.viewsRange;
      result = result.filter(p => {
        const views = p.viewCount || 0;
        if (minViews > 0 && views < minViews) return false;
        if (maxViews > 0 && views > maxViews) return false;
        return true;
      });
    }
    
    if (advancedFilters.conversionRange[0] > 0 || advancedFilters.conversionRange[1] > 0) {
      const [minConv, maxConv] = advancedFilters.conversionRange;
      result = result.filter(p => {
        const conv = p.conversionRate || 0;
        if (minConv > 0 && conv < minConv) return false;
        if (maxConv > 0 && conv > maxConv) return false;
        return true;
      });
    }
    
    // ═══════════════════════════════════════════════════════════
    // ADVANCED FILTERS - SEASONALITY
    // ═══════════════════════════════════════════════════════════
    if (advancedFilters.seasons.length > 0) {
      result = result.filter(p => {
        if (!p.seasonality) return false;
        return advancedFilters.seasons.some(season => p.seasonality?.[season as keyof typeof p.seasonality]);
      });
    }
    
    if (advancedFilters.occasions.length > 0) {
      result = result.filter(p => {
        if (!p.specialOccasions || p.specialOccasions.length === 0) return false;
        return advancedFilters.occasions.some(occ => p.specialOccasions?.includes(occ));
      });
    }
    
    // ═══════════════════════════════════════════════════════════
    // ADVANCED FILTERS - DATE RANGES
    // ═══════════════════════════════════════════════════════════
    if (advancedFilters.dateRange.from) {
      const fromDate = new Date(advancedFilters.dateRange.from);
      result = result.filter(p => new Date(p.createdAt) >= fromDate);
    }
    if (advancedFilters.dateRange.to) {
      const toDate = new Date(advancedFilters.dateRange.to);
      toDate.setHours(23, 59, 59, 999);
      result = result.filter(p => new Date(p.createdAt) <= toDate);
    }
    
    if (advancedFilters.lastSoldRange.from) {
      const fromDate = new Date(advancedFilters.lastSoldRange.from);
      result = result.filter(p => p.lastSoldDate && new Date(p.lastSoldDate) >= fromDate);
    }
    if (advancedFilters.lastSoldRange.to) {
      const toDate = new Date(advancedFilters.lastSoldRange.to);
      toDate.setHours(23, 59, 59, 999);
      result = result.filter(p => p.lastSoldDate && new Date(p.lastSoldDate) <= toDate);
    }
    
    if (advancedFilters.lastRestockRange.from) {
      const fromDate = new Date(advancedFilters.lastRestockRange.from);
      result = result.filter(p => p.lastRestockDate && new Date(p.lastRestockDate) >= fromDate);
    }
    if (advancedFilters.lastRestockRange.to) {
      const toDate = new Date(advancedFilters.lastRestockRange.to);
      toDate.setHours(23, 59, 59, 999);
      result = result.filter(p => p.lastRestockDate && new Date(p.lastRestockDate) <= toDate);
    }
    
    return result;
  }, [allSubProducts, searchQuery, statusFilter, visibilityFilter, advancedFilters]);

  // Calculate active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    // Status & Visibility
    if (advancedFilters.status.length) count++;
    if (advancedFilters.stockStatus.length) count++;
    if (advancedFilters.visibility.length) count++;
    // Pricing
    if (advancedFilters.priceRange[0] || advancedFilters.priceRange[1]) count++;
    if (advancedFilters.marginRange[0] || advancedFilters.marginRange[1]) count++;
    if (advancedFilters.onSale !== null) count++;
    if (advancedFilters.hasDiscount !== null) count++;
    // Inventory
    if (advancedFilters.stockRange[0] || advancedFilters.stockRange[1]) count++;
    if (advancedFilters.hasVariants !== null) count++;
    if (advancedFilters.needsReorder !== null) count++;
    // Beverage Specific
    if (advancedFilters.beverageTypes.length) count++;
    if (advancedFilters.isAlcoholic !== null) count++;
    if (advancedFilters.abvRange[0] || advancedFilters.abvRange[1]) count++;
    if (advancedFilters.volumeRange[0] || advancedFilters.volumeRange[1]) count++;
    if (advancedFilters.originCountries.length) count++;
    // Product Flags
    if (advancedFilters.isFeatured !== null) count++;
    if (advancedFilters.isBestSeller !== null) count++;
    if (advancedFilters.isNewArrival !== null) count++;
    // Sales Channels
    if (advancedFilters.visibleInPOS !== null) count++;
    if (advancedFilters.visibleInOnlineStore !== null) count++;
    // Performance
    if (advancedFilters.salesRange[0] || advancedFilters.salesRange[1]) count++;
    if (advancedFilters.viewsRange[0] || advancedFilters.viewsRange[1]) count++;
    if (advancedFilters.conversionRange[0] || advancedFilters.conversionRange[1]) count++;
    // Seasonality
    if (advancedFilters.seasons.length) count++;
    if (advancedFilters.occasions.length) count++;
    // Dates
    if (advancedFilters.dateRange.from || advancedFilters.dateRange.to) count++;
    if (advancedFilters.lastSoldRange.from || advancedFilters.lastSoldRange.to) count++;
    if (advancedFilters.lastRestockRange.from || advancedFilters.lastRestockRange.to) count++;
    return count;
  }, [advancedFilters]);

  // Fetch all subproducts (no server-side filtering for instant client-side filtering)
  const fetchSubProducts = useCallback(async (showRefresh = false) => {
    if (showRefresh) {
      setIsRefreshing(true);
    } else if (!allSubProducts.length) {
      setIsLoading(true);
    }
    setError(null);

    try {
      if (!session?.user?.token) {
        setIsLoading(false);
        setError('Please sign in to view sub-products');
        return;
      }

      const response = await subproductService.getSubProducts(session.user.token, {
        limit: 500, // Fetch all for client-side filtering
      });

      if (response.success) {
        const items = response.data?.subProducts || response.subProducts || [];
        setAllSubProducts(items);
        
        if (showRefresh) {
          toast.success(`Loaded ${items.length} products`, {
            icon: <PiSparkle className="w-5 h-5" />,
            style: { borderRadius: '12px', background: '#10b981', color: '#fff' },
          });
        }
      } else {
        setError(response.message || 'Failed to load sub-products');
      }
    } catch (err: any) {
      console.error('Failed to fetch subproducts:', err);
      setError(err.message || 'Failed to load sub-products');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      setIsSearching(false);
      setIsInitialLoad(false);
    }
  }, [session?.user?.token]);

  // Initial fetch
  useEffect(() => {
    if (sessionStatus === 'authenticated' && session?.user?.token) {
      fetchSubProducts();
    } else if (sessionStatus === 'unauthenticated') {
      setIsLoading(false);
      setError('Please sign in to view sub-products');
    }
  }, [sessionStatus, session?.user?.token, fetchSubProducts]);

  // Handle search
  const handleSearch = useCallback(() => {
    setIsSearching(true);
    if (searchQuery && !recentSearches.includes(searchQuery)) {
      setRecentSearches(prev => [searchQuery, ...prev.slice(0, 4)]);
    }
    // No need to fetch - filtering is client-side
    setTimeout(() => setIsSearching(false), 300);
  }, [searchQuery, recentSearches]);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    fetchSubProducts(true);
  }, [fetchSubProducts]);

  // Handle status filter from stats cards
  const handleStatusFilter = useCallback((filter: string) => {
    setStatusFilter(prev => prev === filter ? '' : filter);
  }, []);

  // Handle advanced filter change
  const handleAdvancedFilterChange = useCallback((newFilters: FilterConfig) => {
    setAdvancedFilters(newFilters);
  }, []);

  // Clear individual advanced filter
  const handleClearAdvancedFilter = useCallback((key: keyof FilterConfig) => {
    setAdvancedFilters(prev => ({
      ...prev,
      [key]: initialFilters[key],
    }));
  }, []);

  // Reset all filters
  const handleResetFilters = useCallback(() => {
    setAdvancedFilters(initialFilters);
    setStatusFilter('');
    setVisibilityFilter('all');
    setSearchQuery('');
  }, []);

  // Clear search
  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

  // Table setup
  const { table, setData } = useTanStackTable<SubProductListItem>({
    tableData: [],
    columnConfig: subProductListColumns,
    options: {
      initialState: {
        pagination: { pageIndex: 0, pageSize: currentPageSize },
      },
      getRowCanExpand: () => true,
      meta: {
        handleDeleteRow: async (row: SubProductListItem) => {
          if (!session?.user?.token) return;
          try {
            await subproductService.deleteSubProduct(row._id || row.id, session.user.token);
            setAllSubProducts(prev => prev.filter(r => (r._id || r.id) !== (row._id || row.id)));
            toast.success('Deleted successfully');
          } catch (err: any) {
            toast.error(err.message || 'Failed to delete');
          }
        },
        handleMultipleDelete: async (rows: SubProductListItem[]) => {
          if (!session?.user?.token) return;
          try {
            for (const row of rows) {
              await subproductService.deleteSubProduct(row._id || row.id, session.user.token);
            }
            const deletedIds = new Set(rows.map(r => r._id || r.id));
            setAllSubProducts(prev => prev.filter(r => !deletedIds.has(r._id || r.id)));
            table.resetRowSelection();
            toast.success(`Deleted ${rows.length} items`);
          } catch (err: any) {
            toast.error(err.message || 'Failed to delete');
          }
        },
      },
      enableColumnResizing: false,
    },
  });

  // Reset pagination when view mode changes
  useEffect(() => {
    table.setPagination({ pageIndex: 0, pageSize: currentPageSize });
    table.resetRowSelection();
  }, [viewMode, currentPageSize, table]);

  // Sync FILTERED data to table
  useEffect(() => {
    setData(filteredSubProducts);
  }, [filteredSubProducts, setData]);

  const selectedData = viewMode === 'list' 
    ? table.getSelectedRowModel().rows.map(row => row.original)
    : filteredSubProducts.filter(sp => gridSelection[sp._id || sp.id]);

  const selectedCount = viewMode === 'list' 
    ? table.getSelectedRowModel().rows.length 
    : Object.keys(gridSelection).filter(id => gridSelection[id]).length;

  // Bulk export
  const handleBulkExport = useCallback(() => {
    const dataToExport = selectedData.length > 0 ? selectedData : filteredSubProducts;
    const exportFields = dataToExport.map(sp => ({
      ID: sp._id || sp.id,
      SKU: sp.sku,
      Product: sp.product?.name || 'N/A',
      Price: sp.baseSellingPrice,
      Cost: sp.costPrice,
      Currency: sp.currency,
      Stock: sp.totalStock,
      Available: sp.availableStock,
      Status: sp.status,
      Visibility: sp.isPublished ? 'Published' : 'Draft',
      Created: sp.createdAt,
    }));

    exportToCSV(
      exportFields,
      'ID,SKU,Product,Price,Cost,Currency,Stock,Available,Status,Visibility,Created',
      `subproduct_data_${dataToExport.length}`
    );
    toast.success(`Exported ${dataToExport.length} items`, {
      icon: <PiDownloadBold className="w-5 h-5" />,
    });
    if (viewMode === 'list') {
      table.resetRowSelection();
    } else {
      setGridSelection({});
    }
  }, [selectedData, filteredSubProducts, table, viewMode]);

  // Bulk delete
  const handleBulkDelete = useCallback(async () => {
    if (selectedData.length === 0) return;
    await table.options.meta?.handleMultipleDelete?.(selectedData);
  }, [selectedData, table]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.key === 'r' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        handleRefresh();
      }
      if (e.key === 'Escape') {
        if (viewMode === 'list') {
          table.resetRowSelection();
        } else {
          setGridSelection({});
        }
        handleResetFilters();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleRefresh, handleResetFilters, table]);

  // Loading state
  if (sessionStatus === 'loading' || (isLoading && isInitialLoad)) {
    return (
      <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="h-10 bg-gray-200 rounded-xl w-64 animate-pulse" />
            <div className="h-10 bg-gray-200 rounded-xl w-40 animate-pulse" />
          </div>
        </div>
        <LoadingSkeleton />
      </div>
    );
  }

  // Error state
  if (error && allSubProducts.length === 0) {
    return (
      <div className="space-y-6 pb-24">
        <StatsHeader stats={stats} activeFilter={statusFilter} onFilterChange={handleStatusFilter} />
        <ErrorState onRetry={handleRefresh} message={error} />
      </div>
    );
  }

  // Empty state (no data at all)
  if (allSubProducts.length === 0 && !isLoading) {
    return (
      <div className="space-y-6 pb-24">
        <StatsHeader stats={stats} activeFilter={statusFilter} onFilterChange={handleStatusFilter} />
        <EmptyState onClear={handleResetFilters} />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Stats Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <StatsHeader stats={stats} activeFilter={statusFilter} onFilterChange={handleStatusFilter} />
      </motion.div>

      {/* Search & Filters Toolbar */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white rounded-2xl shadow-sm border border-gray-200 p-3 sm:p-4 space-y-3 sm:space-y-4"
      >
        {/* Mobile: Stack vertically, Desktop: Side by side */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          {/* Search - Full width on mobile */}
          <div className="w-full lg:w-auto lg:flex-1 lg:max-w-md">
            <EnhancedSearch
              value={searchQuery}
              onChange={setSearchQuery}
              onSearch={handleSearch}
              onClear={handleClearSearch}
              isSearching={isSearching}
              recentSearches={recentSearches}
            />
          </div>

          {/* Filter Actions - Scrollable on mobile */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap lg:flex-nowrap">
            {/* Quick Status Pills - Hidden on small mobile */}
            <div className="hidden sm:block">
              <StatusPillsInline
                activeFilter={statusFilter}
                onFilterChange={handleStatusFilter}
                stats={stats}
              />
            </div>

            {/* Visibility Toggle */}
            <VisibilityToggle
              currentVisibility={visibilityFilter}
              onVisibilityChange={setVisibilityFilter}
              counts={{
                published: stats.published || 0,
                draft: stats.draft || 0,
                hidden: 0,
              }}
            />

            {/* Advanced Filters */}
            <AdvancedFilters
              filters={advancedFilters}
              onFilterChange={handleAdvancedFilterChange}
              onReset={handleResetFilters}
              activeFilterCount={activeFilterCount}
            />

            {/* Column Toggle - Hidden on mobile for grid view */}
            <div className={cn(viewMode === 'list' ? 'block' : 'hidden lg:block')}>
              <ColumnToggle table={table} />
            </div>

            {/* View Toggle */}
            <ViewToggle currentView={viewMode} onViewChange={handleViewModeChange} />

            {/* Refresh Button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleRefresh}
              disabled={isRefreshing}
              className={cn(
                "flex-shrink-0 flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl font-medium transition-all",
                "bg-gradient-to-r from-blue-500 to-blue-600 text-white",
                "hover:from-blue-600 hover:to-blue-700",
                "shadow-lg shadow-blue-500/25 hover:shadow-xl",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              <motion.div
                animate={{ rotate: isRefreshing ? 360 : 0 }}
                transition={{ repeat: isRefreshing ? Infinity : 0, duration: 1, ease: "linear" }}
              >
                <PiArrowsClockwiseBold className="w-4 h-4 sm:w-5 sm:h-5" />
              </motion.div>
              <span className="hidden sm:inline text-sm">{isRefreshing ? 'Loading...' : 'Refresh'}</span>
            </motion.button>
          </div>
        </div>

        {/* Active Filters Bar */}
        <AnimatePresence>
          <ActiveFiltersBar
            statusFilter={statusFilter}
            visibilityFilter={visibilityFilter}
            searchQuery={searchQuery}
            advancedFilters={advancedFilters}
            filterCount={activeFilterCount}
            onClearStatus={() => setStatusFilter('')}
            onClearVisibility={() => setVisibilityFilter('all')}
            onClearSearch={handleClearSearch}
            onClearAdvanced={handleClearAdvancedFilter}
            onClearAll={handleResetFilters}
          />
        </AnimatePresence>

        {/* Results count */}
        <Flex align="center" justify="between" className="pt-2 border-t border-gray-100 flex-col sm:flex-row gap-2">
          <Text className="text-xs sm:text-sm text-gray-500">
            Showing <span className="font-semibold text-gray-800">{filteredSubProducts.length}</span> of{' '}
            <span className="font-semibold text-gray-800">{allSubProducts.length}</span> products
          </Text>
          
          <Flex gap="2" className="text-[10px] sm:text-xs text-gray-400 hidden sm:flex">
            <span><kbd className="px-1 sm:px-1.5 py-0.5 bg-gray-100 rounded text-[8px] sm:text-[10px] font-mono">/</kbd> Search</span>
            <span><kbd className="px-1 sm:px-1.5 py-0.5 bg-gray-100 rounded text-[8px] sm:text-[10px] font-mono">R</kbd> Refresh</span>
            <span><kbd className="px-1 sm:px-1.5 py-0.5 bg-gray-100 rounded text-[8px] sm:text-[10px] font-mono">Esc</kbd> Clear</span>
          </Flex>
        </Flex>
      </motion.div>

      {/* Bulk Actions Bar */}
      <AnimatePresence>
        {selectedData.length > 0 && (
          <BulkActionsBar
            selectedCount={selectedData.length}
            onDelete={handleBulkDelete}
            onExport={handleBulkExport}
            onClear={() => {
              if (viewMode === 'list') {
                table.resetRowSelection();
              } else {
                setGridSelection({});
              }
            }}
          />
        )}
      </AnimatePresence>

      {/* Empty filtered results */}
      {filteredSubProducts.length === 0 && allSubProducts.length > 0 ? (
        <EmptyState onClear={handleResetFilters} />
      ) : viewMode === 'grid' || viewMode === 'compact' ? (
        /* Grid View */
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-200 overflow-hidden"
        >
          {/* Grid Selection Header */}
          {filteredSubProducts.length > 0 && (
            <div className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200 px-3 sm:px-6 py-2 sm:py-3 flex items-center justify-between gap-2">
              <Flex align="center" gap="2" className="gap-2 sm:gap-3">
                <Checkbox
                  checked={
                    filteredSubProducts.length > 0 &&
                    filteredSubProducts.every(sp => gridSelection[sp._id || sp.id])
                  }
                  ref={(el) => {
                    if (el) {
                      const isAllSelected = filteredSubProducts.every(sp => gridSelection[sp._id || sp.id]);
                      el.indeterminate = isAllSelected 
                        ? false 
                        : filteredSubProducts.some(sp => gridSelection[sp._id || sp.id]);
                    }
                  }}
                  onChange={(e) => {
                    const checked = (e.target as HTMLInputElement).checked;
                    if (checked) {
                      const allIds: Record<string, boolean> = {};
                      filteredSubProducts.forEach(sp => {
                        allIds[sp._id || sp.id] = true;
                      });
                      setGridSelection(allIds);
                    } else {
                      setGridSelection({});
                    }
                  }}
                />
                <Text className="text-xs sm:text-sm text-gray-600">
                  {Object.keys(gridSelection).filter(id => gridSelection[id]).length > 0 ? (
                    <span className="font-semibold">
                      {Object.keys(gridSelection).filter(id => gridSelection[id]).length} <span className="hidden xs:inline">selected</span>
                    </span>
                  ) : (
                    <span className="hidden xs:inline">Select all</span>
                  )}
                </Text>
              </Flex>
              
              <Flex align="center" gap="1" className="gap-1 sm:gap-2 overflow-x-auto">
                {Object.keys(gridSelection).filter(id => gridSelection[id]).length > 0 ? (
                  <>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleBulkExport}
                      className="flex-shrink-0 flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"
                    >
                      <PiDownloadBold className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                      <span className="hidden xs:inline">Export</span>
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleBulkDelete}
                      className="flex-shrink-0 flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium bg-red-50 text-red-600 rounded-lg hover:bg-red-100"
                    >
                      <PiTrashBold className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                      <span className="hidden xs:inline">Delete</span>
                    </motion.button>
                  </>
                ) : null}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    const visibleIds = filteredSubProducts.slice(0, currentPageSize * (table.getState().pagination.pageIndex + 1)).map(sp => sp._id || sp.id);
                    const newSelection: Record<string, boolean> = { ...gridSelection };
                    visibleIds.forEach(id => {
                      newSelection[id] = !newSelection[id];
                    });
                    setGridSelection(newSelection);
                  }}
                  className="hidden sm:block text-xs text-blue-600 hover:text-blue-700 font-medium px-2 py-1 rounded hover:bg-blue-50"
                >
                  Invert
                </motion.button>
                {Object.keys(gridSelection).filter(id => gridSelection[id]).length > 0 && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setGridSelection({})}
                    className="text-[10px] sm:text-xs text-gray-500 hover:text-gray-700 px-1.5 sm:px-2 py-1 rounded hover:bg-gray-100"
                  >
                    Clear
                  </motion.button>
                )}
              </Flex>
            </div>
          )}
          
          <div className={cn(
            "grid gap-3 sm:gap-4 p-3 sm:p-6",
            viewMode === 'grid' 
              ? "grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5" 
              : "grid-cols-2 xs:grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7"
          )}>
            {filteredSubProducts.slice(0, currentPageSize * (table.getState().pagination.pageIndex + 1)).map((subProduct, index) => {
              const productId = subProduct._id || subProduct.id;
              return (
              <motion.div
                key={productId}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
              >
                {viewMode === 'grid' ? (
                  <ProductGridCard
                    product={subProduct}
                    isSelected={!!gridSelection[productId]}
                    onSelect={() => {
                      setGridSelection(prev => ({
                        ...prev,
                        [productId]: !prev[productId],
                      }));
                    }}
                    onEdit={(p) => console.log('Edit', p)}
                    onView={(p) => console.log('View', p)}
                    onToggleVisibility={(p) => console.log('Toggle visibility', p)}
                  />
                ) : (
                  <ProductGridCardCompact
                    product={subProduct}
                    isSelected={!!gridSelection[productId]}
                    onSelect={() => {
                      setGridSelection(prev => ({
                        ...prev,
                        [productId]: !prev[productId],
                      }));
                    }}
                  />
                )}
              </motion.div>
              );
            })}
          </div>
        </motion.div>
      ) : (
        /* List View */
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-x-auto"
        >
          <Table
            table={table}
            variant="modern"
            classNames={{
              container: 'rounded-none border-0',
              ...classNames,
            }}
            components={{
              expandedComponent: (row) => {
                const subProduct = row.original as SubProductListItem;
                const currencySymbols: Record<string, string> = {
                  NGN: '₦', USD: '$', EUR: '€', GBP: '£', ZAR: 'R', KES: 'KSh', GHS: '₵',
                };
                const symbol = currencySymbols[subProduct.currency] || subProduct.currency;
                
                return (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-gradient-to-r from-blue-50 via-white to-purple-50 p-6 border-t border-gray-200"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                      {/* Size Variants */}
                      <div className="md:col-span-2">
                        <Text className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                          <PiPackageBold className="w-5 h-5" />
                          Size Variants ({subProduct.sizes?.length || 0})
                        </Text>
                        <div className="space-y-2">
                          {subProduct.sizes?.map((size) => (
                            <motion.div
                              key={size._id}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              className="bg-white rounded-xl p-3 border border-gray-200 flex items-center justify-between"
                            >
                              <div>
                                <Text className="font-semibold">{size.displayName || size.size}</Text>
                                <Text className="text-xs text-gray-500">Threshold: {size.lowStockThreshold || 10}</Text>
                              </div>
                              <Flex align="center" gap="4">
                                <div className="text-right">
                                  <Text className="text-xs text-gray-400">Price</Text>
                                  <Text className="font-bold">{symbol}{(size.sellingPrice || 0).toLocaleString()}</Text>
                                </div>
                                <div className="text-right">
                                  <Text className="text-xs text-gray-400">Stock</Text>
                                  <Badge 
                                    size="sm" 
                                    color={size.stock === 0 ? 'danger' : size.stock && size.stock <= 10 ? 'warning' : 'success'}
                                  >
                                    {size.stock || 0}
                                  </Badge>
                                </div>
                              </Flex>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                      
                      {/* Product Info */}
                      <div>
                        <Text className="font-bold text-gray-800 mb-3">Product Info</Text>
                        <div className="bg-white rounded-xl p-4 border border-gray-200 space-y-2">
                          <div>
                            <Text className="text-xs text-gray-400">Product Name</Text>
                            <Text className="font-semibold">{subProduct.product?.name || 'N/A'}</Text>
                          </div>
                          <div>
                            <Text className="text-xs text-gray-400">Type</Text>
                            <Text className="font-semibold capitalize">{subProduct.product?.type?.replace(/_/g, ' ') || 'N/A'}</Text>
                          </div>
                          <div>
                            <Text className="text-xs text-gray-400">Status</Text>
                            <Badge color={subProduct.status === 'active' ? 'success' : 'neutral'} variant="flat">
                              {subProduct.status}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      
                      {/* Sales Info */}
                      <div>
                        <Text className="font-bold text-gray-800 mb-3">Sales & Revenue</Text>
                        <div className="bg-white rounded-xl p-4 border border-gray-200 space-y-2">
                          <div>
                            <Text className="text-xs text-gray-400">Total Sold</Text>
                            <Text className="font-bold text-xl">{subProduct.totalSold || 0}</Text>
                          </div>
                          <div>
                            <Text className="text-xs text-gray-400">Total Revenue</Text>
                            <Text className="font-bold text-green-600">
                              {symbol}{((subProduct.totalRevenue || 0)).toLocaleString()}
                            </Text>
                          </div>
                          <div>
                            <Text className="text-xs text-gray-400">Created</Text>
                            <Text className="text-sm">{new Date(subProduct.createdAt).toLocaleDateString()}</Text>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              },
            }}
          />
          
          {!hidePagination && (
            <TablePagination 
              table={table} 
              className={cn('p-4 border-t border-gray-100 bg-gray-50/50', paginationClassName)} 
            />
          )}
        </motion.div>
      )}
    </div>
  );
}
