import { describe, it, expect, beforeEach } from 'vitest';
import {
  filterSubProducts,
  sortSubProducts,
  groupSubProducts,
  computeStats,
  activeFilterCount,
  currencySymbol,
  marginPercentage,
  initialFilters,
  type SubProductListItem,
  type GridSortKey,
} from './filtering';
import type { FilterConfig } from './components/AdvancedFilters';

// ── Factories ─────────────────────────────────────────────────────────────────

let seq = 0;

function item(overrides: Partial<SubProductListItem> = {}): SubProductListItem {
  seq += 1;
  return {
    _id: `sp-${seq}`,
    id: `sp-${seq}`,
    sku: `SKU-${seq}`,
    baseSellingPrice: 1000,
    costPrice: 500,
    currency: 'NGN',
    totalStock: 50,
    availableStock: 50,
    stockStatus: 'in_stock',
    status: 'active',
    isPublished: true,
    createdAt: '2026-01-15T10:00:00Z',
    updatedAt: '2026-01-15T10:00:00Z',
    product: { _id: 'p1', name: `Product ${seq}`, slug: `product-${seq}` },
    ...overrides,
  };
}

function af(partial: Partial<FilterConfig>): FilterConfig {
  return { ...initialFilters, ...partial };
}

beforeEach(() => {
  seq = 0;
});

const NO_FILTERS = {
  statusFilter: '',
  visibilityFilter: 'all',
  searchQuery: '',
  searchChips: [],
  quickFilters: new Set<string>(),
  customMatch: null,
};

function filter(items: SubProductListItem[], input: Partial<typeof NO_FILTERS> = {}) {
  return filterSubProducts(items, { ...NO_FILTERS, ...input });
}

// ── Text search ───────────────────────────────────────────────────────────────

describe('text search', () => {
  it('matches sku, name, type, brand and category case-insensitively', () => {
    const items = [
      item({ sku: 'JW-RED-001', product: { _id: '1', name: 'Jameson', slug: 'j' } }),
      item({ product: { _id: '2', name: 'Chivas', slug: 'c', type: 'whiskey' } }),
      item({ product: { _id: '3', name: 'Milo', slug: 'm', brand: { name: 'Nestlé' } } }),
      item({ product: { _id: '4', name: 'Zebra', slug: 'z', category: { name: 'Spirits' } } }),
    ];
    const out = filter(items, { searchQuery: 'WHIS' });
    expect(out.map((p) => p.sku)).toEqual(['SKU-2']);
    expect(filter(items, { searchQuery: 'jw-red' }).length).toBe(1);
    expect(filter(items, { searchQuery: 'nestlé' }).length).toBe(1);
    expect(filter(items, { searchQuery: 'spirit' }).length).toBe(1);
  });

  it('search chips split on " or " and OR within a chip', () => {
    const items = [item(), item(), item()];
    items[0].product!.name = 'Red Wine';
    items[1].product!.name = 'White Wine';
    items[2].product!.name = 'Beer';
    const out = filter(items, {
      searchChips: [{ id: '1', field: 'product', label: 'Product', query: 'red or beer' }],
    });
    expect(out.length).toBe(2);
  });

  it('chip field category matches the product category only', () => {
    const items = [
      item({ product: { _id: '1', name: 'A', slug: 'a', category: { name: 'Wine' } } }),
      item({ product: { _id: '2', name: 'Wine B', slug: 'b' } }),
    ];
    const out = filter(items, {
      searchChips: [{ id: '1', field: 'category', label: 'Category', query: 'wine' }],
    });
    expect(out.length).toBe(1);
  });
});

// ── Status pills & visibility dropdown ────────────────────────────────────────

describe('status & visibility filters', () => {
  it('low_stock uses threshold of 10 inclusive', () => {
    const items = [item({ totalStock: 10 }), item({ totalStock: 11 }), item({ totalStock: 0 })];
    expect(filter(items, { statusFilter: 'low_stock' }).length).toBe(1);
    expect(filter(items, { statusFilter: 'out_of_stock' }).length).toBe(1);
    expect(filter(items, { statusFilter: 'active' }).length).toBe(3);
  });

  it('visibility hidden means visibleInOnlineStore === false', () => {
    const items = [
      item(),
      item({ isPublished: false }),
      item({ visibleInOnlineStore: false }),
    ];
    expect(filter(items, { visibilityFilter: 'hidden' }).map((p) => p._id)).toEqual(['sp-3']);
    expect(filter(items, { visibilityFilter: 'draft' }).map((p) => p._id)).toEqual(['sp-2']);
    expect(filter(items, { visibilityFilter: 'published' }).length).toBe(2);
  });
});

