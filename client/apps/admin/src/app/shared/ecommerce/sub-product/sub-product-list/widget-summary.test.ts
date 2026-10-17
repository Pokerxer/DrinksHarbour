import { expect, it } from 'vitest';
import { filterSubProducts, type SubProductListItem } from './filtering';
import { nextWidgetFilter, summarizeWidgets } from './widget-summary';

const items = [
  {
    _id: 'one',
    sku: 'GIN-1',
    totalStock: 12,
    lowStockThreshold: 15,
    status: 'active',
    isPublished: true,
    createdAt: '2026-10-01',
  },
  {
    _id: 'two',
    sku: 'GIN-2',
    totalStock: 0,
    status: 'draft',
    isPublished: true,
    createdAt: '2026-09-12',
  },
  {
    _id: 'three',
    sku: 'WINE-1',
    totalStock: 3,
    status: 'active',
    isPublished: false,
    createdAt: '2026-10-01',
  },
  {
    _id: 'future',
    sku: 'GIN-3',
    totalStock: 20,
    status: 'active',
    isPublished: true,
    createdAt: '2026-12-01',
  },
] as SubProductListItem[];

it('each widget count equals the rows it selects within the current search and visibility', () => {
  const filters = {
    searchQuery: 'GIN',
    visibilityFilter: 'published',
    statusFilter: 'active',
  };
  const summary = summarizeWidgets(items, filters, Date.parse('2026-10-11'));
  expect(summary.stats).toMatchObject({
    total: 3,
    active: 2,
    lowStock: 1,
    outOfStock: 1,
  });
  for (const [filter, count] of [
    ['', 3],
    ['active', 2],
    ['low_stock', 1],
    ['out_of_stock', 1],
  ] as const) {
    expect(
      filterSubProducts(items, { ...filters, statusFilter: filter }).length
    ).toBe(count);
  }
  expect(summary.trends).toEqual([2, 1, 1, 1]);
});

it('toggling a selected widget clears its status while another widget switches directly', () => {
  expect(nextWidgetFilter('active', 'active')).toBe('');
  expect(nextWidgetFilter('active', 'low_stock')).toBe('low_stock');
  expect(nextWidgetFilter('low_stock', '')).toBe('');
});
