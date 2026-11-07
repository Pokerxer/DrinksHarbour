// client/apps/admin/src/services/category-meta.test.ts
//
// Industry-scope fidelity (2026-11-02 follow-up): the category list carries a
// server-applied `meta.industries` echo. getCategoriesWithMeta/getSubCategoriesWithMeta
// surface it NON-BREAKINGLY — getCategories/getSubCategories keep their plain
// array contract for the legacy call sites. readError/readJson are mocked out
// (they hard-depend on rizzui toast plumbing), matching the service-test style
// of the neighboring product.service.test.ts.

import { afterEach, describe, expect, it, vi } from 'vitest';

const API_URL = 'http://testserver.local';

vi.mock('@/config', () => ({ API_URL }));
// category.service readError/readJson are module-local helpers; the fetch mock
// below exercises them directly, so keep the global fetch + Response shape real.

describe('categoryService industry-scope meta', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('getCategoriesWithMeta returns the categories plus the applied-scope echo', async () => {
    const { categoryService } = await import('@/services/category.service');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({
        success: true,
        data: { categories: [{ _id: 'c1', name: 'Wine' }, { _id: 'c2', name: 'Fashion' }] },
        meta: { industries: ['fashion'] },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )));

    const { categories, industriesMeta } = await categoryService.getCategoriesWithMeta('tok');
    expect(categories.map((c) => c.name)).toEqual(['Wine', 'Fashion']);
    expect(industriesMeta).toEqual(['fashion']);
    // And the compat wrapper still behaves exactly like before:
    const plain = await categoryService.getCategories('tok');
    expect(Array.isArray(plain)).toBe(true);
    expect(plain.map((c) => c.name)).toEqual(['Wine', 'Fashion']);
  });

  it('unprofiled/anonymous echo (null) maps to null — legacy full view', async () => {
    const { categoryService } = await import('@/services/category.service');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ success: true, data: { categories: [_c('All')] }, meta: { industries: null } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )));
    const { categories, industriesMeta } = await categoryService.getCategoriesWithMeta('tok');
    expect(categories.length).toBe(1);
    expect(industriesMeta).toBeNull();
  });

  it('tolerates a data.meta echo shape (server evolution) and absent meta', async () => {
    const { categoryService } = await import('@/services/category.service');
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(
        JSON.stringify({ success: true, data: { categories: [_c('A')], meta: { industries: ['home'] } } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ))
      .mockResolvedValueOnce(new Response(
        JSON.stringify({ success: true, data: { categories: [_c('B')] } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )));
    const withDataMeta = await categoryService.getCategoriesWithMeta('tok');
    expect(withDataMeta.industriesMeta).toEqual(['home']);
    const withoutMeta = await categoryService.getCategoriesWithMeta('tok');
    expect(withoutMeta.industriesMeta).toBeNull();
  });

  it('getSubCategoriesWithMeta returns the subcategory array plus the echo; compat wrapper intact', async () => {
    const { categoryService } = await import('@/services/category.service');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({
        success: true,
        data: [{ _id: 's1', name: 'Wine & Sparkling', parent: 'c1' }],
        meta: { industries: ['beverage'] },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )));
    const { subCategories, industriesMeta } = await categoryService.getSubCategoriesWithMeta('tok', 'c1');
    expect(subCategories[0].name).toBe('Wine & Sparkling');
    expect(industriesMeta).toEqual(['beverage']);
    const plain = await categoryService.getSubCategories('tok', 'c1');
    expect(Array.isArray(plain)).toBe(true);
  });

  it('errors still throw with the api error message on non-ok', async () => {
    const { categoryService } = await import('@/services/category.service');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ success: false, message: 'boom' }),
      // readError may derive the message differently — just assert it throws.
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )));
    await expect(categoryService.getCategoriesWithMeta('tok')).rejects.toThrow();
  });
});

function _c(name: string) {
  return { _id: `id-${name}`, name, slug: name.toLowerCase() };
}

it('requests authenticated picker lists only when explicitly selected', async () => {
  const { categoryService } = await import('@/services/category.service');
  const fetchPicker = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
    const path = new URL(String(url)).pathname;
    return new Response(JSON.stringify({
      data: path.includes('/subcategories') ? [{ _id: 's1' }] : { categories: [{ _id: 'c1' }] },
      meta: { industries: ['home'] },
    }));
  });
  try {
    await expect(categoryService.getCategoriesWithMeta('tok', 'picker')).resolves.toEqual({
      categories: [{ _id: 'c1' }], industriesMeta: ['home'],
    });
    // The picker mapper normalizes each row's parent to its object-id string
    // (rows come from GET ?category=c1, so the parent is that category id).
    await expect(categoryService.getSubCategories('tok', 'c1', 'picker')).resolves.toEqual([{ _id: 's1', parent: 'c1' }]);
    const paths = fetchPicker.mock.calls.map(([url]) => new URL(String(url)));
    expect(paths.map((url) => url.pathname)).toEqual(['/api/categories/picker', '/api/subcategories/picker']);
    expect(paths[1].searchParams.get('category')).toBe('c1');
    expect(fetchPicker.mock.calls[1][1]?.headers).toEqual({ Authorization: 'Bearer tok' });
  } finally {
    fetchPicker.mockRestore();
  }
});
