import { afterEach, expect, it, vi } from 'vitest';
import { listServings, listProduction } from './costing';
import { getIngredientProfiles, getIngredientCandidates } from './ingredients';
import { getReceiptSources } from './receipt-valuation';
afterEach(() => vi.unstubAllGlobals());
it.each([
  ['servings', listServings], ['production', listProduction],
  ['ingredient-profiles', getIngredientProfiles], ['ingredient-candidates', getIngredientCandidates],
])('loads every %s page rather than silently presenting a truncated catalogue', async (path, list) => {
  vi.stubGlobal('fetch', vi.fn(async (input: string) => {
    const url = new URL(input);
    expect(url.pathname).toBe(`/api/venue-ops/locations/location/${path}`);
    return new Response(JSON.stringify({ data: url.searchParams.get('cursor') === 'next-page'
      ? { items: [{ id: 'older' }], nextCursor: null }
      : { items: [{ id: 'first' }], nextCursor: 'next-page' } }));
  }));
  expect((await list('owner', 'location')).items.map(row => row.id)).toEqual(['first', 'older']);
});
it('loads independent lot and receipt histories without duplicating a finished bucket', async () => {
  vi.stubGlobal('fetch', vi.fn(async (input: string) => {
    const page = new URL(input).searchParams;
    return new Response(JSON.stringify({ data: {
      lots: page.get('lotsCursor') ? [{ id: 'older-lot' }] : [{ id: 'first-lot' }],
      receipts: page.get('receiptsCursor') === 'last-receipt' ? [{ id: 'oldest-receipt' }]
        : page.get('receiptsCursor') ? [{ id: 'older-receipt' }] : [{ id: 'first-receipt' }],
      nextLotsCursor: page.get('lotsCursor') ? null : 'lot-page',
      nextReceiptsCursor: page.get('receiptsCursor') === 'last-receipt' ? null
        : page.get('receiptsCursor') ? 'last-receipt' : 'receipt-page',
    } }));
  }));
  const result = await getReceiptSources('owner', 'location');
  expect(result.lots.map(row => row.id)).toEqual(['first-lot', 'older-lot']);
  expect(result.receipts.map(row => row.id)).toEqual(['first-receipt', 'older-receipt', 'oldest-receipt']);
});
it('refuses a repeated catalogue cursor instead of silently duplicating rows forever', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
    data: { items: [{ id: 'first' }], nextCursor: 'repeated' },
  }))));
  await expect(listServings('owner', 'location')).rejects.toThrow(/cursor|page/i);
});
