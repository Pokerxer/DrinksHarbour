import { describe, expect, it } from 'vitest';
import {
  applyAvailabilityFromStock,
  buildCustomerPricelistHtml,
  buildPricelistCsv,
  catalogFacets,
  dedupeRowsForPricelist,
  effectivePriceForRow,
  explainPricelistCoverage,
  hasBundleRules,
  linesHaveBundlePrices,
  priceAndSortLines,
  pricelistRuleCount,
  resolveBundlePriceForRow,
  resolveCatalogLines,
  rulesInPriorityOrder,
  resolvePricelistOrigin,
  type CatalogProduct,
  type PricelistLite,
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
  wholesalePrice: 0,
  unitsPerPack: 1,
  subProductId: 'sp1',
  sizeId: 'sz1',
  currentQuantity: 4,
  ...over,
});

const opts = (
  over: Partial<PricelistPrintOptions> = {}
): PricelistPrintOptions => ({
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
    const pl = {
      _id: 'p',
      name: 'X',
      rules: [{ priceType: 'fixed', fixedPrice: 9500 }],
    };
    const r = effectivePriceForRow(row(), pl as never);
    expect(r.price).toBe(9500);
    expect(r.changed).toBe(true);
    expect(r.was).toBe(10000);
  });

  it('applies a percentage discount rule', () => {
    const pl = {
      _id: 'p',
      name: 'X',
      rules: [
        {
          priceType: 'discount',
          discountType: 'percentage',
          discountPercentage: 10,
        },
      ],
    };
    expect(effectivePriceForRow(row(), pl as never).price).toBe(9000);
  });

  it('applies a fixed-amount discount without going negative', () => {
    const pl = {
      _id: 'p',
      name: 'X',
      rules: [
        { priceType: 'discount', discountType: 'fixed', discountAmount: 12000 },
      ],
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
        {
          priceType: 'discount',
          discountType: 'percentage',
          discountPercentage: 10,
          minQuantity: 6,
        },
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
      rules: [
        {
          priceType: 'discount',
          discountType: 'percentage',
          discountPercentage: 10,
        },
      ],
    };
    // 10000 → −10% pl → 9000 → −10% trade → 8100
    expect(effectivePriceForRow(row(), pl as never, 10).price).toBe(8100);
  });

  it('ignores out-of-range ad-hoc discounts', () => {
    expect(effectivePriceForRow(row(), null, 150).price).toBe(0);
    expect(effectivePriceForRow(row(), null, -5).price).toBe(10000);
  });

  it('formula rule with markupBase=wholesale prices from wholesalePrice', () => {
    const pl = {
      _id: 'p',
      name: 'X',
      rules: [
        { priceType: 'formula', markupPercentage: 20, markupBase: 'wholesale' },
      ],
    };
    // wholesale 6000 × 1.20 = 7200
    expect(
      effectivePriceForRow(row({ wholesalePrice: 6000 }), pl as never).price
    ).toBe(7200);
  });

  it('formula rule with markupBase=wholesale falls back to retail when wholesalePrice is 0', () => {
    const pl = {
      _id: 'p',
      name: 'X',
      rules: [
        { priceType: 'formula', markupPercentage: 20, markupBase: 'wholesale' },
      ],
    };
    // no wholesale price present → rule no-ops, retail price unchanged
    expect(
      effectivePriceForRow(row({ wholesalePrice: 0 }), pl as never).price
    ).toBe(10000);
  });

  it('formula rule with markupBase=cost (default) still prices from costPrice', () => {
    const pl = {
      _id: 'p',
      name: 'X',
      rules: [{ priceType: 'formula', markupPercentage: 25 }],
    };
    // 7000 × 1.25 = 8750 (unaffected by wholesalePrice presence)
    expect(
      effectivePriceForRow(
        row({ wholesalePrice: 6000, costPrice: 7000 }),
        pl as never
      ).price
    ).toBe(8750);
  });

  it('matches product-specific rules whose subProduct is a populated object (GET /pricelists/:id shape)', () => {
    // The pricelist-manager GET returns each rule with `subProduct` populated
    // as `{ _id, sku, product }`. The pricing engine must still match it to
    // the line's subProductId like it does for bare ObjectId rules.
    const pl = {
      _id: 'p',
      name: 'Populated',
      rules: [
        {
          priceType: 'discount',
          discountType: 'percentage',
          discountPercentage: 10,
          subProduct: {
            _id: 'sp1',
            sku: 'HN-VS-70',
            product: { _id: 'pr1', name: 'Hennessy VS' },
          },
        },
        // A different product's rule must not leak onto this line.
        { priceType: 'fixed', fixedPrice: 8500, subProduct: 'sp2' },
      ],
    };
    expect(effectivePriceForRow(row(), pl as never).price).toBe(9000);
  });
});

describe('pricelistRuleCount', () => {
  it('counts inline rules when the payload carries them', () => {
    expect(
      pricelistRuleCount({
        _id: 'p',
        name: 'Promo',
        rules: [{}, {}],
      } as PricelistLite)
    ).toBe(2);
  });

  it('prefers the server-side ruleCount when rules are stripped from the list payload', () => {
    expect(
      pricelistRuleCount({
        _id: 'p',
        name: 'Promo',
        ruleCount: 3,
      } as PricelistLite)
    ).toBe(3);
  });

  it('falls back to zero for stale list rows that carry neither', () => {
    expect(
      pricelistRuleCount({ _id: 'p', name: 'Promo' } as PricelistLite)
    ).toBe(0);
  });
});

