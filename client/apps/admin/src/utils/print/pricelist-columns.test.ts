import { writeFileSync } from 'node:fs';
import { renderDocument } from './pdf-render';
import { describe, it, expect } from 'vitest';
import { buildPricelistDoc } from './pricelist-print';
import {
  buildCustomerPricelistHtml,
  buildPricelistCsv,
  type PricelistPrintOptions,
  type PricelistPrintRow,
} from '@/app/shared/inventory/inventory-pricelist-print';

const row: PricelistPrintRow = {
  productName: 'Lagar Colheita',
  sku: 'LC',
  sizeName: '75cl',
  categoryName: 'Red Wine',
  sellingPrice: 16600,
  costPrice: 11000,
  wholesalePrice: 76161.6 / 6 / 1.1,
  unitsPerPack: 6,
  subProductId: 'sp1',
  sizeId: 's1',
  currentQuantity: 20,
};
const distributor = {
  _id: 'd',
  name: 'Distributors Price',
  rules: [
    {
      priceType: 'bundle',
      bundleQuantity: 6,
      bundleDiscountType: 'markup_on_cost',
      bundleDiscount: 10,
      bundleMarkupBase: 'wholesale',
    },
  ],
};
const wholesaler = {
  _id: 'w',
  name: 'Wholesalers Price',
  rules: [{ ...distributor.rules[0], bundleDiscount: 21 }],
};
const opts = (over: Record<string, unknown> = {}) =>
  ({
    title: 'Wholesale Price List',
    groupByCategory: true,
    showSku: false,
    showAvailability: false,
    showWasPrices: false,
    priceColumns: [
      { label: distributor.name, pricelist: distributor, mode: 'bundle' },
      { label: wholesaler.name, pricelist: wholesaler, mode: 'bundle' },
      { label: 'Recommended Sales Price', pricelist: null, mode: 'unit' },
    ],
    ...over,
  }) as PricelistPrintOptions;

describe('reference wholesale sheet', () => {
  it('rounds the final formula bundle total once, matching the reference kobo', () => {
    const doc = buildPricelistDoc(
      [{ ...row, wholesalePrice: 11877.382, productName: 'Tapada do Barao' }],
      null,
      opts({ groupByCategory: false })
    );
    expect(doc.table.rows[0][3].text).toBe('NGN 86,229.79');
  });
  it('uses only selected named columns, with reference prices and tax wording', () => {
    const doc = buildPricelistDoc(
      [row],
      null,
      opts({ taxNote: '7.5% tax included.' })
    );
    expect(doc.table.columns.map((c) => c.label)).toEqual([
      'Product',
      'Size',
      'Distributors Price',
      'Wholesalers Price',
      'Recommended Sales Price',
    ]);
    expect(doc.table.rows[1].slice(2).map((c) => c.text)).toEqual([
      'NGN 76,161.60',
      'NGN 83,777.76',
      'NGN 16,600.00',
    ]);
    expect(doc.table.rows[1][2].sub).toContain('6 units');
    expect(doc.sections?.[0].body).toContain('7.5% tax included.');
  });
  it('CSV and HTML use the same selected prices and column order', () => {
    const csv = buildPricelistCsv([row], null, opts());
    expect(csv.split('\n')[0]).toBe(
      'Category,Product,SKU,Size,Distributors Price,Wholesalers Price,Recommended Sales Price,Currency'
    );
    expect(csv.split('\n')[1]).toContain('76161.60,83777.76,16600.00');
    const html = buildCustomerPricelistHtml([row], null, opts());
    expect(html).toContain('Distributors Price</th>');
    expect(html).toContain('83,777.76');
    expect(html).not.toContain('>Unit Price</th>');
  });
  it('prices columns independently and discounts each final quote', () => {
    const discount = (id: string, pct: number) => ({
      _id: id,
      name: id,
      rules: [
        {
          priceType: 'discount',
          discountType: 'percentage',
          discountPercentage: pct,
        },
      ],
    });
    const doc = buildPricelistDoc(
      [row],
      discount('unused', 50),
      opts({
        groupByCategory: false,
        discountPercent: 10,
        priceColumns: [
          { label: 'A', pricelist: discount('a', 10), mode: 'unit' },
          { label: 'B', pricelist: discount('b', 20), mode: 'unit' },
          { label: 'Wholesale', pricelist: wholesaler, mode: 'bundle' },
        ],
      })
    );
    expect(doc.table.rows[0].slice(2).map((c) => c.text)).toEqual([
      'NGN 13,446.00',
      'NGN 11,952.00',
      'NGN 75,399.98',
    ]);
  });
  it('keeps mixed bundle quantities on their own rows', () => {
    const pack = {
      ...wholesaler,
      rules: [{ ...wholesaler.rules[0], bundleUnitsMode: 'pack' }],
    };
    const doc = buildPricelistDoc(
      [row, { ...row, subProductId: 'sp2', sizeId: 's2', unitsPerPack: 12 }],
      null,
      opts({
        groupByCategory: false,
        priceColumns: [{ label: 'Trade', pricelist: pack, mode: 'bundle' }],
      })
    );
    expect(doc.table.columns[2].label).toBe('Trade');
    expect(doc.table.rows[0][2].sub).toContain('6 units');
    expect(doc.table.rows[1][2].sub).toContain('12 units');
  });
  it('shows unavailable bundles and rejects missing full rules', () => {
    const doc = buildPricelistDoc(
      [{ ...row, wholesalePrice: 0 }],
      null,
      opts({ groupByCategory: false })
    );
    expect(doc.table.rows[0][2].text).toBe('—');
    expect(doc.table.rows[0][3].text).toBe('—');
    expect(() =>
      buildPricelistDoc(
        [row],
        null,
        opts({
          priceColumns: [
            {
              label: 'Unloaded',
              pricelist: { _id: 'x', name: 'X' },
              mode: 'unit',
            },
          ],
        })
      )
    ).toThrow(/rules/i);
  });
});

