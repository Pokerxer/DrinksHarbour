import { describe, expect, it } from 'vitest';
import {
  applyAvailabilityFromStock,
  buildCustomerPricelistHtml,
  buildPricelistCsv,
  catalogFacets,
  dedupeRowsForPricelist,
  effectivePriceForRow,
  resolveCatalogLines,
  type CatalogProduct,
  type PricelistPrintOptions,
  type PricelistPrintRow,
} from './inventory-pricelist-print';

const row = (over: Partial<PricelistPrintRow> = {}): PricelistPrintRow => ({
  productName: 'Hennessy VS',
  sku: 'HN-VS-70',
  sizeName: '70cl',
  categoryName: 'Cognac',
  sellingPrice: 10000,
  costPrice: 7000,
  subProductId: 'sp1',
  sizeId: 'sz1',
  currentQuantity: 4,
  ...over,
});

const opts = (over: Partial<PricelistPrintOptions> = {}): PricelistPrintOptions => ({
  title: 'Price List',
  groupByCategory: true,
  showSku: true,
  showAvailability: false,
  ...over,
});

describe('effectivePriceForRow', () => {
  it('returns retail price unchanged without a pricelist', () => {
    const r = effectivePriceForRow(row(), null);
    expect(r.price).toBe(10000);
    expect(r.changed).toBe(false);
    expect(r.was).toBeNull();
  });

  it('applies a fixed-price rule', () => {
    const pl = { _id: 'p', name: 'X', rules: [{ priceType: 'fixed', fixedPrice: 9500 }] };
    const r = effectivePriceForRow(row(), pl as never);
    expect(r.price).toBe(9500);
    expect(r.changed).toBe(true);
    expect(r.was).toBe(10000);
  });

  it('applies a percentage discount rule', () => {
    const pl = {
      _id: 'p',
      name: 'X',
      rules: [{ priceType: 'discount', discountType: 'percentage', discountPercentage: 10 }],
    };
    expect(effectivePriceForRow(row(), pl as never).price).toBe(9000);
  });

  it('applies a fixed-amount discount without going negative', () => {
    const pl = {
      _id: 'p',
      name: 'X',
      rules: [{ priceType: 'discount', discountType: 'fixed', discountAmount: 12000 }],
    };
    expect(effectivePriceForRow(row(), pl as never).price).toBe(0);
  });

  it('formula rule prices from the line cost basis', () => {
    const pl = {
      _id: 'p',
      name: 'X',
      rules: [{ priceType: 'formula', markupPercentage: 25 }],
    };
    // 7000 × 1.25 = 8750
    expect(effectivePriceForRow(row(), pl as never).price).toBe(8750);
  });

  it('ignores expired rules', () => {
    const pl = {
      _id: 'p',
      name: 'X',
      rules: [
        {
          priceType: 'discount',
          discountType: 'percentage',
          discountPercentage: 50,
          endDate: '2000-01-01T00:00:00Z',
        },
      ],
    };
    expect(effectivePriceForRow(row(), pl as never).price).toBe(10000);
  });

  it('product-specific rules shadow all-products rules', () => {
    const pl = {
      _id: 'p',
      name: 'X',
      rules: [
        {
          priceType: 'discount',
          discountType: 'percentage',
          discountPercentage: 5,
        },
        {
          priceType: 'fixed',
          fixedPrice: 8000,
          subProduct: 'sp1',
        },
      ],
    };
    expect(effectivePriceForRow(row(), pl as never).price).toBe(8000);
  });

  it('stacks rules sequentially (fixed then volume discount)', () => {
    const pl = {
      _id: 'p',
      name: 'X',
      rules: [
        { priceType: 'fixed', fixedPrice: 10000 },
        { priceType: 'discount', discountType: 'percentage', discountPercentage: 10, minQuantity: 6 },
      ],
    };
    // qty=1 tier → minQuantity 6 not eligible at qty 1 matching, but our print
    // matches at qty 1 so the tier does not apply.
    expect(effectivePriceForRow(row(), pl as never).price).toBe(10000);
  });

  it('applies an ad-hoc discount on retail when no pricelist is chosen', () => {
    const r = effectivePriceForRow(row(), null, 10);
    expect(r.price).toBe(9000);
    expect(r.changed).toBe(true);
    expect(r.was).toBe(10000);
  });

  it('stacks ad-hoc discount after pricelist rules', () => {
    const pl = {
      _id: 'p',
      name: 'X',
      rules: [{ priceType: 'discount', discountType: 'percentage', discountPercentage: 10 }],
    };
    // 10000 → −10% pl → 9000 → −10% trade → 8100
    expect(effectivePriceForRow(row(), pl as never, 10).price).toBe(8100);
  });

  it('ignores out-of-range ad-hoc discounts', () => {
    expect(effectivePriceForRow(row(), null, 150).price).toBe(0);
    expect(effectivePriceForRow(row(), null, -5).price).toBe(10000);
  });
});