describe('dedupeRowsForPricelist', () => {
  it('collapses warehouse duplicates by subProduct+size and sums availability', () => {
    const a = row({ currentQuantity: 4 });
    const b = row({
      subProductId: 'sp1',
      sizeId: 'sz1',
      currentQuantity: 6,
      sku: 'HN-VS-70',
    });
    const c = row({ subProductId: 'sp2', sizeId: 'sz1', productName: 'Other' });
    const out = dedupeRowsForPricelist([a, b, c]);
    expect(out).toHaveLength(2);
    const merged = out.find((r) => r.subProductId === 'sp1');
    expect(merged?.currentQuantity).toBe(10);
    expect(out.find((r) => r.subProductId === 'sp2')?.productName).toBe(
      'Other'
    );
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
      rules: [
        {
          priceType: 'discount',
          discountType: 'percentage',
          discountPercentage: 10,
        },
      ],
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
      row({
        subProductId: 'sp2',
        sizeId: 's2',
        productName: 'B',
        categoryName: 'Beer',
      }),
    ];
    const grouped = buildCustomerPricelistHtml(
      rowsA,
      null,
      opts({ groupByCategory: true })
    );
    expect(grouped).toContain('Cognac');
    expect(grouped).toContain('Beer');

    const flat = buildCustomerPricelistHtml(
      rowsA,
      null,
      opts({ groupByCategory: false })
    );
    expect(flat).not.toContain('<h2'); // no category headings in flat mode
  });

  it('omits availability column unless requested', () => {
    const withAvail = buildCustomerPricelistHtml(
      [row()],
      null,
      opts({ showAvailability: true })
    );
    const withoutAvail = buildCustomerPricelistHtml([row()], null, opts());
    expect(withAvail).toContain('Available');
    expect(withoutAvail).not.toContain('>Available<');
  });

  it('renders zero availability as a quiet dash, stock as a plain count', () => {
    const out = buildCustomerPricelistHtml(
      [
        row({ currentQuantity: 0 }),
        row({ subProductId: 'sp2', sizeId: 's2', currentQuantity: 7 }),
      ],
      null,
      opts({ showAvailability: true })
    );
    expect(out).toContain('class="num zero"');
    expect(out).not.toContain('<td class="num">0</td>');
    expect(out).toContain('<td class="num">7</td>');
  });

  it('promotes the issuer to the letterhead hero, preferring the business name', () => {
    const html = buildCustomerPricelistHtml(
      [row()],
      null,
      opts({
        businessName: 'Cork & Barrel Wines <Abuja>',
        originName: 'Main Cellar',
      })
    );
    expect(html).toContain('class="issuer"');
    expect(html).toContain('Cork &amp; Barrel Wines &lt;Abuja&gt;');
  });

  it("prints the issuing warehouse's own contact under the issuer", () => {
    const html = buildCustomerPricelistHtml(
      [row()],
      null,
      opts({
        originName: 'Cloud Bay Wyn City Enterprise Limited',
        originWarehouseCount: 1,
        originHead: {
          address: '9 Close C Sungold Estate, Galadimawa',
          city: 'Abuja, FCT, Nigeria',
          email: 'info@wyncity.ng',
        },
      })
    );
    expect(html).toContain('class="issuer-contact"');
    expect(html).toContain('9 Close C Sungold Estate, Galadimawa');
    expect(html).toContain('Abuja, FCT, Nigeria');
    expect(html).toContain('info@wyncity.ng');
    // The platform address must not appear anywhere on a warehouse sheet.
    expect(html).not.toContain('accounts@drinksharbour.com');
  });

  it('joins email and phone into one contact segment and escapes the head', () => {
    const html = buildCustomerPricelistHtml(
      [row()],
      null,
      opts({
        originHead: {
          address: '1 Rue <b>Foo</b> & Co',
          email: 'a@b.ng',
          phone: '+2348127783605',
        },
      })
    );
    expect(html).toContain('a@b.ng · +2348127783605');
    expect(html).toContain('1 Rue &lt;b&gt;Foo&lt;/b&gt; &amp; Co');
  });

  it('omits the contact band entirely when no head resolved', () => {
    const html = buildCustomerPricelistHtml(
      [row()],
      null,
      opts({ originName: 'Main Cellar', originWarehouseCount: 1 })
    );
    expect(html).not.toContain('class="issuer-contact"');
  });

  it('notes the trade discount in the footer when set', () => {
    const html = buildCustomerPricelistHtml(
      [row()],
      null,
      opts({ discountPercent: 10 })
    );
    expect(html).toContain('incl. 10% trade discount');
  });

  it('renders the resolved origin on the masthead and escapes it', () => {
    const html = buildCustomerPricelistHtml(
      [row()],
      null,
      opts({
        businessName: 'Acme',
        originName: '<b>Main Cellar</b> & Co',
        originWarehouseCount: 1,
      })
    );
    expect(html).toContain('class="stamp"');
    expect(html).toContain('&lt;b&gt;Main Cellar&lt;/b&gt; &amp; Co');
  });

  it('omits the provenance stamp when no distinct origin resolved', () => {
    const html = buildCustomerPricelistHtml([row()], null, opts());
    expect(html).not.toContain('class="stamp"');
  });

  it('falls back to the resolved origin as the hero issuer', () => {
    const html = buildCustomerPricelistHtml(
      [row()],
      null,
      opts({ originName: 'Main Cellar' })
    );
    expect(html).toContain('class="issuer"');
    expect(html).toContain('>Main Cellar</p>');
    // Issuer already names the warehouse — no duplicate stamp
    expect(html).not.toContain('class="stamp"');
  });

  it('stamps warehouse count when lines span multiple warehouses', () => {
    const counted = buildCustomerPricelistHtml(
      [row()],
      null,
      opts({
        businessName: 'Acme Wines',
        originName: 'Acme Wines',
        originWarehouseCount: 3,
      })
    );
    expect(counted).toContain('3 warehouses');
  });

  it('summarises the document in a labelled meta strip', () => {
    const html = buildCustomerPricelistHtml(
      [row(), row({ subProductId: 'sp9', sizeId: 's9', categoryName: 'Beer' })],
      null,
      opts({ validUntil: '2026-09-30' })
    );
    expect(html).toContain('class="meta-label"');
    expect(html).toContain('>Items<');
    expect(html).toContain('>Categories<');
    expect(html).toContain('>Valid until<');
    expect(html).toContain('30 Sep 2026');
    expect(html).toContain('2 categories');
  });
});

describe('resolvePricelistOrigin', () => {
  it('returns the warehouse name when every line shares one warehouse', () => {
    const rows = [
      { warehouseName: 'Main Cellar' },
      { warehouseName: 'Main Cellar' },
    ];
    expect(resolvePricelistOrigin(rows, 'Acme Wines')).toEqual({
      name: 'Main Cellar',
      warehouseCount: 1,
    });
  });

  it('falls back to the tenant name when lines span multiple warehouses', () => {
    const rows = [
      { warehouseName: 'Main Cellar' },
      { warehouseName: 'Wuse Annex' },
      { warehouseName: 'Main Cellar' },
    ];
    expect(resolvePricelistOrigin(rows, 'Acme Wines')).toEqual({
      name: 'Acme Wines',
      warehouseCount: 2,
    });
  });

  it('uses the tenant name for catalogue lines that carry no warehouse', () => {
    expect(resolvePricelistOrigin([{}, {}], 'Acme Wines')).toEqual({
      name: 'Acme Wines',
      warehouseCount: 0,
    });
  });

  it('returns no name when neither warehouse nor tenant is known', () => {
    expect(resolvePricelistOrigin([{ warehouseName: '' }], undefined)).toEqual({
      name: undefined,
      warehouseCount: 0,
    });
  });

  it('ignores blank or whitespace-only warehouse labels', () => {
    const rows = [{ warehouseName: '  ' }, { warehouseName: 'Main Cellar' }];
    expect(resolvePricelistOrigin(rows, 'Acme')).toEqual({
      name: 'Main Cellar',
      warehouseCount: 1,
    });
  });

  it('trims surrounding whitespace from names', () => {
    expect(resolvePricelistOrigin([{ warehouseName: ' Wuse ' }]).name).toBe(
      'Wuse'
    );
    expect(resolvePricelistOrigin([], '  Acme  ').name).toBe('Acme');
  });
});