it('renders the nine-product reference layout through the real PDF renderer', () => {
  const names = [
    ['Lagar dos Perdigões Colheita Vinho Tinto', 16600, 76161.6, 'Red Wine'],
    [
      'Lagar dos Perdigões Reserva Alentejano Vinho Tinto',
      18800,
      86378.4,
      'Red Wine',
    ],
    ['Monte Dos Perdigoes Vinhas Velhas Tinto', 35500, 153352.8, 'Red Wine'],
    ['Poliphonia Family Blend Vinho Tinto', 24000, 110527.2, 'Red Wine'],
    ['Sunblessed Vinho Tinto', 12600, 58050, 'Red Wine'],
    [
      'Tapada do Barao Colheita Selectionada Vinho Tinto',
      17100,
      78390.72,
      'Red Wine',
    ],
    ['Lagar dos Perdigões Colheita Vinho Branco', 16600, 76161.6, 'White Wine'],
    ['Sunblessed Vinho Branco', 12600, 58050, 'White Wine'],
    [
      'Tapada do Barao Colheita Selectionada Vinho Branco',
      17100,
      78390.72,
      'White Wine',
    ],
  ] as const;
  const rows = names.map(
    ([productName, sellingPrice, total, categoryName], i) => ({
      ...row,
      productName,
      sellingPrice,
      wholesalePrice: total / 6 / 1.1,
      categoryName,
      subProductId: `sp${i}`,
      sizeId: `sz${i}`,
    })
  );
  const model = buildPricelistDoc(
    rows,
    null,
    opts({
      businessName: 'Cloud Bay Wyn City Enterprise Limited',
      originWarehouseCount: 1,
      originHead: {
        address: '9 Close C Sungold Estate, Galadimawa',
        city: 'Abuja, FCT, Nigeria',
        email: 'info@wyncity.ng',
      },
      validUntil: '2026-11-15',
      taxNote: '7.5% tax included.',
    })
  );
  expect(model.table.rows).toHaveLength(11);
  expect(
    model.table.rows.every((r) => r.length === model.table.columns.length)
  ).toBe(true);
  const pdf = renderDocument(model);
  expect(pdf.getNumberOfPages()).toBe(1);
  const bytes = Buffer.from(pdf.output('arraybuffer'));
  expect(bytes.toString('latin1').startsWith('%PDF-')).toBe(true);
  if (process.env.PRICE_LIST_PREVIEW)
    writeFileSync(process.env.PRICE_LIST_PREVIEW, bytes);
});