// ── Quick filters (SP panel) ──────────────────────────────────────────────────

describe('quick filters', () => {
  const items = [
    item({ totalSold: 5 }),
    item({ isFeaturedByTenant: true }),
    item({ totalStock: 3 }),
    item({ totalStock: 0 }),
    item({ status: 'archived' }),
  ];

  it('featured / best_seller / on_sale / new_arrival flags', () => {
    expect(filter(items, { quickFilters: ['featured'] }).length).toBe(1);
    expect(filter(items, { quickFilters: ['best_seller'] }).length).toBe(0);
    expect(filter(items, { quickFilters: ['has_sales'] }).length).toBe(1);
    expect(filter(items, { quickFilters: ['no_sales'] }).length).toBe(4);
  });

  it('needs_reorder falls back to reorder point 5', () => {
    expect(filter(items, { quickFilters: ['needs_reorder'] }).map((p) => p._id)).toEqual([
      'sp-3',
      'sp-4',
    ]);
  });

  it('needs_reorder honours per-product reorderPoint', () => {
    const withPoint = [
      item({ totalStock: 20, reorderPoint: 25 }),
      item({ totalStock: 20, reorderPoint: 5 }),
    ];
    expect(filter(withPoint, { quickFilters: ['needs_reorder'] }).length).toBe(1);
  });

  it('archived includes discontinued', () => {
    expect(filter([...items, item({ status: 'discontinued' })], { quickFilters: ['archived'] }).length).toBe(2);
  });
});

// ── Advanced filters — previously silent no-ops ───────────────────────────────

describe('advanced filters that previously did nothing', () => {
  it('marginRange filters on gross margin %', () => {
    const items = [
      item({ baseSellingPrice: 200, costPrice: 100 }), // 50%
      item({ baseSellingPrice: 150, costPrice: 100 }), // ~33%
      item({ baseSellingPrice: 110, costPrice: 100 }), // ~9%
    ];
    const out = filter(items, { advancedFilters: af({ marginRange: [30, 60] }) });
    expect(out.map((p) => p._id)).toEqual(['sp-1', 'sp-2']);
  });

  it('visibility facet applies OR semantics across published/draft/hidden', () => {
    const items = [item(), item({ isPublished: false }), item({ visibleInOnlineStore: false })];
    const out = filter(items, { advancedFilters: af({ visibility: ['draft', 'hidden'] }) });
    expect(out.map((p) => p._id)).toEqual(['sp-2', 'sp-3']);
  });

  it('seasons match any selected season flag', () => {
    const items = [
      item({ seasonality: { summer: true } }),
      item({ seasonality: { winter: true } }),
      item(),
    ];
    const out = filter(items, { advancedFilters: af({ seasons: ['summer', 'spring'] }) });
    expect(out.map((p) => p._id)).toEqual(['sp-1']);
  });

  it('occasions intersect specialOccasions', () => {
    const items = [
      item({ specialOccasions: ['christmas', 'wedding'] }),
      item({ specialOccasions: ['birthday'] }),
      item(),
    ];
    const out = filter(items, { advancedFilters: af({ occasions: ['christmas', 'birthday'] }) });
    expect(out.length).toBe(2);
  });

  it('viewsRange and conversionRange filter performance metrics', () => {
    const items = [
      item({ viewCount: 500, conversionRate: 4.5 }),
      item({ viewCount: 50, conversionRate: 0.4 }),
    ];
    expect(filter(items, { advancedFilters: af({ viewsRange: [100, 0] }) }).length).toBe(1);
    expect(filter(items, { advancedFilters: af({ conversionRange: [1, 0] }) }).length).toBe(1);
  });

  it('lastSoldRange respects from and end-of-day to', () => {
    const items = [
      item({ lastSoldDate: '2026-03-10T12:00:00Z' }),
      item({ lastSoldDate: '2026-03-05T09:00:00Z' }),
      item(),
    ];
    const out = filter(items, {
      advancedFilters: af({
        lastSoldRange: { from: '2026-03-05', to: '2026-03-10' },
      }),
    });
    expect(out.map((p) => p._id)).toEqual(['sp-1', 'sp-2']);
  });

  it('lastRestockRange filters on lastRestockDate', () => {
    const items = [item({ lastRestockDate: '2026-06-01T00:00:00Z' }), item()];
    const out = filter(items, {
      advancedFilters: af({ lastRestockRange: { from: '2026-05-01', to: '' } }),
    });
    expect(out.length).toBe(1);
  });

  it('hasDiscount treats isOnSale as the discount signal', () => {
    const items = [item({ isOnSale: true }), item()];
    expect(filter(items, { advancedFilters: af({ hasDiscount: true }) }).length).toBe(1);
    expect(filter(items, { advancedFilters: af({ hasDiscount: false }) }).length).toBe(1);
  });

  it('dateRange on createdAt stays inclusive of the "to" day', () => {
    const items = [
      item({ createdAt: '2026-02-20T23:59:59Z' }),
      item({ createdAt: '2026-02-21T00:00:01Z' }),
    ];
    const out = filter(items, {
      advancedFilters: af({ dateRange: { from: '', to: '2026-02-20' } }),
    });
    expect(out.length).toBe(1);
  });
});