describe('dedupeRowsForPricelist', () => {
  it('collapses warehouse duplicates by subProduct+size and sums availability', () => {
    const a = row({ currentQuantity: 4 });
    const b = row({ subProductId: 'sp1', sizeId: 'sz1', currentQuantity: 6, sku: 'HN-VS-70' });
    const c = row({ subProductId: 'sp2', sizeId: 'sz1', productName: 'Other' });
    const out = dedupeRowsForPricelist([a, b, c]);
    expect(out).toHaveLength(2);
    const merged = out.find((r) => r.subProductId === 'sp1');
    expect(merged?.currentQuantity).toBe(10);
    expect(out.find((r) => r.subProductId === 'sp2')?.productName).toBe('Other');
  });

  it('keeps the highest non-zero selling price when merging', () => {
    const a = row({ sellingPrice: 0 });
    const b = row({ sellingPrice: 10500 });
    const out = dedupeRowsForPricelist([a, b]);
    expect(out[0].sellingPrice).toBe(10500);
  });
});

describe('buildCustomerPricelistHtml', () => {
  it('escapes hostile product names', () => {
    const html = buildCustomerPricelistHtml(
      [row({ productName: '<script>alert("x")</script>' })],
      null,
      opts()
    );
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('shows strikethrough was-price only when a pricelist changes the price', () => {
    const promo = {
      _id: 'p',
      name: 'Promo',
      rules: [{ priceType: 'discount', discountType: 'percentage', discountPercentage: 10 }],
    };
    const withPl = buildCustomerPricelistHtml([row()], promo as never, opts());
    expect(withPl).toContain('<span class="was">');
    expect(withPl).toContain('Promo');

    const withoutPl = buildCustomerPricelistHtml([row()], null, opts());
    expect(withoutPl).not.toContain('<span class="was">');
  });

  it('groups by category when enabled and lists flat otherwise', () => {
    const rowsA = [
      row({ categoryName: 'Cognac' }),
      row({ subProductId: 'sp2', sizeId: 's2', productName: 'B', categoryName: 'Beer' }),
    ];
    const grouped = buildCustomerPricelistHtml(rowsA, null, opts({ groupByCategory: true }));
    expect(grouped).toContain('Cognac');
    expect(grouped).toContain('Beer');

    const flat = buildCustomerPricelistHtml(rowsA, null, opts({ groupByCategory: false }));
    expect(flat).not.toContain('<h2'); // no category headings in flat mode
  });

  it('omits availability column unless requested', () => {
    const withAvail = buildCustomerPricelistHtml([row()], null, opts({ showAvailability: true }));
    const withoutAvail = buildCustomerPricelistHtml([row()], null, opts());
    expect(withAvail).toContain('Available');
    expect(withoutAvail).not.toContain('>Available<');
  });

  it('renders the business name on the letterhead when provided', () => {
    const html = buildCustomerPricelistHtml(
      [row()],
      null,
      opts({ businessName: 'Cork & Barrel Wines <Abuja>' })
    );
    expect(html).toContain('class="business"');
    expect(html).toContain('Cork &amp; Barrel Wines &lt;Abuja&gt;');
  });

  it('notes the trade discount in the footer when set', () => {
    const html = buildCustomerPricelistHtml([row()], null, opts({ discountPercent: 10 }));
    expect(html).toContain('incl. 10% trade discount');
  });
});

describe('buildPricelistCsv', () => {
  it('exports priced lines with currency and was-price only when changed', () => {
    const promo = {
      _id: 'p',
      name: 'Promo',
      rules: [{ priceType: 'discount', discountType: 'percentage', discountPercentage: 10 }],
    };
    const csv = buildPricelistCsv([row()], promo as never, opts({ showAvailability: true }));
    const lines = csv.split('\n');
    expect(lines[0]).toContain('Unit Price,Was Price,Currency');
    expect(lines[1]).toContain(',4,9000.00,10000.00,NGN');
  });

  it('guards formula-injection in product names', () => {
    const csv = buildPricelistCsv(
      [row({ productName: '=HYPERLINK("http://evil")' })],
      null,
      opts()
    );
    expect(csv).toContain("'=HYPERLINK");
  });
});

// ── Scope resolution ──────────────────────────────────────────────────────────

const catalog: CatalogProduct[] = [
  {
    _id: 'sp1',
    name: 'Hennessy VS',
    sku: 'HN-VS',
    brand: { name: 'Hennessy' },
    category: 'Cognac',
    subCategory: 'VS',
    baseSellingPrice: 10000,
    costPrice: 7000,
    sizes: [
      { _id: 'sz70', sizeName: '70cl', sellingPrice: 10000, costPrice: 7000 },
      { _id: 'sz35', displayName: '35cl', sellingPrice: 5500, costPrice: 3600 },
    ],
  },
  {
    _id: 'sp2',
    productName: 'Guinness Foreign Extra',
    sku: 'GFX',
    brand: 'Guinness',
    category: { name: 'Beer' },
    subCategory: '',
    baseSellingPrice: 1200,
    costPrice: 800,
  },
  {
    _id: 'sp3',
    productName: 'Barefoot Pinot',
    sku: 'BF-PN',
    brand: 'Barefoot',
    category: 'Wine',
    subCategory: 'Red',
    baseSellingPrice: 4200,
    costPrice: 2600,
  },
];

describe('catalogFacets', () => {
  it('counts products per facet, normalising string/object shapes', () => {
    const f = catalogFacets(catalog);
    expect(f.categories.get('Cognac')).toBe(1);
    expect(f.categories.get('Beer')).toBe(1);
    expect(f.brands.get('Hennessy')).toBe(1);
    expect(f.subCategories.get('Uncategorized')).toBe(1); // Guinness has ''
  });
});

describe('resolveCatalogLines', () => {
  it('returns nothing for an empty scope', () => {
    expect(
      resolveCatalogLines(
        catalog,
        { categories: [], subCategories: [], brands: [], productIds: [] }
      )
    ).toHaveLength(0);
  });

  it('expands sized products to one line per size', () => {
    const lines = resolveCatalogLines(catalog, {
      categories: [],
      subCategories: [],
      brands: ['Hennessy'],
      productIds: [],
    });
    // Sorted by size name within the product
    expect(lines.map((l) => l.sizeId)).toEqual(['sz35', 'sz70']);
    expect(lines[1].sellingPrice).toBe(10000);
    expect(lines[0].sizeName).toBe('35cl');
  });

  it('reads facets and display name from the nested product object', () => {
    const nested: CatalogProduct[] = [
      {
        _id: 'sp9',
        sku: 'WYN-1',
        // Real API shape: flat fields absent, everything under `product`
        product: {
          name: 'Monte do Barao Vinho Branco',
          category: { _id: 'c1', name: 'White Wine' },
          subCategory: null,
          brand: null,
        },
        baseSellingPrice: 9500,
        costPrice: 6000,
      },
    ];
    const f = catalogFacets(nested);
    expect(f.categories.get('White Wine')).toBe(1);

    const lines = resolveCatalogLines(nested, {
      categories: ['White Wine'],
      subCategories: [],
      brands: [],
      productIds: [],
    });
    expect(lines).toHaveLength(1);
    expect(lines[0].productName).toBe('Monte do Barao Vinho Branco');
    expect(lines[0].categoryName).toBe('White Wine');
    expect(lines[0].sellingPrice).toBe(9500);
  });

  it('unions selections across facets', () => {
    const lines = resolveCatalogLines(catalog, {
      categories: ['Wine'],
      subCategories: [],
      brands: ['Guinness'],
      productIds: [],
    });
    const names = new Set(lines.map((l) => l.productName));
    expect(names).toEqual(
      new Set(['Barefoot Pinot', 'Guinness Foreign Extra'])
    );
  });

  it('includes explicit product ids', () => {
    const lines = resolveCatalogLines(catalog, {
      categories: [],
      subCategories: [],
      brands: [],
      productIds: ['sp1'],
    });
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.every((l) => l.subProductId === 'sp1')).toBe(true);
  });

  it('uses baseSellingPrice for no-size products and prices via the engine', () => {
    const [line] = resolveCatalogLines(catalog, {
      categories: ['Beer'],
      subCategories: [],
      brands: [],
      productIds: [],
    });
    expect(line.sellingPrice).toBe(1200);
    const priced = effectivePriceForRow(line, null, 10);
    expect(priced.price).toBe(1080);
  });
});

describe('applyAvailabilityFromStock', () => {
  it('joins stock quantities by subProduct+size', () => {
    const lines = resolveCatalogLines(catalog, {
      categories: [],
      subCategories: [],
      brands: ['Hennessy'],
      productIds: [],
    });
    const stock = [
      {
        subProductId: 'sp1',
        sizeId: 'sz70',
        currentQuantity: 4,
      },
      {
        subProductId: 'sp1',
        sizeId: 'sz70',
        currentQuantity: 6,
      },
    ] as never;
    const out = applyAvailabilityFromStock(lines, stock);
    expect(out.find((l) => l.sizeId === 'sz70')?.currentQuantity).toBe(10);
    // Unmatched line untouched (0)
    expect(out.find((l) => l.sizeId === 'sz35')?.currentQuantity).toBe(0);
  });
});