describe('resolvePricelistOrigin — issuing warehouse letterhead', () => {
  const cloudBay = {
    name: 'Cloud Bay Wyn City Enterprise Limited',
    address: {
      line1: '9 Close C Sungold Estate, Galadimawa',
      line2: '',
      city: 'Abuja',
      state: 'FCT',
      country: 'Nigeria',
      postalCode: '930271',
    },
    contact: { name: '', phone: '', email: 'info@wyncity.ng' },
  };
  const lagos = {
    name: 'Warehouse Lagos',
    address: { city: '', state: 'Lagos', country: 'Nigeria' },
    contact: { phone: '+2347035609301', email: 'jrwaldehzx@gmail.com' },
  };

  it("carries the single warehouse's own address and contact", () => {
    const origin = resolvePricelistOrigin(
      [{ warehouseName: 'Cloud Bay Wyn City Enterprise Limited' }],
      'Wyn City',
      [cloudBay, lagos]
    );
    expect(origin.name).toBe('Cloud Bay Wyn City Enterprise Limited');
    expect(origin.warehouseCount).toBe(1);
    expect(origin.head).toEqual({
      address: '9 Close C Sungold Estate, Galadimawa',
      city: 'Abuja, FCT, Nigeria',
      email: 'info@wyncity.ng',
      phone: undefined,
    });
  });

  it('matches the denormalised row label case-insensitively', () => {
    const origin = resolvePricelistOrigin(
      [{ warehouseName: '  cloud bay wyn city ENTERPRISE limited ' }],
      'Wyn City',
      [cloudBay]
    );
    expect(origin.head?.email).toBe('info@wyncity.ng');
  });

  it('claims no head when the lines span more than one warehouse', () => {
    const origin = resolvePricelistOrigin(
      [
        { warehouseName: 'Cloud Bay Wyn City Enterprise Limited' },
        { warehouseName: 'Warehouse Lagos' },
      ],
      'Wyn City',
      [cloudBay, lagos]
    );
    expect(origin).toEqual({ name: 'Wyn City', warehouseCount: 2 });
    expect(origin.head).toBeUndefined();
  });

  it('claims no head for catalogue lines that carry no warehouse', () => {
    expect(
      resolvePricelistOrigin([{}, {}], 'Wyn City', [cloudBay]).head
    ).toBeUndefined();
  });

  it('leaves the head undefined for a record with no address or contact', () => {
    const bare = { name: 'Empty Depot' };
    const origin = resolvePricelistOrigin(
      [{ warehouseName: 'Empty Depot' }],
      'Wyn City',
      [bare]
    );
    expect(origin.name).toBe('Empty Depot');
    expect(origin.head).toBeUndefined();
  });

  it('refuses to guess between two warehouses sharing a name', () => {
    const origin = resolvePricelistOrigin(
      [{ warehouseName: 'Annex' }],
      'Wyn City',
      [
        { name: 'Annex', contact: { email: 'a@x.ng' } },
        { name: 'annex', contact: { email: 'b@x.ng' } },
      ]
    );
    expect(origin.head).toBeUndefined();
  });

  it('behaves exactly as before when no directory is supplied', () => {
    expect(
      resolvePricelistOrigin([{ warehouseName: 'Cloud Bay' }], 'Wyn City')
    ).toEqual({ name: 'Cloud Bay', warehouseCount: 1 });
  });
});

