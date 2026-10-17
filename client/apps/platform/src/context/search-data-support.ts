import type {SearchFilters,RecentSearch} from './search-types';
const LS_KEY = 'dh_recentSearches';
export const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
export const POPULAR_SEARCHES: string[] = [
  'Whiskey', 'Red Wine', 'Beer', 'Vodka',
  'Champagne', 'Gin', 'Rum', 'Brandy',
  'Tequila', 'Rosé',
];

export function buildSearchParams(
  query: string,
  filters: SearchFilters,
  page: number,
  limit = 8,
): URLSearchParams {
  const p = new URLSearchParams();
  if (query.trim()) p.set('q', query.trim());
  p.set('page', String(page));
  p.set('limit', String(limit));
  if (filters.category)                 p.set('category',  filters.category);
  if (filters.type)                     p.set('type',       filters.type);
  if (filters.brand)                    p.set('brand',      filters.brand);
  if (filters.minPrice !== undefined)   p.set('minPrice',   String(filters.minPrice));
  if (filters.maxPrice !== undefined)   p.set('maxPrice',   String(filters.maxPrice));
  p.set('inStock', filters.inStock ? 'true' : 'false');
  return p;
}

export function readLocalRecents(): RecentSearch[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as RecentSearch[]) : [];
  } catch {
    return [];
  }
}

export function writeLocalRecents(searches: RecentSearch[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(searches));
  } catch { /* quota exceeded — ignore */ }
}