// ── Regression: filters that already worked ───────────────────────────────────

describe('existing advanced filters keep working', () => {
  it('abv / volume / price / stock ranges', () => {
    const items = [
      item({ baseSellingPrice: 5000, totalStock: 30, product: { _id: '1', name: 'A', slug: 'a', abv: 40, volumeMl: 750 } }),
      item({ baseSellingPrice: 800, totalStock: 2, product: { _id: '2', name: 'B', slug: 'b', abv: 0, volumeMl: 330 } }),
    ];
    expect(filter(items, { advancedFilters: af({ abvRange: [35, 0] }) }).length).toBe(1);
    expect(filter(items, { advancedFilters: af({ volumeRange: [0, 500] }) }).length).toBe(1);
    expect(filter(items, { advancedFilters: af({ priceRange: [1000, 0] }) }).length).toBe(1);
    expect(filter(items, { advancedFilters: af({ stockRange: [0, 10] }) }).length).toBe(1);
  });

  it('stockStatus multi-select including pre_order', () => {
    const items = [
      item({ totalStock: 50 }),
      item({ totalStock: 5 }),
      item({ totalStock: 0 }),
      item({ totalStock: 99, stockStatus: 'pre_order' }),
    ];
    const out = filter(items, {
      advancedFilters: af({ stockStatus: ['out_of_stock', 'pre_order'] }),
    });
    expect(out.length).toBe(2);
  });

  it('beverage types substring-match the product type', () => {
    const items = [
      item({ product: { _id: '1', name: 'A', slug: 'a', type: 'red_wine' } }),
      item({ product: { _id: '2', name: 'B', slug: 'b', type: 'lager' } }),
    ];
    expect(filter(items, { advancedFilters: af({ beverageTypes: ['wine'] }) }).length).toBe(1);
  });

  it('origin countries compare upper-cased codes', () => {
    const items = [
      item({ product: { _id: '1', name: 'A', slug: 'a', originCountry: 'fr' } }),
      item({ product: { _id: '2', name: 'B', slug: 'b', originCountry: 'NG' } }),
    ];
    expect(filter(items, { advancedFilters: af({ originCountries: ['FR'] }) }).length).toBe(1);
  });

  it('channel toggles treat missing values as visible', () => {
    const items = [item({ visibleInPOS: false }), item()];
    expect(filter(items, { advancedFilters: af({ visibleInPOS: true }) }).length).toBe(1);
    expect(filter(items, { advancedFilters: af({ visibleInPOS: false }) }).length).toBe(1);
  });
});

// ── Custom match callback ─────────────────────────────────────────────────────

describe('custom rules hook', () => {
  it('applies the caller-supplied predicate', () => {
    const items = [item(), item()];
    const out = filter(items, { customMatch: (p) => p.sku === 'SKU-2' });
    expect(out.map((p) => p._id)).toEqual(['sp-2']);
  });
});

// ── Sorting ───────────────────────────────────────────────────────────────────

