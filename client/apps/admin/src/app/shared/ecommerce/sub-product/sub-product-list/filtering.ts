// Pure filtering / sorting / grouping logic for the SubProducts list.
//
// Extracted from table.tsx so it can be unit-tested (see filtering.test.ts) and
// so the table component stays a thin orchestrator. This module must NOT import
// UI code — only `import type` from component files (erased at compile time).
//
// Fixes applied here (previously silent no-ops in table.tsx):
//   marginRange, hasDiscount, viewsRange, conversionRange, seasons, occasions,
//   visibility[], lastSoldRange, lastRestockRange.

import type { FilterConfig } from './components/AdvancedFilters';

// ── Types ─────────────────────────────────────────────────────────────────────

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
  seasonality?: {
    spring?: boolean;
    summer?: boolean;
    fall?: boolean;
    winter?: boolean;
  };
  specialOccasions?: string[];
  lastSoldDate?: string;
  lastRestockDate?: string;
  createdAt: string;
  updatedAt: string;
}

export type GridSortKey =
  | 'newest'
  | 'oldest'
  | 'name_asc'
  | 'name_desc'
  | 'price_asc'
  | 'price_desc'
  | 'stock_asc'
  | 'stock_desc'
  | 'best_selling';

export type GroupKey = 'product_type' | 'category' | 'brand' | 'status' | 'stock_level';

/** Structural subset of SPSearchChip (OdooSearchPanel) — keeps this module UI-free. */
export interface SearchChip {
  id: string;
  field: string;
  label?: string;
  query: string;
}

