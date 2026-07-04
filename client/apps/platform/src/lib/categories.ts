/**
 * Shared categories + subcategories data layer.
 * TemuCategories (desktop overlay) and MobileBottomNav both use this so
 * a single in-memory cache serves all consumers — no duplicate network requests.
 *
 * Data model:
 *  - Category   (root, level 0) ← product.category
 *  - SubCategory (separate model) ← product.subCategory
 *
 * We fetch both in parallel and expose typed helpers so consumers only deal
 * with the two exported fetch functions + two filter helpers.
 */

export interface CategoryImage {
  url?: string;
  alt?: string;
}

export interface Category {
  _id: string;
  name: string;
  slug: string;
  icon?: string;
  color?: string;
  tagline?: string;
  description?: string;
  featuredImage?: CategoryImage;
  bannerImage?: CategoryImage;
  productCount?: number;
  isFeatured?: boolean;
  isTrending?: boolean;
  /** IDs of SubCategory documents that belong to this category */
  subCategories?: string[];
  parent?: string | null;
  level?: number;
}

export interface SubCategory {
  _id: string;
  name: string;
  slug: string;
  icon?: string;
  color?: string;
  tagline?: string;
  description?: string;
  featuredImage?: CategoryImage;
  bannerImage?: CategoryImage;
  productCount?: number;
  /** Populated by the API — may be an object or a raw ID string */
  parent: string | { _id: string; name: string; slug: string } | null;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
const CACHE_TTL = 5 * 60_000; // 5 minutes

// ─── Category cache ────────────────────────────────────────────────────────
let _catCache: Category[] | null = null;
let _catCacheTs = 0;
let _catInflight: Promise<Category[]> | null = null;

export async function fetchAllCategories(): Promise<Category[]> {
  if (_catCache && Date.now() - _catCacheTs < CACHE_TTL) return _catCache;
  if (_catInflight) return _catInflight;

  _catInflight = fetch(`${API_BASE}/api/categories`)
    .then(r => r.json())
    .then(data => {
      const cats: Category[] = data?.data?.categories ?? [];
      _catCache = cats;
      _catCacheTs = Date.now();
      return cats;
    })
    .catch(() => _catCache ?? [])
    .finally(() => { _catInflight = null; });

  return _catInflight;
}

// ─── SubCategory cache ─────────────────────────────────────────────────────
let _subCache: SubCategory[] | null = null;
let _subCacheTs = 0;
let _subInflight: Promise<SubCategory[]> | null = null;

export async function fetchAllSubCategories(): Promise<SubCategory[]> {
  if (_subCache && Date.now() - _subCacheTs < CACHE_TTL) return _subCache;
  if (_subInflight) return _subInflight;

  _subInflight = fetch(`${API_BASE}/api/subcategories`)
    .then(r => r.json())
    .then(data => {
      // /api/subcategories returns { success, data: [...], total }
      const subs: SubCategory[] = data?.data ?? [];
      _subCache = subs;
      _subCacheTs = Date.now();
      return subs;
    })
    .catch(() => _subCache ?? [])
    .finally(() => { _subInflight = null; });

  return _subInflight;
}

// ─── Filter helpers ────────────────────────────────────────────────────────

/** Root categories that have at least one approved product (directly or via a sub) */
export function getRootCategories(all: Category[], allSubs: SubCategory[]): Category[] {
  const populated = new Set(all.filter(c => (c.productCount ?? 0) > 0).map(c => c._id));

  // Also mark a root category as populated if it has any populated subcategories
  const populatedSubs = new Set(
    allSubs
      .filter(s => (s.productCount ?? 0) > 0)
      .map(s => {
        const p = s.parent;
        if (!p) return null;
        return typeof p === 'string' ? p : (p as any)._id?.toString?.() ?? null;
      })
      .filter(Boolean) as string[]
  );

  return all.filter(c => {
    if (c.parent || (c.level ?? 0) !== 0) return false;
    return populated.has(c._id) || populatedSubs.has(c._id);
  });
}

/** Subcategories of a parent that have at least one approved product */
export function getSubcategories(parent: Category, allSubs: SubCategory[]): SubCategory[] {
  return allSubs.filter(sub => {
    const parentId =
      typeof sub.parent === 'string'
        ? sub.parent
        : (sub.parent as any)?._id?.toString?.() ?? null;
    return parentId === parent._id && (sub.productCount ?? 0) > 0;
  });
}