describe('sortSubProducts', () => {
  // Built per-test so the shared seq counter yields stable ids.
  const makeItems = () => [
    item({ createdAt: '2026-01-01T00:00:00Z', totalStock: 5, totalSold: 1, baseSellingPrice: 300 }),
    item({ createdAt: '2026-03-01T00:00:00Z', totalStock: 9, totalSold: 9, baseSellingPrice: 100 }),
    item({ createdAt: '2026-02-01T00:00:00Z', totalStock: 7, totalSold: 5, baseSellingPrice: 200 }),
  ];

  it('does not mutate the input array', () => {
    const items = makeItems();
    const copy = [...items];
    sortSubProducts(items, 'price_desc');
    expect(items).toEqual(copy);
  });

  it('sorts by date both ways', () => {
    const items = makeItems();
    const idsFor = (sort: GridSortKey) =>
      sortSubProducts(items, sort).map((p) => p._id);
    expect(idsFor('newest')).toEqual(['sp-2', 'sp-3', 'sp-1']);
    expect(idsFor('oldest')).toEqual(['sp-1', 'sp-3', 'sp-2']);
  });

  it('sorts by price using variant price when present', () => {
    const variantItems = [
      item({ baseSellingPrice: 300, sizes: [{ _id: 's1', size: '75cl', sellingPrice: 900 }] }),
      item({ baseSellingPrice: 300, sizes: [{ _id: 's2', size: '75cl', sellingPrice: 100 }] }),
    ];
    expect(sortSubProducts(variantItems, 'price_asc').map((p) => p._id)).toEqual(['sp-2', 'sp-1']);
  });

  it('sorts by stock, sales and name', () => {
    const items = makeItems();
    const idsFor = (sort: GridSortKey) =>
      sortSubProducts(items, sort).map((p) => p._id);
    expect(idsFor('stock_desc')).toEqual(['sp-2', 'sp-3', 'sp-1']);
    expect(idsFor('best_selling')).toEqual(['sp-2', 'sp-3', 'sp-1']);
    expect(idsFor('name_desc')).toEqual(['sp-3', 'sp-2', 'sp-1']);
  });
});

// ── Grouping ──────────────────────────────────────────────────────────────────

describe('groupSubProducts', () => {
  it('buckets by stock level with sorted keys', () => {
    const items = [
      item({ totalStock: 0 }),
      item({ totalStock: 5 }),
      item({ totalStock: 100 }),
    ];
    const groups = groupSubProducts(items, 'stock_level');
    expect(groups.map(([k]) => k)).toEqual(['In stock', 'Low stock', 'Out of stock']);
    expect(groups[1][1].length).toBe(1);
  });

  it('groups by brand with fallback label', () => {
    const groups = groupSubProducts([item()], 'brand');
    expect(groups[0][0]).toBe('No brand');
  });
});

// ── Stats & helpers ───────────────────────────────────────────────────────────

describe('computeStats', () => {
  it('derives published/draft from the fetched catalog', () => {
    // Third item keeps the factory default isPublished: true.
    const all = [item({ isPublished: true }), item({ isPublished: false }), item({ totalStock: 0 })];
    const stats = computeStats(all, null);
    expect(stats).toEqual({
      total: 3,
      active: 3,
      lowStock: 0,
      outOfStock: 1,
      published: 2,
      draft: 1,
    });
  });

  it('merges server stats with derived publish counts', () => {
    const all = [item({ isPublished: true }), item({ isPublished: false })];
    const stats = computeStats(all, { total: 2, active: 2, lowStock: 0, outOfStock: 0 });
    expect(stats.published).toBe(1);
    expect(stats.draft).toBe(1);
    expect(stats.total).toBe(2);
  });
});

describe('activeFilterCount', () => {
  it('counts each non-empty facet once', () => {
    let count = activeFilterCount(initialFilters);
    expect(count).toBe(0);

    count = activeFilterCount(
      af({
        status: ['active'],
        onSale: false,
        priceRange: [0, 500],
        dateRange: { from: '2026-01-01', to: '' },
      })
    );
    expect(count).toBe(4);
  });
});

describe('helpers', () => {
  it('marginPercentage handles zero price', () => {
    expect(marginPercentage(200, 100)).toBe(50);
    expect(marginPercentage(0, 100)).toBe(0);
  });

  it('currencySymbol maps known codes and passes unknown through', () => {
    expect(currencySymbol('NGN')).toBe('₦');
    expect(currencySymbol('USD')).toBe('$');
    expect(currencySymbol('XYZ')).toBe('XYZ');
    expect(currencySymbol(undefined)).toBe('');
  });
});
