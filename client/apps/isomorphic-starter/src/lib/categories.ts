/**
 * Shared categories data layer.
 * Both TemuCategories (desktop overlay) and MobileBottomNav use this so
 * a single in-memory cache serves all consumers — no duplicate network requests.
 */

export interface Category {
  _id: string;
  name: string;
  slug: string;
  icon?: string;
  color?: string;
  tagline?: string;
  description?: string;
  productCount?: number;
  isFeatured?: boolean;
  isTrending?: boolean;
  subCategories?: string[];
  parent?: string | null;
  level?: number;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
const CACHE_TTL = 5 * 60_000; // 5 minutes

let _cache: Category[] | null = null;
let _cacheTs = 0;
// Deduplicate concurrent fetches
let _inflight: Promise<Category[]> | null = null;

export async function fetchAllCategories(): Promise<Category[]> {
  if (_cache && Date.now() - _cacheTs < CACHE_TTL) return _cache;
  if (_inflight) return _inflight;

  _inflight = fetch(`${API_BASE}/api/categories`)
    .then(r => r.json())
    .then(data => {
      const cats: Category[] = data?.data?.categories ?? [];
      _cache = cats;
      _cacheTs = Date.now();
      return cats;
    })
    .catch(() => _cache ?? [])
    .finally(() => { _inflight = null; });

  return _inflight;
}

/** Root categories that have at least one approved product (directly or via a sub) */
export function getRootCategories(all: Category[]): Category[] {
  const populated = new Set(all.filter(c => (c.productCount ?? 0) > 0).map(c => c._id));

  return all.filter(c => {
    if (c.parent || (c.level ?? 0) !== 0) return false;
    if (populated.has(c._id)) return true;
    return all.some(child => child.parent === c._id && (child.level ?? 0) === 1 && populated.has(child._id));
  });
}

/** Subcategories of a parent that have at least one approved product */
export function getSubcategories(parent: Category, all: Category[]): Category[] {
  const populated = new Set(all.filter(c => (c.productCount ?? 0) > 0).map(c => c._id));

  const subs = parent.subCategories?.length
    ? all.filter(c => parent.subCategories!.includes(c._id))
    : all.filter(c => {
        const parentId = typeof c.parent === 'string' ? c.parent : (c.parent as any)?.toString?.() ?? null;
        return parentId === parent._id && (c.level ?? 0) === 1;
      });

  return subs.filter(c => populated.has(c._id));
}