export interface Stats {
  total: number;
  active: number;
  lowStock: number;
  outOfStock: number;
  published?: number;
  draft?: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** Fallback low-stock threshold when a product has no explicit reorder point. */
export const LOW_STOCK_THRESHOLD = 10;

/** Default reorder point used by needs_reorder filters when none is set. */
export const DEFAULT_REORDER_POINT = 5;

export const CURRENCY_SYMBOLS: Record<string, string> = {
  NGN: '₦',
  USD: '$',
  EUR: '€',
  GBP: '£',
  ZAR: 'R',
  KES: 'KSh',
  GHS: '₵',
};

export function currencySymbol(code?: string): string {
  if (!code) return '';
  return CURRENCY_SYMBOLS[code] || code;
}

/** Gross margin % of a selling/cost pair (0 when the price is not positive). */
export function marginPercentage(sellingPrice: number, costPrice: number): number {
  if (!sellingPrice || sellingPrice <= 0) return 0;
  return ((sellingPrice - (costPrice || 0)) / sellingPrice) * 100;
}

/** Selling price shown for sorting/cards: first variant price, else base. */
export function effectivePrice(p: SubProductListItem): number {
  return p.sizes?.[0]?.sellingPrice || p.baseSellingPrice || 0;
}

/** Low-stock check honouring an explicit threshold when provided. */
export function isLowStock(p: Pick<SubProductListItem, 'totalStock'>): boolean {
  const stock = p.totalStock ?? 0;
  return stock > 0 && stock <= LOW_STOCK_THRESHOLD;
}

// ── Initial filter state ──────────────────────────────────────────────────────

export const initialFilters: FilterConfig = {
  status: [],
  stockStatus: [],
  visibility: [],
  priceRange: [0, 0],
  marginRange: [0, 0],
  onSale: null,
  hasDiscount: null,
  stockRange: [0, 0],
  hasVariants: null,
  needsReorder: null,
  beverageTypes: [],
  isAlcoholic: null,
  abvRange: [0, 0],
  volumeRange: [0, 0],
  originCountries: [],
  isFeatured: null,
  isBestSeller: null,
  isNewArrival: null,
  visibleInPOS: null,
  visibleInOnlineStore: null,
  salesRange: [0, 0],
  viewsRange: [0, 0],
  conversionRange: [0, 0],
  seasons: [],
  occasions: [],
  dateRange: { from: '', to: '' },
  lastSoldRange: { from: '', to: '' },
  lastRestockRange: { from: '', to: '' },
};

// ── Active-filter counting (for the "N filters active" pill) ──────────────────

type Range2 = [number, number];

const rangeActive = ([min, max]: Range2) => min > 0 || max > 0;
const dateRangeActive = (r: { from: string; to: string }) => Boolean(r.from || r.to);

export function activeFilterCount(af: FilterConfig): number {
  let count = 0;
  if (af.status.length) count++;
  if (af.stockStatus.length) count++;
  if (af.visibility.length) count++;
  if (rangeActive(af.priceRange)) count++;
  if (rangeActive(af.marginRange)) count++;
  if (af.onSale !== null) count++;
  if (af.hasDiscount !== null) count++;
  if (rangeActive(af.stockRange)) count++;
  if (af.hasVariants !== null) count++;
  if (af.needsReorder !== null) count++;
  if (af.beverageTypes.length) count++;
  if (af.isAlcoholic !== null) count++;
  if (rangeActive(af.abvRange)) count++;
  if (rangeActive(af.volumeRange)) count++;
  if (af.originCountries.length) count++;
  if (af.isFeatured !== null) count++;
  if (af.isBestSeller !== null) count++;
  if (af.isNewArrival !== null) count++;
  if (af.visibleInPOS !== null) count++;
  if (af.visibleInOnlineStore !== null) count++;
  if (rangeActive(af.salesRange)) count++;
  if (rangeActive(af.viewsRange)) count++;
  if (rangeActive(af.conversionRange)) count++;
  if (af.seasons.length) count++;
  if (af.occasions.length) count++;
  if (dateRangeActive(af.dateRange)) count++;
  if (dateRangeActive(af.lastSoldRange)) count++;
  if (dateRangeActive(af.lastRestockRange)) count++;
  return count;
}

// ── Internals ─────────────────────────────────────────────────────────────────

/** Numeric range match; a bound of 0 (or less) means "unbounded". */
function inRange(value: number, [min, max]: Range2): boolean {
  return (min <= 0 || value >= min) && (max <= 0 || value <= max);
}

/**
 * End-of-day timestamp (UTC) for a YYYY-MM-DD string. Using UTC avoids
 * timezone drift: `new Date('2026-03-10')` parses as UTC midnight, so the
 * inclusive upper bound must also be anchored to UTC.
 */
function endOfDayUtc(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return NaN;
  return Date.UTC(y, m - 1, d, 23, 59, 59, 999);
}

function matchesDateRange(
  isoDate: string | undefined,
  range: { from: string; to: string }
): boolean {
  // Products without the date never satisfy an active date filter.
  if (!isoDate) return false;
  const t = new Date(isoDate).getTime();
  if (Number.isNaN(t)) return false;
  if (range.from) {
    const from = new Date(range.from).getTime();
    if (!Number.isNaN(from) && t < from) return false;
  }
  if (range.to) {
    const to = endOfDayUtc(range.to);
    if (!Number.isNaN(to) && t > to) return false;
  }
  return true;
}

/** Tri-state facet: true → must be truthy, false → must be falsy, null → off. */
function triState(value: boolean | null, actual: unknown): boolean {
  if (value === null) return true;
  return value ? Boolean(actual) : !actual;
}

function matchesSearchQuery(p: SubProductListItem, query: string): boolean {
  const q = query.toLowerCase();
  return (
    !!p.sku?.toLowerCase().includes(q) ||
    !!p.product?.name?.toLowerCase().includes(q) ||
    !!p.product?.type?.toLowerCase().includes(q) ||
    !!p.product?.brand?.name?.toLowerCase().includes(q) ||
    !!p.product?.category?.name?.toLowerCase().includes(q)
  );
}

function matchesChip(p: SubProductListItem, chip: SearchChip): boolean {
  const terms = chip.query
    .toLowerCase()
    .split(' or ')
    .map((t) => t.trim())
    .filter(Boolean);
  const matchesAny = (value: string | undefined | null) =>
    !!value && terms.some((t) => value.toLowerCase().includes(t));

  switch (chip.field) {
    case 'product':
      return matchesAny(p.product?.name) || matchesAny(p.sku);
    case 'category':
    case 'pos_category':
      return matchesAny(p.product?.category?.name);
    case 'vendor':
      return matchesAny(p.product?.brand?.name);
    case 'tags':
      // Tags live on the catalog product today; fall back to its name.
      return matchesAny(p.product?.name);
    case 'attributes':
      return (
        matchesAny(p.sku) ||
        p.sizes?.some((s: SizeVariant) => matchesAny(s.displayName || s.size)) ||
        false
      );
    default:
      return true;
  }
}

function matchesQuickFilter(p: SubProductListItem, key: string): boolean {
  switch (key) {
    case 'featured':
      return !!p.isFeaturedByTenant;
    case 'new_arrival':
      return !!p.isNewArrival;
    case 'best_seller':
      return !!p.isBestSeller;
    case 'on_sale':
      return !!p.isOnSale;
    case 'low_stock':
      return isLowStock(p);
    case 'out_of_stock':
      return (p.totalStock ?? 0) === 0;
    case 'needs_reorder':
      return (p.totalStock ?? 0) <= (p.reorderPoint || DEFAULT_REORDER_POINT);
    case 'published':
      return !!p.isPublished;
    case 'available_in_pos':
      return p.visibleInPOS !== false;
    case 'available_online':
      return p.visibleInOnlineStore !== false;
    case 'has_sales':
      return (p.totalSold || 0) > 0;
    case 'no_sales':
      return (p.totalSold || 0) === 0;
    case 'archived':
      return p.status === 'discontinued' || p.status === 'archived';
    default:
      return true;
  }
}

function matchesVisibilityFacet(p: SubProductListItem, values: string[]): boolean {
  return values.some((v) => {
    switch (v) {
      case 'published':
        return !!p.isPublished;
      case 'draft':
        return !p.isPublished;
      case 'hidden':
        return p.visibleInOnlineStore === false;
      default:
        return false;
    }
  });
}

function matchesSeasons(p: SubProductListItem, seasons: string[]): boolean {
  const s = p.seasonality;
  if (!s) return false;
  return seasons.some((season) => Boolean(s[season as keyof typeof s]));
}

function matchesOccasions(p: SubProductListItem, occasions: string[]): boolean {
  const mine = p.specialOccasions;
  if (!mine?.length) return false;
  return occasions.some((o) => mine.includes(o));
}

function matchesStockStatusFacet(
  p: SubProductListItem,
  statuses: string[],
  lowStockThreshold = LOW_STOCK_THRESHOLD
): boolean {
  return statuses.some((s) => {
    switch (s) {
      case 'in_stock':
        return (p.totalStock ?? 0) > lowStockThreshold;
      case 'low_stock':
        return isLowStock(p);
      case 'out_of_stock':
        return (p.totalStock ?? 0) === 0;
      case 'pre_order':
        return p.stockStatus === 'pre_order';
      default:
        return false;
    }
  });
}

function matchesAdvancedFilters(p: SubProductListItem, f: FilterConfig): boolean {
  if (f.status.length > 0 && !f.status.includes(p.status)) return false;

  if (f.stockStatus.length > 0 && !matchesStockStatusFacet(p, f.stockStatus))
    return false;

  if (f.visibility.length > 0 && !matchesVisibilityFacet(p, f.visibility))
    return false;

  if (f.beverageTypes.length > 0) {
    const t = p.product?.type?.toLowerCase() || '';
    if (!f.beverageTypes.some((bt) => t.includes(bt.toLowerCase()))) return false;
  }

  if (!triState(f.isAlcoholic, p.product?.isAlcoholic)) return false;

  if (
    f.originCountries.length > 0 &&
    !f.originCountries.includes((p.product?.originCountry || '').toUpperCase())
  )
    return false;

  if (!triState(f.isFeatured, p.isFeaturedByTenant)) return false;
  if (!triState(f.isBestSeller, p.isBestSeller)) return false;
  if (!triState(f.isNewArrival, p.isNewArrival)) return false;
  if (!triState(f.visibleInPOS, p.visibleInPOS !== false)) return false;
  if (!triState(f.visibleInOnlineStore, p.visibleInOnlineStore !== false))
    return false;
  if (!triState(f.onSale, p.isOnSale)) return false;
  // No dedicated discount field exists yet; isOnSale is the discount signal.
  if (!triState(f.hasDiscount, p.isOnSale)) return false;
  if (!triState(f.hasVariants, (p.sizes?.length || 0) > 1)) return false;
  if (
    !triState(
      f.needsReorder,
      (p.totalStock ?? 0) <= (p.reorderPoint || DEFAULT_REORDER_POINT)
    )
  )
    return false;

  if (rangeActive(f.priceRange) && !inRange(p.baseSellingPrice || 0, f.priceRange))
    return false;
  if (rangeActive(f.marginRange) &&
    !inRange(marginPercentage(p.baseSellingPrice || 0, p.costPrice || 0), f.marginRange))
    return false;
  if (rangeActive(f.stockRange) && !inRange(p.totalStock || 0, f.stockRange))
    return false;
  if (rangeActive(f.abvRange) && !inRange(p.product?.abv || 0, f.abvRange))
    return false;
  if (rangeActive(f.volumeRange) && !inRange(p.product?.volumeMl || 0, f.volumeRange))
    return false;
  if (rangeActive(f.salesRange) && !inRange(p.totalSold || 0, f.salesRange))
    return false;
  if (rangeActive(f.viewsRange) && !inRange(p.viewCount || 0, f.viewsRange))
    return false;
  if (rangeActive(f.conversionRange) && !inRange(p.conversionRate || 0, f.conversionRange))
    return false;

  if (dateRangeActive(f.dateRange) && !matchesDateRange(p.createdAt, f.dateRange))
    return false;
  if (
    dateRangeActive(f.lastSoldRange) &&
    !matchesDateRange(p.lastSoldDate, f.lastSoldRange)
  )
    return false;
  if (
    dateRangeActive(f.lastRestockRange) &&
    !matchesDateRange(p.lastRestockDate, f.lastRestockRange)
  )
    return false;

  if (f.seasons.length > 0 && !matchesSeasons(p, f.seasons)) return false;
  if (f.occasions.length > 0 && !matchesOccasions(p, f.occasions)) return false;

  return true;
}

// ── Public pipeline ───────────────────────────────────────────────────────────

export interface SubProductFilterInput {
  statusFilter?: string;
  visibilityFilter?: string;
  searchQuery?: string;
  searchChips?: SearchChip[];
  /** Keys such as 'featured', 'low_stock', 'needs_reorder' (SP quick filters). */
  quickFilters?: Iterable<string>;
  /**
   * Caller-compiled custom-rule predicate (built around applyRule in
   * CustomFilterModal). Returning true keeps the item. Include/exclude-archived
   * semantics belong to the caller's predicate.
   */
  customMatch?: ((p: SubProductListItem) => boolean) | null;
  advancedFilters?: FilterConfig;
}

export function filterSubProducts(
  items: SubProductListItem[],
  input: SubProductFilterInput
): SubProductListItem[] {
  const {
    statusFilter = '',
    visibilityFilter = 'all',
    searchQuery = '',
    searchChips = [],
    quickFilters,
    customMatch,
    advancedFilters,
  } = input;

  let result = items;

  // Status pills (All / Active / Low stock / Out of stock)
  if (statusFilter === 'active') result = result.filter((p) => p.status === 'active');
  else if (statusFilter === 'low_stock') result = result.filter(isLowStock);
  else if (statusFilter === 'out_of_stock')
    result = result.filter((p) => (p.totalStock ?? 0) === 0);

  // Visibility dropdown
  if (visibilityFilter === 'published')
    result = result.filter((p) => p.isPublished);
  else if (visibilityFilter === 'draft')
    result = result.filter((p) => !p.isPublished);
  else if (visibilityFilter === 'hidden')
    result = result.filter((p) => p.visibleInOnlineStore === false);

  // Free-text search
  if (searchQuery.trim())
    result = result.filter((p) => matchesSearchQuery(p, searchQuery.trim()));

  // Search chips (each chip narrows further; terms inside a chip OR together)
  for (const chip of searchChips) {
    result = result.filter((p) => matchesChip(p, chip));
  }

  // Quick filters (all active keys must pass)
  if (quickFilters) {
    const keys = Array.from(quickFilters);
    if (keys.length > 0)
      result = result.filter((p) => keys.every((k) => matchesQuickFilter(p, k)));
  }

  // Custom rule engine (predicate compiled by the caller)
  if (customMatch) result = result.filter(customMatch);

  // Advanced filter panel
  if (advancedFilters) result = result.filter((p) => matchesAdvancedFilters(p, advancedFilters));

  return result;
}

// ── Sorting ───────────────────────────────────────────────────────────────────

/** Returns a new sorted array; never mutates the input. */
export function sortSubProducts(
  items: SubProductListItem[],
  sort: GridSortKey
): SubProductListItem[] {
  const arr = [...items];
  const byName = (a: SubProductListItem, b: SubProductListItem) =>
    (a.product?.name || '').localeCompare(b.product?.name || '');
  const byCreated = (a: SubProductListItem, b: SubProductListItem) =>
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();

  switch (sort) {
    case 'name_asc':
      return arr.sort(byName);
    case 'name_desc':
      return arr.sort((a, b) => byName(b, a));
    case 'price_asc':
      return arr.sort((a, b) => effectivePrice(a) - effectivePrice(b));
    case 'price_desc':
      return arr.sort((a, b) => effectivePrice(b) - effectivePrice(a));
    case 'stock_asc':
      return arr.sort((a, b) => (a.totalStock || 0) - (b.totalStock || 0));
    case 'stock_desc':
      return arr.sort((a, b) => (b.totalStock || 0) - (a.totalStock || 0));
    case 'best_selling':
      return arr.sort((a, b) => (b.totalSold || 0) - (a.totalSold || 0));
    case 'oldest':
      return arr.sort(byCreated);
    case 'newest':
    default:
      return arr.sort((a, b) => byCreated(b, a));
  }
}

// ── Grouping (Odoo-style group-by) ────────────────────────────────────────────

export function groupSubProducts(
  items: SubProductListItem[],
  groupBy: GroupKey
): [string, SubProductListItem[]][] {
  const map = new Map<string, SubProductListItem[]>();
  for (const p of items) {
    let key: string;
    switch (groupBy) {
      case 'product_type':
        key = p.product?.type?.replace(/_/g, ' ') || 'Unknown';
        break;
      case 'category':
        key = p.product?.category?.name || 'Uncategorised';
        break;
      case 'brand':
        key = p.product?.brand?.name || 'No brand';
        break;
      case 'status':
        key = (p.status || 'draft').replace(/_/g, ' ');
        break;
      case 'stock_level':
        key =
          (p.totalStock ?? 0) === 0
            ? 'Out of stock'
            : isLowStock(p)
              ? 'Low stock'
              : 'In stock';
        break;
      default:
        key = 'Other';
    }
    const bucket = map.get(key);
    if (bucket) bucket.push(p);
    else map.set(key, [p]);
  }
  return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export function computeStats(
  all: SubProductListItem[],
  serverStats?: Partial<Stats> | null
): Stats {
  // published/draft aren't returned by server stats, so always derive them
  // from the fetched catalog.
  const published = all.filter((p) => p.isPublished).length;
  const draft = all.length - published;

  if (serverStats && serverStats.total != null) {
    return { ...serverStats, total: serverStats.total!, published, draft } as Stats;
  }

  return {
    total: all.length,
    active: all.filter((p) => p.status === 'active').length,
    lowStock: all.filter(isLowStock).length,
    outOfStock: all.filter((p) => (p.totalStock ?? 0) === 0).length,
    published,
    draft,
  };
}