describe('buildPricelistCsv', () => {
  it('exports priced lines with currency and was-price only when changed', () => {
    const promo = {
      _id: 'p',
      name: 'Promo',
      rules: [
        {
          priceType: 'discount',
          discountType: 'percentage',
          discountPercentage: 10,
        },
      ],
    };
    const csv = buildPricelistCsv(
      [row()],
      promo as never,
      opts({ showAvailability: true })
    );
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
      resolveCatalogLines(catalog, {
        categories: [],
        subCategories: [],
        brands: [],
        productIds: [],
      })
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

// ── Bundle pricing ───────────────────────────────────────────────────────────

describe('resolveBundlePriceForRow', () => {
  it('returns null when there is no pricelist', () => {
    const r = resolveBundlePriceForRow(row(), null, 10000);
    expect(r.bundlePrice).toBeNull();
    expect(r.bundleQuantity).toBeNull();
  });

  it('returns null when the pricelist has no bundle rules', () => {
    const pl = {
      _id: 'p',
      name: 'No bundles',
      rules: [{ priceType: 'discount', discountPercentage: 10 }],
    };
    const r = resolveBundlePriceForRow(row(), pl as never, 10000);
    expect(r.bundlePrice).toBeNull();
  });

  it('computes a percentage bundle price stacked on top of the per-line price', () => {
    const pl = {
      _id: 'p',
      name: 'Trade',
      rules: [
        // per-line discount: 10% off retail
        {
          priceType: 'discount',
          discountType: 'percentage',
          discountPercentage: 10,
        },
        // bundle: extra 5% off at qty 6+
        {
          priceType: 'bundle',
          bundleQuantity: 6,
          bundleDiscount: 5,
          bundleDiscountType: 'percentage',
        },
      ],
    };
    // perLinePrice=9000 (already discounted by the 10% rule)
    const r = resolveBundlePriceForRow(row(), pl as never, 9000);
    // bundle: 9000 × 0.95 = 8550
    expect(r.bundlePrice).toBe(8550);
    expect(r.bundleQuantity).toBe(6);
    expect(r.bundleLabel).toBe('6+');
  });

  it('computes a fixed bundle price stacked on top of the per-line price', () => {
    const pl = {
      _id: 'p',
      name: 'Wholesale',
      rules: [
        {
          priceType: 'bundle',
          bundleQuantity: 12,
          bundleDiscount: 500,
          bundleDiscountType: 'fixed',
        },
      ],
    };
    // perLinePrice=10000 (no per-line rules, raw retail)
    const r = resolveBundlePriceForRow(row(), pl as never, 10000);
    // bundle: 10000 − 500 = 9500
    expect(r.bundlePrice).toBe(9500);
    expect(r.bundleQuantity).toBe(12);
    expect(r.bundleLabel).toBe('12+');
  });

  it('computes a markup_on_cost bundle price from the line cost', () => {
    const pl = {
      _id: 'p',
      name: 'Cost-plus',
      rules: [
        {
          priceType: 'bundle',
          bundleQuantity: 6,
          bundleDiscount: 25,
          bundleDiscountType: 'markup_on_cost',
        },
      ],
    };
    const r = resolveBundlePriceForRow(
      row({ costPrice: 7000 }),
      pl as never,
      10000
    );
    // cost 7000 × 1.25 = 8750 → roundUpTo100 → 8800, matching the price the
    // server actually charges (applyBundleOverride rounds a markup override up).
    expect(r.bundlePrice).toBe(8800);
    expect(r.bundleQuantity).toBe(6);
  });

  it('picks by sequence, not by savings, when several rules share a pool', () => {
    const pl = {
      _id: 'p',
      name: 'Multi',
      rules: [
        {
          _id: 'b1',
          priceType: 'bundle',
          bundleQuantity: 6,
          bundleDiscount: 5,
          bundleDiscountType: 'percentage',
          sequence: 0,
        },
        {
          _id: 'b2',
          priceType: 'bundle',
          bundleQuantity: 12,
          bundleDiscount: 15,
          bundleDiscountType: 'percentage',
          sequence: 1,
        },
      ],
    };
    const r = resolveBundlePriceForRow(row(), pl as never, 10000);
    // The 15% rule saves more, but both target all products, so the tie goes to
    // the higher-priority (lower sequence) rule — savings are not a criterion.
    expect(r.bundlePrice).toBe(9500);
    expect(r.bundleQuantity).toBe(6);
  });

  it('ignores expired bundle rules', () => {
    const pl = {
      _id: 'p',
      name: 'Expired',
      rules: [
        {
          priceType: 'bundle',
          bundleQuantity: 6,
          bundleDiscount: 20,
          bundleDiscountType: 'percentage',
          endDate: '2000-01-01T00:00:00Z',
        },
      ],
    };
    const r = resolveBundlePriceForRow(row(), pl as never, 10000);
    expect(r.bundlePrice).toBeNull();
  });

  it('ignores cross-product bundle rules (bundleTargetSubProduct set)', () => {
    const pl = {
      _id: 'p',
      name: 'Cross',
      rules: [
        {
          priceType: 'bundle',
          bundleQuantity: 6,
          bundleDiscount: 10,
          bundleDiscountType: 'percentage',
          bundleTargetSubProduct: 'sp2',
        },
      ],
    };
    const r = resolveBundlePriceForRow(row(), pl as never, 10000);
    expect(r.bundlePrice).toBeNull();
  });

  it('returns null for no_discount bundles', () => {
    const pl = {
      _id: 'p',
      name: 'NoDisc',
      rules: [
        {
          priceType: 'bundle',
          bundleQuantity: 6,
          bundleDiscount: 0,
          bundleDiscountType: 'no_discount',
        },
      ],
    };
    const r = resolveBundlePriceForRow(row(), pl as never, 10000);
    expect(r.bundlePrice).toBeNull();
  });

  // ── New pricelist fields ────────────────────────────────────────────────────

  it('uses wholesalePrice as basis for markup_on_cost when bundleMarkupBase=wholesale', () => {
    const pl = {
      _id: 'p',
      name: 'Wholesale Markup',
      rules: [
        {
          priceType: 'bundle',
          bundleQuantity: 6,
          bundleDiscount: 30,
          bundleDiscountType: 'markup_on_cost',
          bundleMarkupBase: 'wholesale',
        },
      ],
    };
    const r = resolveBundlePriceForRow(
      row({ wholesalePrice: 6000 }),
      pl as never,
      10000
    );
    // wholesale 6000 × 1.30 = 7800
    expect(r.bundlePrice).toBe(7800);
    expect(r.bundleQuantity).toBe(6);
  });

  it('returns null when bundleMarkupBase=wholesale but wholesalePrice is 0 (no fallback to cost)', () => {
    const pl = {
      _id: 'p',
      name: 'No Wholesale',
      rules: [
        {
          priceType: 'bundle',
          bundleQuantity: 6,
          bundleDiscount: 30,
          bundleDiscountType: 'markup_on_cost',
          bundleMarkupBase: 'wholesale',
        },
      ],
    };
    // Server behaviour: basis=0 → savings=0 → bundle is a no-op
    const r = resolveBundlePriceForRow(
      row({ wholesalePrice: 0, costPrice: 7000 }),
      pl as never,
      10000
    );
    expect(r.bundlePrice).toBeNull();
  });

  it('uses unitsPerPack as bundle quantity when bundleUnitsMode=pack', () => {
    const pl = {
      _id: 'p',
      name: 'Pack Mode',
      rules: [
        {
          priceType: 'bundle',
          bundleQuantity: 99,
          bundleDiscount: 10,
          bundleDiscountType: 'percentage',
          bundleUnitsMode: 'pack',
        },
      ],
    };
    const r = resolveBundlePriceForRow(
      row({ unitsPerPack: 12 }),
      pl as never,
      10000
    );
    // bundleQuantity=99 is ignored; unitsPerPack=12 → 12+ label
    expect(r.bundlePrice).toBe(9000);
    expect(r.bundleQuantity).toBe(12);
    expect(r.bundleLabel).toBe('12+');
  });

  it('still accepts bundleQuantity when bundleUnitsMode is manual (default)', () => {
    const pl = {
      _id: 'p',
      name: 'Manual',
      rules: [
        {
          priceType: 'bundle',
          bundleQuantity: 6,
          bundleDiscount: 10,
          bundleDiscountType: 'percentage',
        },
      ],
    };
    const r = resolveBundlePriceForRow(
      row({ unitsPerPack: 24 }),
      pl as never,
      10000
    );
    // unitsPerPack=24 is ignored; bundleQuantity=6 → 6+ label
    expect(r.bundlePrice).toBe(9000);
    expect(r.bundleQuantity).toBe(6);
  });

  it('accepts bundleQuantity < 2 when bundleUnitsMode=pack (server skips validation)', () => {
    const pl = {
      _id: 'p',
      name: 'Pack Low Qty',
      rules: [
        {
          priceType: 'bundle',
          bundleQuantity: 1,
          bundleDiscount: 15,
          bundleDiscountType: 'percentage',
          bundleUnitsMode: 'pack',
        },
      ],
    };
    // bundleQuantity=1 would normally be filtered out (bq < 2),
    // but pack mode bypasses that check and uses unitsPerPack instead.
    const r = resolveBundlePriceForRow(
      row({ unitsPerPack: 6 }),
      pl as never,
      10000
    );
    expect(r.bundlePrice).toBe(8500);
    expect(r.bundleQuantity).toBe(6);
  });

  it('stacks both new fields: bundleMarkupBase=wholesale + bundleUnitsMode=pack', () => {
    const pl = {
      _id: 'p',
      name: 'Full Stack',
      rules: [
        {
          priceType: 'bundle',
          bundleQuantity: 99,
          bundleDiscount: 25,
          bundleDiscountType: 'markup_on_cost',
          bundleMarkupBase: 'wholesale',
          bundleUnitsMode: 'pack',
        },
      ],
    };
    const r = resolveBundlePriceForRow(
      row({ wholesalePrice: 5000, unitsPerPack: 12 }),
      pl as never,
      10000
    );
    // wholesale 5000 × 1.25 = 6250 → roundUpTo100 → 6300; qty from unitsPerPack=12
    expect(r.bundlePrice).toBe(6300);
    expect(r.bundleQuantity).toBe(12);
    expect(r.bundleLabel).toBe('12+');
  });
});

describe('hasBundleRules', () => {
  it('returns false for null or empty rules', () => {
    expect(hasBundleRules(null)).toBe(false);
    expect(hasBundleRules({ _id: 'p', rules: [] } as never)).toBe(false);
  });

  it('returns true when at least one same-product bundle rule exists', () => {
    expect(
      hasBundleRules({
        _id: 'p',
        rules: [
          {
            priceType: 'bundle',
            bundleQuantity: 6,
            bundleDiscount: 10,
            bundleDiscountType: 'percentage',
          },
        ],
      } as never)
    ).toBe(true);
  });

  it('returns false when all bundle rules are cross-product', () => {
    expect(
      hasBundleRules({
        _id: 'p',
        rules: [
          {
            priceType: 'bundle',
            bundleTargetSubProduct: 'sp2',
            bundleQuantity: 6,
            bundleDiscount: 10,
            bundleDiscountType: 'percentage',
          },
        ],
      } as never)
    ).toBe(false);
  });
});

// ── Cloud Bay integration (exact production rule shape) ──────────────────────

describe('Cloud Bay integration — discount + bundle stacked', () => {
  // Exact Cloud Bay rule structure: Rule #1 = 10% discount on all products,
  // Rule #2 = Buy 6+ → 15% bundle off all products.
  const cloudBay = {
    _id: 'cloudbay',
    name: 'Cloud Bay',
    currency: 'NGN',
    rules: [
      {
        priceType: 'discount',
        discountType: 'percentage',
        discountPercentage: 10,
        minQuantity: 0,
      },
      {
        priceType: 'bundle',
        bundleQuantity: 6,
        bundleDiscount: 15,
        bundleDiscountType: 'percentage',
        minQuantity: 0,
      },
    ],
  };

  it('effectivePriceForRow applies the 10% discount at qty=1', () => {
    const r = effectivePriceForRow(
      row({ sellingPrice: 10000, costPrice: 7000 }),
      cloudBay as never
    );
    expect(r.price).toBe(9000);
    expect(r.was).toBe(10000);
    expect(r.changed).toBe(true);
  });

  it('resolveBundlePriceForRow stacks 15% off the discounted price', () => {
    const r = resolveBundlePriceForRow(
      row({ sellingPrice: 10000, costPrice: 7000 }),
      cloudBay as never,
      9000
    );
    // 9000 × 0.85 = 7650
    expect(r.bundlePrice).toBe(7650);
    expect(r.bundleQuantity).toBe(6);
    expect(r.bundleLabel).toBe('6+');
  });

  it('priceAndSortLines produces both prices on each line', () => {
    const lines = priceAndSortLines(
      [row({ sellingPrice: 10000, costPrice: 7000 })],
      cloudBay as never
    );
    const line = lines[0];
    expect(line.price).toBe(9000); // 10000 × 0.9
    expect(line.was).toBe(10000); // original retail strikethrough
    expect(line.bundlePrice).toBe(7650); // 9000 × 0.85
    expect(line.bundleQuantity).toBe(6);
  });

  it('PDF shows both Unit Price and Bundle Price columns for Cloud Bay', () => {
    const html = buildCustomerPricelistHtml(
      [row({ sellingPrice: 10000, costPrice: 7000 })],
      cloudBay as never,
      opts({ groupByCategory: false })
    );
    expect(html).toContain('Unit Price');
    expect(html).toContain('Bundle Price');
    expect(html).toContain('9,000'); // Unit price
    expect(html).toContain('7,650'); // Bundle price
    expect(html).toContain('6+'); // Bundle label
  });

  it('CSV shows both columns for Cloud Bay', () => {
    const csv = buildPricelistCsv(
      [row({ sellingPrice: 10000, costPrice: 7000 })],
      cloudBay as never,
      opts()
    );
    const headers = csv.split('\n')[0];
    expect(headers).toContain('Unit Price');
    expect(headers).toContain('Bundle Unit Price');
    expect(headers).toContain('Bundle Qty');
    expect(headers).toContain('Bundle Total');
    const values = csv.split('\n')[1];
    expect(values).toContain('9000.00');
    expect(values).toContain('7650.00');
    expect(values).toContain(',6,');
    // 6 × 7650 — what the customer actually pays for the tier.
    expect(values).toContain('45900.00');
  });
});

describe('priceAndSortLines with bundle', () => {
  it('populates bundlePrice on each priced line', () => {
    const pl = {
      _id: 'p',
      name: 'Trade',
      rules: [
        {
          priceType: 'bundle',
          bundleQuantity: 6,
          bundleDiscount: 10,
          bundleDiscountType: 'percentage',
        },
      ],
    };
    const lines = priceAndSortLines([row()], pl as never);
    expect(lines[0].bundlePrice).toBe(9000); // 10000 × 0.9
    expect(lines[0].bundleQuantity).toBe(6);
  });

  it('leaves bundlePrice null when no bundle rules exist', () => {
    const lines = priceAndSortLines([row()], null);
    expect(lines[0].bundlePrice).toBeNull();
    expect(lines[0].bundleQuantity).toBeNull();
  });
});

// ── HTML rendering with bundle column ────────────────────────────────────────

describe('buildCustomerPricelistHtml with bundles', () => {
  it('includes the Bundle Price column header when a pricelist has bundle rules', () => {
    const pl = {
      _id: 'p',
      name: 'Trade',
      rules: [
        {
          priceType: 'bundle',
          bundleQuantity: 6,
          bundleDiscount: 10,
          bundleDiscountType: 'percentage',
        },
      ],
    };
    const html = buildCustomerPricelistHtml([row()], pl as never, opts());
    expect(html).toContain('Bundle Price');
    expect(html).toContain('6+');
  });

  it('does not include the Bundle Price column when no bundle rules', () => {
    const html = buildCustomerPricelistHtml([row()], null, opts());
    expect(html).not.toContain('Bundle Price');
  });

  it('renders the bundle price per unit in each row', () => {
    const pl = {
      _id: 'p',
      name: 'Trade',
      rules: [
        {
          priceType: 'bundle',
          bundleQuantity: 6,
          bundleDiscount: 10,
          bundleDiscountType: 'percentage',
        },
      ],
    };
    const html = buildCustomerPricelistHtml(
      [row()],
      pl as never,
      opts({ groupByCategory: false })
    );
    // 10000 × 0.9 = 9000
    expect(html).toContain('9,000');
  });
});

// ── CSV export with bundle column ────────────────────────────────────────────

describe('buildPricelistCsv with bundles', () => {
  it('includes a Bundle Price column header and values', () => {
    const pl = {
      _id: 'p',
      name: 'Trade',
      rules: [
        {
          priceType: 'bundle',
          bundleQuantity: 6,
          bundleDiscount: 10,
          bundleDiscountType: 'percentage',
        },
      ],
    };
    const csv = buildPricelistCsv([row()], pl as never, opts());
    const headers = csv.split('\n')[0];
    expect(headers).toContain('Bundle Unit Price');
    expect(headers).toContain('Bundle Qty');
    expect(headers).toContain('Bundle Total');
    // per-unit 9000.00, tier of 6, total 54000.00
    const valueRow = csv.split('\n')[1];
    expect(valueRow).toContain('9000.00');
    expect(valueRow).toContain(',6');
    expect(valueRow).toContain('54000.00');
  });

  it('omits bundle columns when no bundle rules', () => {
    const csv = buildPricelistCsv([row()], null, opts());
    const headers = csv.split('\n')[0];
    expect(headers).not.toContain('Bundle');
  });
});

// ── Parity with the server bundle engine (pricelistPricing.service) ──────────
// Each case below is a divergence the hand-rolled resolver originally had:
// a printed bundle price that the POS/checkout engine would never charge.
describe('resolveBundlePriceForRow — server parity', () => {
  const bundle = (over: Record<string, unknown> = {}) => ({
    _id: 'p',
    name: 'Trade',
    rules: [
      {
        priceType: 'bundle',
        bundleQuantity: 6,
        bundleDiscount: 10,
        bundleDiscountType: 'percentage',
        ...over,
      },
    ],
  });

  it('skips a bundle rule with no bundleQuantity — the server skips it too', () => {
    const r = resolveBundlePriceForRow(
      row({ unitsPerPack: 12 }),
      bundle({ bundleQuantity: 0, bundleUnitsMode: 'pack' }) as never,
      10000
    );
    expect(r.bundlePrice).toBeNull();
  });

  it('honours minQuantity against the bundle tier the customer buys', () => {
    // minQuantity 12 > tier 6 → the server would never award this bundle.
    const tooHigh = resolveBundlePriceForRow(
      row(),
      bundle({ minQuantity: 12 }) as never,
      10000
    );
    expect(tooHigh.bundlePrice).toBeNull();

    // minQuantity 6 <= tier 6 → qualifies.
    const ok = resolveBundlePriceForRow(
      row(),
      bundle({ minQuantity: 6 }) as never,
      10000
    );
    expect(ok.bundlePrice).toBe(9000);
  });

  it('quotes the first tier in sequence order when a pool holds several tiers', () => {
    // KNOWN LIMITATION, pinned deliberately: the derived ranking does not look
    // at `bundleQuantity`, so two all-products tiers (6+ and 12+) are separated
    // only by minQuantity then _id. The sheet therefore quotes ONE of them —
    // the first in sequence — rather than the deeper tier. See the RESUME note.
    const pl = {
      _id: 'p',
      name: 'Trade',
      rules: [
        {
          _id: 'b1',
          priceType: 'bundle',
          bundleQuantity: 6,
          bundleDiscount: 10,
          bundleDiscountType: 'percentage',
          sequence: 0,
        },
        {
          _id: 'b2',
          priceType: 'bundle',
          bundleQuantity: 12,
          bundleDiscount: 8,
          bundleDiscountType: 'percentage',
          sequence: 1,
        },
      ],
    };
    const r = resolveBundlePriceForRow(row(), pl as never, 10000);
    expect(r.bundleQuantity).toBe(6);
    expect(r.bundlePrice).toBe(9000);
  });

  it('rounds a markup_on_cost bundle UP to the nearest 100, as the server does', () => {
    // 7010 * 1.10 = 7711 -> roundUpTo100 -> 7800. Quoting 7711 would undercut
    // the price the customer is actually charged at checkout.
    const r = resolveBundlePriceForRow(
      row({ costPrice: 7010 }),
      bundle({
        bundleDiscountType: 'markup_on_cost',
        bundleDiscount: 10,
      }) as never,
      10000
    );
    expect(r.bundlePrice).toBe(7800);
  });

  it('quotes nothing for markup_on_cost with no basis — the server leaves price alone', () => {
    const r = resolveBundlePriceForRow(
      row({ costPrice: 0, wholesalePrice: 0 }),
      bundle({
        bundleDiscountType: 'markup_on_cost',
        bundleDiscount: 10,
      }) as never,
      10000
    );
    expect(r.bundlePrice).toBeNull();
  });

  it('ignores a bundle rule scoped to a different product', () => {
    const r = resolveBundlePriceForRow(
      row({ subProductId: 'sp1' }),
      bundle({ subProduct: { _id: 'other' } }) as never,
      10000
    );
    expect(r.bundlePrice).toBeNull();
  });

  it('lets a product-specific bundle shadow an all-products one that saves MORE', () => {
    // The headline of this behaviour: a rule aimed at this one product is the
    // more considered instruction, so it wins outright — even though the
    // all-products rule would hand the customer a bigger discount. Bundles now
    // shadow exactly as per-line price rules always have.
    const pl = {
      _id: 'p',
      name: 'Trade',
      rules: [
        {
          _id: 'b1',
          priceType: 'bundle',
          bundleQuantity: 6,
          bundleDiscount: 5,
          bundleDiscountType: 'percentage',
          subProduct: 'sp1',
          sequence: 0,
        },
        {
          _id: 'b2',
          priceType: 'bundle',
          bundleQuantity: 6,
          bundleDiscount: 20,
          bundleDiscountType: 'percentage',
          sequence: 1,
        },
      ],
    };
    const r = resolveBundlePriceForRow(
      row({ subProductId: 'sp1' }),
      pl as never,
      10000
    );
    // 5% product-specific wins over 20% all-products.
    expect(r.bundlePrice).toBe(9500);
  });

  it('falls back to the all-products pool when the specific rule does not qualify', () => {
    // A product-specific tier the customer cannot reach must not shadow an
    // all-products tier they can — otherwise a narrow rule silently deletes a
    // bundle the customer had earned.
    const pl = {
      _id: 'p',
      name: 'Trade',
      rules: [
        {
          _id: 'b1',
          priceType: 'bundle',
          bundleQuantity: 6,
          bundleDiscount: 0,
          bundleDiscountType: 'percentage',
          subProduct: 'sp1',
          sequence: 0,
        },
        {
          _id: 'b2',
          priceType: 'bundle',
          bundleQuantity: 6,
          bundleDiscount: 20,
          bundleDiscountType: 'percentage',
          sequence: 1,
        },
      ],
    };
    const r = resolveBundlePriceForRow(
      row({ subProductId: 'sp1' }),
      pl as never,
      10000
    );
    expect(r.bundlePrice).toBe(8000);
  });

  it('drops a zero-discount bundle rule', () => {
    const r = resolveBundlePriceForRow(
      row(),
      bundle({ bundleDiscount: 0 }) as never,
      10000
    );
    expect(r.bundlePrice).toBeNull();
  });
});

describe('linesHaveBundlePrices', () => {
  it('gates the column on resolved prices, not merely on rule presence', () => {
    // A pack-mode rule the rows can never qualify for (no pack size) must not
    // leave an all-dashes Bundle column on the sheet.
    const pl = {
      _id: 'p',
      name: 'Trade',
      rules: [
        {
          priceType: 'bundle',
          bundleQuantity: 1,
          bundleUnitsMode: 'pack',
          bundleDiscount: 10,
          bundleDiscountType: 'percentage',
        },
      ],
    };
    const noPack = priceAndSortLines([row({ unitsPerPack: 1 })], pl as never);
    expect(linesHaveBundlePrices(noPack)).toBe(false);

    const withPack = priceAndSortLines([row({ unitsPerPack: 6 })], pl as never);
    expect(linesHaveBundlePrices(withPack)).toBe(true);
    expect(withPack[0].bundleQuantity).toBe(6);
  });
});

// The two rules exactly as stored on the live "Cloud Bay Pricelist"
// (6a94b35a4290a55aefa02dc6) on 2026-08-31. Both price off the WHOLESALE
// basis, which only 38 of that tenant's 1017 stock lines carry.
const CLOUD_BAY_RULES = [
  {
    appliedOn: 'All products',
    priceType: 'formula',
    markupPercentage: 20,
    markupBase: 'wholesale',
    bundleName: 'Buy 2+ · 0% off',
    bundleQuantity: 2,
    bundleDiscount: 0,
    minQuantity: 0,
    sequence: 0,
  },
  {
    appliedOn: 'All products',
    priceType: 'bundle',
    bundleName: 'Buy 6+ · 15% off',
    bundleQuantity: 2,
    bundleDiscount: 15,
    bundleDiscountType: 'markup_on_cost',
    bundleMarkupBase: 'wholesale',
    bundleUnitsMode: 'pack',
    markupBase: 'cost',
    minQuantity: 0,
    sequence: 1,
  },
];

describe('explainPricelistCoverage — the Cloud Bay report', () => {
  const cloudBay = {
    _id: '6a94b35a4290a55aefa02dc6',
    name: 'Cloud Bay Pricelist',
    rules: CLOUD_BAY_RULES,
  } as unknown as PricelistLite;

  it('reports both rules inert when no line carries a wholesale price', () => {
    // 979 of 1017 live lines look exactly like this: pack size, no wholesale.
    const lines = priceAndSortLines(
      [
        row({
          subProductId: 'a',
          sizeId: 's1',
          wholesalePrice: 0,
          unitsPerPack: 6,
        }),
        row({
          subProductId: 'b',
          sizeId: 's2',
          wholesalePrice: 0,
          unitsPerPack: 6,
        }),
      ],
      cloudBay
    );

    // The engine is right to leave these at retail — the server does the same.
    expect(lines.every((l) => l.changed === false)).toBe(true);
    expect(linesHaveBundlePrices(lines)).toBe(false);

    const cov = explainPricelistCoverage(lines, cloudBay);
    expect(cov.lines).toBe(2);
    expect(cov.repriced).toBe(0);
    expect(cov.bundled).toBe(0);
    // Both rules are named, and both blame the missing wholesale price.
    expect(cov.inert).toHaveLength(2);
    // The formula rule is labelled by type: its "Buy 2+ · 0% off" bundleName is
    // a vestige of the shared rule form, not the name of a bundle.
    expect(cov.inert.map((i) => i.label)).toEqual([
      'Formula rule',
      'Buy 6+ · 15% off',
    ]);
    for (const i of cov.inert) expect(i.reason).toMatch(/wholesale price/);
  });

  it('reports nothing inert when the lines do carry a wholesale price', () => {
    // WYN48B-POLI16E4-FC0S1R: retail 40000, wholesale 27200, pack 6 — verified
    // against the real server engine (unit 32640, bundle 31300).
    const lines = priceAndSortLines(
      [row({ sellingPrice: 40000, wholesalePrice: 27200, unitsPerPack: 6 })],
      cloudBay
    );
    expect(lines[0].price).toBe(32640);
    expect(lines[0].bundlePrice).toBe(31300);

    const cov = explainPricelistCoverage(lines, cloudBay);
    expect(cov.repriced).toBe(1);
    expect(cov.bundled).toBe(1);
    expect(cov.inert).toEqual([]);
  });

  it('calls out the gap when only some lines have a wholesale price', () => {
    const lines = priceAndSortLines(
      [
        row({
          subProductId: 'a',
          sizeId: 's1',
          sellingPrice: 40000,
          wholesalePrice: 27200,
          unitsPerPack: 6,
        }),
        row({
          subProductId: 'b',
          sizeId: 's2',
          wholesalePrice: 0,
          unitsPerPack: 6,
        }),
        row({
          subProductId: 'c',
          sizeId: 's3',
          wholesalePrice: 0,
          unitsPerPack: 6,
        }),
      ],
      cloudBay
    );
    const cov = explainPricelistCoverage(lines, cloudBay);
    expect(cov.repriced).toBe(1);
    expect(cov.inert).toHaveLength(1);
    expect(cov.inert[0].label).toBe('Wholesale pricing');
    expect(cov.inert[0].reason).toBe(
      '2 of 3 lines have no wholesale price, so they print at retail'
    );
  });
});

describe('explainPricelistCoverage — other silent rules', () => {
  const cov = (rules: unknown[], r = row()) => {
    const pl = { _id: 'p', name: 'X', rules } as unknown as PricelistLite;
    return explainPricelistCoverage(priceAndSortLines([r], pl), pl);
  };

  it('is silent when there is no pricelist, no rules, or no lines', () => {
    expect(explainPricelistCoverage([], null).inert).toEqual([]);
    expect(cov([]).inert).toEqual([]);
    const pl = {
      _id: 'p',
      name: 'X',
      rules: CLOUD_BAY_RULES,
    } as unknown as PricelistLite;
    expect(explainPricelistCoverage([], pl).inert).toEqual([]);
  });

  it('does not accuse a rule that is working', () => {
    expect(cov([{ priceType: 'fixed', fixedPrice: 9500 }]).inert).toEqual([]);
  });

  it('flags a rule scoped to a product that is not on the sheet', () => {
    const out = cov([
      { priceType: 'discount', discountPercentage: 10, subProduct: 'other' },
    ]);
    expect(out.inert[0].reason).toBe(
      'targets a product that is not on this list'
    );
  });

  it('accepts a populated subProduct ref that IS on the sheet', () => {
    // GET /pricelists/:id populates rules.subProduct into an object.
    expect(
      cov([
        {
          priceType: 'discount',
          discountPercentage: 10,
          subProduct: { _id: 'sp1', sku: 'HN-VS-70' },
        },
      ]).inert
    ).toEqual([]);
  });

  it('explains that a cart-threshold rule has no unit price', () => {
    const out = cov([{ priceType: 'cart_threshold', thresholdAmount: 50000 }]);
    expect(out.inert[0].reason).toMatch(/whole cart at checkout/);
  });

  it('explains that a cross-product bundle is a cart rule', () => {
    const out = cov([
      {
        priceType: 'bundle',
        bundleQuantity: 2,
        bundleDiscount: 10,
        bundleTargetSubProduct: 'other',
      },
    ]);
    expect(out.inert[0].reason).toMatch(/different product/);
  });

  it('explains a pack-mode bundle meeting lines with no pack size', () => {
    const out = cov(
      [
        {
          priceType: 'bundle',
          bundleQuantity: 2,
          bundleDiscount: 10,
          bundleDiscountType: 'percentage',
          bundleUnitsMode: 'pack',
        },
      ],
      row({ unitsPerPack: 1 })
    );
    expect(out.inert[0].reason).toMatch(/no line on this list has a pack size/);
  });

  it('explains a volume tier that never reaches the unit price', () => {
    const out = cov([
      { priceType: 'discount', discountPercentage: 10, minQuantity: 6 },
    ]);
    expect(out.inert[0].reason).toBe(
      'only applies from 6 units, so it does not change the unit price'
    );
  });

  it('never labels a non-bundle rule with a leftover bundleName', () => {
    // The shared rule form writes bundle fields onto every rule, so the live
    // Cloud Bay formula rule carries bundleName "Buy 2+ · 0% off".
    const out = cov([CLOUD_BAY_RULES[0]]);
    expect(out.inert[0].label).toBe('Formula rule');
  });

  it('labels an unnamed rule by its type', () => {
    const out = cov([
      { priceType: 'flash_sale', flashSalePercentage: 5, minQuantity: 12 },
    ]);
    expect(out.inert[0].label).toBe('Flash sale rule');
  });
});

// ── Rule priority order ───────────────────────────────────────────────────────
//
// `sequence` is the applied order (derived server-side by
// pricelistPriority.service); the stored array order is NOT it — resequenceRules
// rewrites `sequence` and deliberately leaves the array alone. Every fixture
// below is deliberately stored in the WRONG array order so a regression that
// drops the sort fails loudly instead of passing on a lucky payload.

describe('rulesInPriorityOrder', () => {
  it('sorts ascending by sequence, not by stored array position', () => {
    const pl = {
      _id: 'p',
      name: 'X',
      rules: [
        { _id: 'b', priceType: 'discount', sequence: 2 },
        { _id: 'a', priceType: 'formula', sequence: 0 },
        { _id: 'c', priceType: 'bundle', sequence: 1 },
      ],
    } as PricelistLite;
    expect(rulesInPriorityOrder(pl).map((r) => r._id)).toEqual(['a', 'c', 'b']);
  });

  it('breaks a duplicate sequence on _id so refetches order identically', () => {
    const pl = {
      _id: 'p',
      name: 'X',
      rules: [
        { _id: 'z', priceType: 'fixed', sequence: 0 },
        { _id: 'a', priceType: 'fixed', sequence: 0 },
      ],
    } as PricelistLite;
    expect(rulesInPriorityOrder(pl).map((r) => r._id)).toEqual(['a', 'z']);
  });

  it('treats a missing sequence as 0 rather than dropping the rule', () => {
    const pl = {
      _id: 'p',
      name: 'X',
      rules: [
        { _id: 'b', priceType: 'discount', sequence: 1 },
        { _id: 'a', priceType: 'formula' },
      ],
    } as PricelistLite;
    expect(rulesInPriorityOrder(pl).map((r) => r._id)).toEqual(['a', 'b']);
  });

  it('returns [] for a null pricelist or an unhydrated one, and never mutates', () => {
    expect(rulesInPriorityOrder(null)).toEqual([]);
    expect(
      rulesInPriorityOrder({ _id: 'p', name: 'X' } as PricelistLite)
    ).toEqual([]);
    const rules = [
      { _id: 'b', priceType: 'discount', sequence: 2 },
      { _id: 'a', priceType: 'formula', sequence: 0 },
    ];
    rulesInPriorityOrder({ _id: 'p', name: 'X', rules } as PricelistLite);
    expect(rules.map((r) => r._id)).toEqual(['b', 'a']);
  });
});

describe('priority order drives the printed price', () => {
  it('stacks per-line rules by sequence even when the array arrives reversed', () => {
    // fixed (seq 0) SETS the price, the discount (seq 1) then adjusts it.
    // Read in array order the discount would run first and the fixed price
    // would discard it — 9500 instead of 8550.
    const pl = {
      _id: 'p',
      name: 'X',
      rules: [
        {
          _id: 'b',
          priceType: 'discount',
          discountType: 'percentage',
          discountPercentage: 10,
          sequence: 1,
        },
        { _id: 'a', priceType: 'fixed', fixedPrice: 9500, sequence: 0 },
      ],
    } as PricelistLite;
    expect(effectivePriceForRow(row(), pl).price).toBe(8550);
  });

  it('gives an equal-savings bundle tie to the higher-priority rule', () => {
    // Both rules save exactly 800 off a 1000 per-line price:
    //   A: qty 2 × ₦400 off = 800    B: qty 4 × ₦200 off = 800
    // The winner is decided purely by order, so this is the case where the
    // stored array order used to leak into a printed price.
    const A = {
      _id: 'a',
      priceType: 'bundle',
      bundleQuantity: 2,
      bundleDiscount: 400,
      bundleDiscountType: 'fixed',
    };
    const B = {
      _id: 'b',
      priceType: 'bundle',
      bundleQuantity: 4,
      bundleDiscount: 200,
      bundleDiscountType: 'fixed',
    };
    const pick = (aSeq: number, bSeq: number) =>
      resolveBundlePriceForRow(
        row(),
        {
          _id: 'p',
          name: 'X',
          // Stored B-first in BOTH cases: only `sequence` may decide.
          rules: [
            { ...B, sequence: bSeq },
            { ...A, sequence: aSeq },
          ],
        } as PricelistLite,
        1000
      );
    expect(pick(0, 1).bundleQuantity).toBe(2);
    expect(pick(1, 0).bundleQuantity).toBe(4);
  });

  it('lists inert-rule explanations in priority order, matching the sheet', () => {
    // A human reads this list to work out which rule did nothing and why; if it
    // enumerated in array order it would disagree with the order the sheet
    // prices in about which rule comes first.
    const pl = {
      _id: 'p',
      name: 'X',
      rules: [
        {
          _id: 'b',
          priceType: 'cart_threshold',
          thresholdAmount: 50000,
          sequence: 1,
        },
        {
          _id: 'a',
          priceType: 'discount',
          discountPercentage: 5,
          minQuantity: 6,
          sequence: 0,
        },
      ],
    } as PricelistLite;
    const lines = priceAndSortLines([row()], pl, 0);
    expect(
      explainPricelistCoverage(lines, pl).inert.map((i) => i.label)
    ).toEqual(['Discount rule', 'Cart threshold rule']);
  });
});

// ── Bundle total (what the customer actually pays for the tier) ───────────────

describe('bundleTotal', () => {
  const bundlePl = (over: Record<string, unknown> = {}) =>
    ({
      _id: 'p',
      name: 'Trade',
      rules: [
        {
          _id: 'b1',
          priceType: 'bundle',
          bundleQuantity: 6,
          bundleDiscount: 10,
          bundleDiscountType: 'percentage',
          ...over,
        },
      ],
    }) as PricelistLite;

  it('is the per-unit bundle price times the tier quantity', () => {
    const r = resolveBundlePriceForRow(row(), bundlePl(), 10000);
    expect(r.bundlePrice).toBe(9000);
    expect(r.bundleQuantity).toBe(6);
    expect(r.bundleTotal).toBe(54000);
  });

  it('uses the size pack size in pack mode, not the rule quantity', () => {
    // bundleQuantity is only the "is this rule live" flag in pack mode; the
    // tier — and therefore the total — comes from the size's unitsPerPack.
    const r = resolveBundlePriceForRow(
      row({ unitsPerPack: 12 }),
      bundlePl({ bundleUnitsMode: 'pack' }),
      10000
    );
    expect(r.bundleQuantity).toBe(12);
    expect(r.bundleTotal).toBe(108000);
  });

  it('is null when no bundle applies', () => {
    expect(resolveBundlePriceForRow(row(), null, 10000).bundleTotal).toBeNull();
  });

  it('rounds to the kobo rather than carrying float drift', () => {
    const r = resolveBundlePriceForRow(
      row({ sellingPrice: 3333.33 }),
      bundlePl({ bundleQuantity: 3 }),
      3333.33
    );
    // 3333.33 × 0.9 = 2999.997 → 3000.00 per unit → 9000 for three
    expect(r.bundleTotal).toBe(Number(r.bundleTotal?.toFixed(2)));
    expect(r.bundleTotal).toBe(9000);
  });

  it('leads the printed sheet with the total and keeps the per-unit beneath', () => {
    const html = buildCustomerPricelistHtml([row()], bundlePl(), opts());
    // Headline figure = the tier total.
    expect(html).toContain('54,000.00');
    // Sub-label carries the threshold and the per-unit price.
    expect(html).toMatch(/6\+ · [^<]*9,000\.00 each/);
  });

  it('drops the misleading per-sheet tier suffix from the column header', () => {
    // It used to read the tier off whichever line sorted first, which is wrong
    // the moment two lines carry different tiers.
    const html = buildCustomerPricelistHtml([row()], bundlePl(), opts());
    expect(html).toContain('<th class="num">Bundle Price</th>');
  });
});

describe('a bundle that costs MORE than the unit price', () => {
  // Live regression (Monte dos Perdigoes Viognier & Gouveio, Cloud Bay):
  // retail 28000, wholesale 14400, pack 6.
  //   all-products formula, wholesale +30%  -> unit 18720
  //   product-specific bundle, wholesale +50.5% -> roundUpTo100 -> 21700
  // The bundle prices ABOVE the unit price because its basis is wholesale, not
  // the retail path. A `savings <= 0` guard used to drop it BEFORE the pool
  // split, so the sheet fell through to the all-products bundle and quoted
  // 17900 — a price checkout would never charge. pickBestBundle has no such
  // guard: once a rule qualifies on quantity it is applied.
  const pl = {
    _id: 'p',
    name: 'Cloud Bay',
    rules: [
      {
        _id: 'specific',
        priceType: 'bundle',
        subProduct: 'sp1',
        bundleQuantity: 6,
        bundleUnitsMode: 'pack',
        bundleDiscountType: 'markup_on_cost',
        bundleMarkupBase: 'wholesale',
        bundleDiscount: 50.5,
        sequence: 0,
      },
      {
        _id: 'global',
        priceType: 'bundle',
        bundleQuantity: 2,
        bundleUnitsMode: 'pack',
        bundleDiscountType: 'markup_on_cost',
        bundleMarkupBase: 'wholesale',
        bundleDiscount: 23.62,
        sequence: 5,
      },
    ],
  } as PricelistLite;
  const viognier = row({
    subProductId: 'sp1',
    sellingPrice: 28000,
    costPrice: 8000,
    wholesalePrice: 14400,
    unitsPerPack: 6,
  });

  it('still quotes the product-specific rule, matching what checkout charges', () => {
    const r = resolveBundlePriceForRow(viognier, pl, 18720);
    expect(r.bundlePrice).toBe(21700);
    expect(r.bundleQuantity).toBe(6);
    expect(r.bundleTotal).toBe(130200);
  });

  it('does not fall through to the cheaper all-products bundle', () => {
    // 14400 x 1.2362 -> roundUpTo100 -> 17900: the figure the sheet used to
    // print, and the one checkout would never charge for this product.
    expect(resolveBundlePriceForRow(viognier, pl, 18720).bundlePrice).not.toBe(
      17900
    );
  });
});