it('quotes a six-unit pack from a formula-only pricelist, using the real Lagar prices', () => {
  const costList = {
    _id: 'cost',
    name: 'Cost price',
    rules: [
      { priceType: 'formula', markupBase: 'wholesale', markupPercentage: 7.5 },
    ],
  };
  const doc = buildPricelistDoc(
    [{ ...row, sellingPrice: 16000, wholesalePrice: 11808 }],
    null,
    opts({
      groupByCategory: false,
      priceColumns: [
        { label: 'Cost price', pricelist: costList, mode: 'bundle' },
      ],
    })
  );
  expect(doc.table.rows[0][2].text).toBe('NGN 76,161.60');
  expect(doc.table.rows[0][2].sub).toContain('6 units');
});
it('applies quantity-gated formula rules at the quoted pack quantity', () => {
  const pl = {
    _id: 'cost',
    name: 'Cost price',
    rules: [
      {
        priceType: 'formula',
        markupBase: 'wholesale',
        markupPercentage: 7.5,
        minQuantity: 6,
      },
    ],
  };
  const doc = buildPricelistDoc(
    [{ ...row, wholesalePrice: 11808 }],
    null,
    opts({
      groupByCategory: false,
      priceColumns: [{ label: 'Pack', pricelist: pl, mode: 'bundle' }],
    })
  );
  expect(doc.table.rows[0][2].text).toBe('NGN 76,161.60');
});
it('uses and labels saved wholesale fallback when rules target different products', () => {
  const other = {
    _id: 'wholesale',
    name: 'Wholesale Price',
    rules: [
      {
        priceType: 'bundle',
        subProduct: 'other-product',
        bundleQuantity: 6,
        bundleDiscountType: 'markup_on_cost',
        bundleDiscount: 18.4,
        bundleMarkupBase: 'wholesale',
      },
    ],
  };
  const doc = buildPricelistDoc(
    [{ ...row, wholesalePrice: 11808 }],
    null,
    opts({
      groupByCategory: false,
      priceColumns: [
        { label: 'Wholesale Price', pricelist: other, mode: 'bundle' },
      ],
    })
  );
  expect(doc.table.rows[0][2].text).toBe('NGN 70,848.00');
  expect(doc.table.rows[0][2].sub).not.toContain('Saved wholesale price');
  expect(doc.table.rows[0][2].sub).toContain('6 units');
  const csv = buildPricelistCsv(
    [{ ...row, wholesalePrice: 11808 }],
    null,
    opts({
      priceColumns: [
        { label: 'Wholesale Price', pricelist: other, mode: 'bundle' },
      ],
    })
  );
  expect(csv).toContain('Saved wholesale price');
});
it('generates the screenshot configuration using the saved prices and labels wholesale fallback', () => {
  const rows = [
    {
      ...row,
      productName: 'Lagar dos Perdigões Colheita Vinho Tinto',
      sellingPrice: 16000,
      wholesalePrice: 11808,
    },
    {
      ...row,
      subProductId: 'sp2',
      productName: 'Lagar dos Perdigões Reserva Alentejano Vinho Tinto',
      sellingPrice: 18000,
      wholesalePrice: 13392,
    },
    {
      ...row,
      subProductId: 'sp3',
      productName: 'Lagar dos Perdigões Colheita Vinho Branco',
      categoryName: 'White Wine',
      sellingPrice: 16000,
      wholesalePrice: 11808,
    },
  ];
  const columns = [
    { label: 'Recommended Sales Price', pricelist: null, mode: 'unit' },
    {
      label: 'Cost price',
      pricelist: {
        _id: 'cost',
        name: 'Cost price',
        rules: [
          {
            priceType: 'formula',
            markupBase: 'wholesale',
            markupPercentage: 7.5,
          },
        ],
      },
      mode: 'bundle',
    },
    {
      label: 'Wholesale Price',
      pricelist: {
        _id: 'wholesale',
        name: 'Wholesale Price',
        rules: [
          {
            priceType: 'bundle',
            subProduct: 'another-product',
            bundleQuantity: 6,
            bundleDiscountType: 'markup_on_cost',
            bundleDiscount: 18.4,
            bundleMarkupBase: 'wholesale',
            bundleUnitsMode: 'pack',
          },
        ],
      },
      mode: 'bundle',
    },
  ];
  const model = buildPricelistDoc(
    rows,
    null,
    opts({
      validUntil: '2026-11-01',
      priceColumns: columns,
      businessName: 'Cloud Bay Wyn City Enterprise Limited',
      originWarehouseCount: 1,
      originHead: {
        address: '9 Close C Sungold Estate, Galadimawa',
        city: 'Abuja, FCT, Nigeria',
        email: 'info@wyncity.ng',
      },
    })
  );
  const productRows = model.table.rows.filter((r) => !r[0].strong);
  expect(productRows.map((r) => r.slice(2).map((c) => c.text))).toEqual([
    ['NGN 16,000.00', 'NGN 76,161.60', 'NGN 70,848.00'],
    ['NGN 18,000.00', 'NGN 86,378.40', 'NGN 80,352.00'],
    ['NGN 16,000.00', 'NGN 76,161.60', 'NGN 70,848.00'],
  ]);
  expect(
    productRows.every((r) => !r[4].sub?.includes('Saved wholesale price'))
  ).toBe(true);
  const pdf = renderDocument(model);
  expect(pdf.getNumberOfPages()).toBe(1);
  if (process.env.PRICE_LIST_ACTUAL_PREVIEW)
    writeFileSync(
      process.env.PRICE_LIST_ACTUAL_PREVIEW,
      Buffer.from(pdf.output('arraybuffer'))
    );
});
