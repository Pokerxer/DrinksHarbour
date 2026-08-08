// Persist the sub-product list search/filter state (and the ordered ids of
// the filtered result set) in sessionStorage so that:
//  1. the /sub-products page restores the exact search when coming back from
//     the edit page, and
//  2. the edit page can walk the SAME filtered result set via prev / next.
//
// Storage key: 'dh-sp-search-ctx-v1'   TTL: 30 minutes.

import type { SPSearchChip, SPFilterKey, SPGroupKey } from './components/OdooSearchPanel';
import type { FilterConfig } from './components';
import type { ActiveCustomRules } from './components/CustomFilterModal';

export const STORAGE_KEY = 'dh-sp-search-ctx-v1';
export const TTL_MS = 30 * 60 * 1000; // 30 min

export interface SubProductSearchContextState {
  searchQuery: string;
  searchChips: SPSearchChip[];
  /** Array form of Set<SPFilterKey> (Sets aren't JSON-safe). */
  spActiveFilters: SPFilterKey[];
  spGroupBy: SPGroupKey | null;
  activeCustomRules: ActiveCustomRules | null;
  advancedFilters: FilterConfig;
  statusFilter: string;
  visibilityFilter: string;
  gridSort: string;
  viewMode: string;
  gridPageIndex: number;
  gridPageSize: number;
}

export interface SubProductSearchContext {
  version: 1;
  ts: number;
  /** Ordered ids of the filtered results (the list the user was browsing). */
  ids: string[];
  state: SubProductSearchContextState;
}

// ── Save ─────────────────────────────────────────────────────────────────────

export function saveSubProductSearchContext(
  ctx: Omit<SubProductSearchContext, 'version' | 'ts'>
): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: SubProductSearchContext = {
      version: 1,
      ts: Date.now(),
      ids: ctx.ids,
      state: ctx.state,
    };
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // sessionStorage full or unavailable — silently ignore.
  }
}

// ── Load ─────────────────────────────────────────────────────────────────────

export function loadSubProductSearchContext(): SubProductSearchContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SubProductSearchContext;
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

export function clearSubProductSearchContext(): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(STORAGE_KEY);
}

// ── Summary (for the edit page header chip) ─────────────────────────────────

export function summarizeSearchContext(ctx: SubProductSearchContext | null): string {
  if (!ctx) return '';
  const { searchQuery, searchChips, spActiveFilters, activeCustomRules } = ctx.state;
  if (searchQuery.trim()) return `"${searchQuery.trim()}"`;
  if (searchChips.length) {
    const first = searchChips[0]?.label || 'search';
    return `${searchChips.length} term${searchChips.length > 1 ? 's' : ''} (${first})`;
  }
  if (spActiveFilters.length > 0 || activeCustomRules) {
    const parts: string[] = [];
    if (spActiveFilters.length) parts.push(`${spActiveFilters.length} filter${spActiveFilters.length > 1 ? 's' : ''}`);
    if (activeCustomRules) parts.push(`custom`);
    return parts.join(' + ');
  }
  return `${ctx.ids.length} products`;
}
