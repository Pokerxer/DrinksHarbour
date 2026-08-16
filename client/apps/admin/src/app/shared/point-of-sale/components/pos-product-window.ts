// The two pure steps between "every POS-visible product" and "the cards on
// screen": search/filter, then window.
//
// They are pure, and here rather than inline in the grid, because the bug they
// exist to prevent is invisible in a rendered screenshot: a search that comes
// back empty looks exactly like a product that does not exist. See
// pos-product-window.test.ts.

/** The shape the search reads. Structurally satisfied by POSProduct. */
export interface SearchableProduct {
  sku?: string;
  product?: {
    name?: string;
    type?: string;
    brand?: { name?: string } | null;
  } | null;
  sizes?: { displayName?: string; sku?: string; barcode?: string }[];
}

/**
 * How many product cards to mount before asking the cashier to load more.
 *
 * The grid used to receive at most 200 products, so it could mount every one
 * of them. It now receives the whole catalogue — 955 for the tenant this was
 * found on — and POSProductCard is neither memoised nor virtualised, so every
 * card re-renders on every cart change. A window keeps the till responsive
 * without narrowing what a search can reach.
 */
export const PRODUCT_RENDER_STEP = 60;

/**
 * The in-memory search the POS runs instead of a round trip — it has to work
 * with no network. Matches a product's name, its SKU, its brand, and each
 * size's name, SKU and barcode.
 */
export function filterPOSProducts<T extends SearchableProduct>(
  list: T[],
  { category, query }: { category?: string; query?: string }
): T[] {
  let out = list;

  if (category) out = out.filter((p) => p.product?.type === category);

  const q = (query ?? '').trim().toLowerCase();
  if (!q) return out;

  return out.filter(
    (p) =>
      p.product?.name?.toLowerCase().includes(q) ||
      p.sku?.toLowerCase().includes(q) ||
      p.product?.brand?.name?.toLowerCase().includes(q) ||
      p.sizes?.some(
        (s) =>
          s.displayName?.toLowerCase().includes(q) ||
          s.sku?.toLowerCase().includes(q) ||
          s.barcode?.toLowerCase().includes(q)
      )
  );
}

/**
 * The slice of an ALREADY-FILTERED list to mount, plus how many are held back.
 * Apply this after `filterPOSProducts`, never before: windowing first would
 * hide search results, which is the bug the server-side 200-row cap caused.
 */
export function productRenderWindow<T>(
  filtered: T[],
  shown: number
): { visible: T[]; remaining: number } {
  if (filtered.length <= shown) return { visible: filtered, remaining: 0 };
  return { visible: filtered.slice(0, shown), remaining: filtered.length - shown };
}
