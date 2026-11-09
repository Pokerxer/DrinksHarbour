// app/shared/purchases/purchases-catalog-data.test.ts
// The purchase catalogue reuses the sales catalogue endpoint (search, filters,
// facets, pagination) but prices by COST — a purchase order is what we pay.
// The loader must not request the sales pricing engine, and the selections it
// hands to the form must carry the cost price of the picked size.
import { describe, expect, it, vi } from 'vitest';
import {
  loadPurchaseCataloguePage,
  purchaseSizelessSelection,
  purchaseSizeSelection,
} from './purchases-catalog-data';

const fetchMock = (payload: unknown) =>
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 })));

describe('loadPurchaseCataloguePage', () => {
  it('hits the catalogue view without the sales pricing engine', async () => {
    const payload = {
      success: true,
      data: {
        subProducts: [],
        pagination: { page: 1, total: 0, pages: 0, hasNext: false, hasPrev: false },
      },
    };
    fetchMock(payload);
    await loadPurchaseCataloguePage({
      token: 'tok',
      query: 'wine',
      filters: { categories: [], brands: [], types: [], inStock: false, sort: 'name' },
      page: 1,
      facets: true,
      warehouseId: 'wh-1',
      // Args the sales loader needs but the purchase loader must ignore:
      pricelistId: 'pl-1',
      quantities: { 'x|': 2 },
      signal: new AbortController().signal,
    });
    const url = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    const params = new URL(url).searchParams;
    expect(params.get('view')).toBe('catalogue');
    expect(params.get('search')).toBe('wine');
    expect(params.get('warehouseId')).toBe('wh-1');
    expect(params.get('pricing')).toBeNull();
    expect(params.get('pricelistId')).toBeNull();
    expect(params.get('quantities')).toBeNull();
  });

  it('surfaces the API error message', async () => {
    fetchMock({ success: false, message: 'Nope' });
    await expect(
      loadPurchaseCataloguePage({
        token: 'tok',
        query: '',
        filters: { categories: [], brands: [], types: [], inStock: false, sort: 'name' },
        page: 1,
        facets: false,
        signal: new AbortController().signal,
      }),
    ).rejects.toThrow('Nope');
  });
});

describe('purchase selections', () => {
  const product = {
    _id: 'sp-1',
    productId: 'p-1',
    name: 'Hennessy XO',
    sku: 'HN-XO',
    costPrice: 5000,
    taxRate: 0,
    sellWithoutSizeVariants: false,
    sizes: [
      { size: 'sz-350', displayName: '350ml', sku: 'HN-XO-350', sellingPrice: 1200, costPrice: 900, unitsPerPack: 12, availableStock: 7 },
    ],
  } as Parameters<typeof purchaseSizelessSelection>[0];

  it('sizeless selection carries the cost price', () => {
    const sel = purchaseSizelessSelection(product);
    expect(sel).toMatchObject({
      subProductId: 'sp-1',
      name: 'Hennessy XO',
      sku: 'HN-XO',
      costPrice: 5000,
      sellingPrice: 5000,
    });
  });

  it('sized selection carries the size identity and units per pack', () => {
    const sel = purchaseSizeSelection(product, product.sizes[0]);
    expect(sel).toMatchObject({
      subProductId: 'sp-1',
      sizeId: 'sz-350',
      sizeName: '350ml',
      sku: 'HN-XO-350',
      costPrice: 900,
      unitsPerPack: 12,
    });
  });
});
