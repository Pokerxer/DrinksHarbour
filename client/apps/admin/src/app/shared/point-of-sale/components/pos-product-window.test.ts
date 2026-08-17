// Searching, and then mounting, a whole POS catalogue.
//
// The sell screen fetches every POS-visible product once and then does all
// filtering, searching and category selection in memory — it has to, because an
// installed POS must keep selling with no network. Two consequences, one of
// which was a live bug:
//
//   1. Whatever the grid is NOT sent, it cannot find. The server used to cap
//      the catalogue at 200 rows, so a cashier typing the name of a product
//      that sorts 600th got "No results" — indistinguishable from the product
//      not existing. The server no longer caps at 200; these tests hold the
//      client end of that contract, which is that the search runs over the
//      WHOLE array it was handed.
//   2. The grid mounts a card per product, unmemoised, so it cannot mount a
//      thousand of them and stay responsive. Hence a render window — and the
//      window must be applied AFTER the search, or it re-creates exactly the
//      bug it was added alongside: a match at position 900 clipped away by a
//      cap of 60.
import { describe, it, expect } from 'vitest';
import {
  filterPOSProducts,
  productRenderWindow,
  PRODUCT_RENDER_STEP,
} from './pos-product-window';

type Row = ReturnType<typeof row>;

function row(i: number) {
  return {
    _id: `id-${i}`,
    sku: `SKU-${String(i).padStart(4, '0')}`,
    product: {
      _id: `p-${i}`,
      name: `Product ${i}`,
      type: i % 2 === 0 ? 'spirits' : 'wine',
      brand: { _id: 'b1', name: `Brand ${i % 7}` },
    },
    sizes: [{ displayName: `75cl`, sku: `SZ-${i}`, barcode: `500000000${i}` }],
  };
}

const catalogue = (n: number): Row[] =>
  Array.from({ length: n }, (_, i) => row(i));

describe('filterPOSProducts', () => {
  it('finds a product that sits far past the old 200-row cap', () => {
    const list = catalogue(955);

    const found = filterPOSProducts(list, { query: 'Product 903' });

    expect(found.map((p) => p.sku)).toEqual(['SKU-0903']);
  });

  it('matches on sku, brand, size name and size barcode, not just the name', () => {
    const list = catalogue(955);

    expect(filterPOSProducts(list, { query: 'sku-0900' })).toHaveLength(1);
    expect(filterPOSProducts(list, { query: '5000000009' })[0].sku).toBe(
      'SKU-0009'
    );
    expect(filterPOSProducts(list, { query: '75cl' })).toHaveLength(955);
    expect(
      filterPOSProducts(list, { query: 'Brand 3' }).length
    ).toBeGreaterThan(100);
  });

  it('narrows by category and search together', () => {
    const list = catalogue(100);

    const wines = filterPOSProducts(list, { category: 'wine' });
    expect(wines).toHaveLength(50);
    // 41 is odd, so it is wine — the same query under the other category is a
    // real "no results", not a truncated one.
    expect(
      filterPOSProducts(list, { category: 'wine', query: 'Product 41' })
    ).toHaveLength(1);
    expect(
      filterPOSProducts(list, { category: 'spirits', query: 'Product 41' })
    ).toHaveLength(0);
  });

  it('leaves the list alone when nothing is being searched for', () => {
    const list = catalogue(955);
    // Whitespace is not a query — trimming to nothing must not empty the grid.
    expect(filterPOSProducts(list, { query: '   ' })).toBe(list);
    expect(filterPOSProducts(list, {})).toBe(list);
  });
});

describe('productRenderWindow', () => {
  it('mounts a slice of a big catalogue and reports what is still hidden', () => {
    const { visible, remaining } = productRenderWindow(
      catalogue(955),
      PRODUCT_RENDER_STEP
    );

    expect(visible).toHaveLength(PRODUCT_RENDER_STEP);
    expect(remaining).toBe(955 - PRODUCT_RENDER_STEP);
  });

  it('never hides a search result, because the window comes after the search', () => {
    // The one property that keeps the render window from re-creating the bug
    // the server-side cap caused: the cashier searches the catalogue, and the
    // window is applied to what the search returned.
    const hit = filterPOSProducts(catalogue(955), { query: 'Product 903' });

    const { visible, remaining } = productRenderWindow(
      hit,
      PRODUCT_RENDER_STEP
    );

    expect(visible.map((p) => p.sku)).toEqual(['SKU-0903']);
    expect(remaining).toBe(0);
  });

  it('reports nothing remaining once the window covers the list', () => {
    const list = catalogue(40);
    const { visible, remaining } = productRenderWindow(
      list,
      PRODUCT_RENDER_STEP
    );

    expect(visible).toBe(list); // no needless copy, so React sees a stable array
    expect(remaining).toBe(0);
  });
});
