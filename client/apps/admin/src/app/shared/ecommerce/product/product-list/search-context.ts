// Persist the product list search/filter state in sessionStorage so that:
//  1. the /products page restores the exact search when coming back from
//     the edit page, and
//  2. the edit page can walk the SAME filtered result set via prev / next.
//
// Storage key: 'dh-product-search-ctx-v1'   TTL: 30 minutes.

export const STORAGE_KEY = 'dh-product-search-ctx-v1';
export const TTL_MS = 30 * 60 * 1000; // 30 min

// Mirrors the local types from product-list/table.tsx (not imported to avoid
// pulling the 3000-line file into the edit page bundle).
export type SPFilterKey =
  | 'published'
  | 'low_stock'
  | 'out_of_stock'
  | 'archived'
  | 'alcoholic'
  | 'non_alcoholic';

export type SPGroupKey =
  | 'product_type'
  | 'category'
  | 'brand'
  | 'status'
  | 'stock_level';

export type SPChipField = 'product' | 'category' | 'vendor' | 'type' | 'origin';

export interface SPSearchChip {
  id: string;
  field: SPChipField;
  label: string;
  query: string;
}

export interface ProductSearchContextState {
  searchQuery: string;
  searchChips: SPSearchChip[];
  spActiveFilters: SPFilterKey[];
  spGroupBy: SPGroupKey | null;
  activeCustomRules: {
    rules: any[];
    matchMode: 'any' | 'all';
    includeArchived: boolean;
  } | null;
  advancedFilters: Record<string, any>;
  statusFilter: string;
  visibilityFilter: string;
  viewMode: string;
}

export interface ProductSearchContext {
  version: 1;
  ts: number;
  /** Ordered ids of the filtered results (the list the user was browsing). */
  ids: string[];
  state: ProductSearchContextState;
}

// ── Save ─────────────────────────────────────────────────────────────────────

export function saveProductSearchContext(
  ctx: Omit<ProductSearchContext, 'version' | 'ts'>
): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: ProductSearchContext = {
      version: 1,
      ts: Date.now(),
      ids: ctx.ids,
      state: ctx.state,
    };
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // silently ignore
  }
}

// ── Load ─────────────────────────────────────────────────────────────────────

export function loadProductSearchContext(): ProductSearchContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as ProductSearchContext;
    if (!data?.version || data.version !== 1) return null;
    if (Date.now() - (data.ts || 0) > TTL_MS) {
      window.sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    if (!Array.isArray(data.ids)) return null;
    return data;
  } catch {
    return null;
  }
}

// ── Clear ────────────────────────────────────────────────────────────────────

export function clearProductSearchContext(): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(STORAGE_KEY);
}

// ── Summary (for the edit page header chip) ─────────────────────────────────

export function summarizeProductSearchContext(
  ctx: ProductSearchContext | null
): string {
  if (!ctx) return '';
  const { searchQuery, searchChips, spActiveFilters, activeCustomRules } =
    ctx.state;
  if (searchQuery.trim()) return `"${searchQuery.trim()}"`;
  if (searchChips.length) {
    const first = searchChips[0]?.label || 'search';
    return `${searchChips.length} term${searchChips.length > 1 ? 's' : ''} (${first})`;
  }
  if (spActiveFilters.length > 0 || activeCustomRules) {
    const parts: string[] = [];
    if (spActiveFilters.length)
      parts.push(
        `${spActiveFilters.length} filter${spActiveFilters.length > 1 ? 's' : ''}`
      );
    if (activeCustomRules) parts.push(`custom`);
    return parts.join(' + ');
  }
  return `${ctx.ids.length} products`;
}
