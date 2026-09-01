import { describe, expect, it } from 'vitest';
import { buildPricelistDoc } from './pricelist-print';
import type {
  PricelistPrintOptions,
  PricelistPrintRow,
} from '@/app/shared/inventory/inventory-pricelist-print';
import { COMPANY } from './print-shared';

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

describe('buildPricelistDoc', () => {
  it('prefers the business name as issuer, then origin, then the platform', () => {
    const both = buildPricelistDoc(
      [row()],
      null,
      opts({
        businessName: 'Acme Wines',
        originName: 'Main Cellar',
      })
    );
    expect(both.companyName).toBe('Acme Wines');

    const originOnly = buildPricelistDoc(
      [row()],
      null,
      opts({ originName: 'Main Cellar' })
    );
    expect(originOnly.companyName).toBe('Main Cellar');

    const bare = buildPricelistDoc([row()], null, opts());
    expect(bare.companyName).toBe(COMPANY.name);
  });

  it("uses the issuing warehouse's own contact block as the head", () => {
    const head = {
      address: '9 Close C Sungold Estate, Galadimawa',
      city: 'Abuja, FCT, Nigeria',
      email: 'info@wyncity.ng',
      phone: undefined,
    };
    const m = buildPricelistDoc(
      [row()],
      null,
      opts({
        originName: 'Cloud Bay Wyn City Enterprise Limited',
        originWarehouseCount: 1,
        originHead: head,
      })
    );
    expect(m.companyName).toBe('Cloud Bay Wyn City Enterprise Limited');
    expect(m.head).toEqual(head);
    // The renderer only reaches for COMPANY when head is absent, so a sheet
    // carrying one can never print accounts@drinksharbour.com.
    expect(m.head?.email).not.toBe(COMPANY.email);
  });

  it('leaves the head undefined so mixed sheets fall back to the platform', () => {
    const m = buildPricelistDoc(
      [row()],
      null,
      opts({ originName: 'Acme Wines', originWarehouseCount: 3 })
    );
    expect(m.head).toBeUndefined();
  });

  it('stamps the document identity and generated number', () => {
    const m = buildPricelistDoc(
      [row()],
      null,
      opts({ title: 'Wholesale Price List' })
    );
    expect(m.kind).toBe('pricelist');
    expect(m.docTitle).toBe('Wholesale Price List');
    expect(m.number).toMatch(/^PL-\d{8}$/);
    expect(m.fileName).toMatch(/^wholesale-price-list-\d{4}-\d{2}-\d{2}\.pdf$/);
  });

  it('summarises generated, validity, items and warehouses in the meta strip', () => {
    const m = buildPricelistDoc(
      [row(), row({ subProductId: 'sp2', sizeId: 's2' })],
      null,
      opts({
        validUntil: '2026-09-30',
        originWarehouseCount: 3,
        originName: 'Acme',
      })
    );
    const meta = Object.fromEntries(m.meta);
    expect(meta['Items']).toBe('2');
    expect(meta['Valid until']).toBe('30 Sep 2026');
    expect(meta['Warehouses']).toBe('3');
    expect(meta['Generated']).toMatch(/^\d{2} \w{3} \d{4}$/);

    const undated = buildPricelistDoc([row()], null, opts());
    expect(Object.fromEntries(undated.meta)['Valid until']).toBe('—');
    expect(Object.fromEntries(undated.meta)['Warehouses']).toBe('—');
  });

  it('prices lines through the shared engine into a flat table', () => {
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
    const m = buildPricelistDoc(
      [row()],
      promo as never,
      opts({ groupByCategory: false })
    );
    expect(m.table.columns.map((c) => c.label)).toEqual([
      'Product',
      'Size',
      'Unit Price',
    ]);
    expect(m.table.rows).toHaveLength(1);
    const [product, , price] = m.table.rows[0];
    expect(product.text).toBe('Hennessy VS');
    expect(product.sub).toBe('HN-VS-70');
    expect(price.text).toContain('9,000');
    expect(price.sub).toMatch(/^was /);
    expect(price.strong).toBe(true);
  });

  it('hides the SKU sub-line unless requested', () => {
    const m = buildPricelistDoc([row()], null, opts({ showSku: false }));
    expect(m.table.rows[0][0].sub).toBeUndefined();
  });

  it('separates categories with strong divider rows when grouped', () => {
    const m = buildPricelistDoc(
      [
        row({ categoryName: 'Cognac' }),
        row({
          subProductId: 'sp2',
          sizeId: 's2',
          categoryName: 'Beer',
          productName: 'Guinness',
        }),
        row({
          subProductId: 'sp3',
          sizeId: 's3',
          categoryName: 'Cognac',
          productName: 'Martell',
        }),
      ],
      null,
      opts()
    );
    const dividers = m.table.rows.filter((r) => r[0].strong);
    expect(dividers.map((r) => r[0].text)).toEqual(['BEER — 1', 'COGNAC — 2']);
    // 3 product rows + 2 dividers
    expect(m.table.rows).toHaveLength(5);
    // Divider rows carry no price
    expect(dividers[0][m.table.columns.length - 1].text).toBe('');
    // Each divider must precede its own group's product rows
    const texts = m.table.rows.map((r) => r[0].text);
    expect(texts.indexOf('BEER — 1')).toBeLessThan(texts.indexOf('Guinness'));
    expect(texts.indexOf('COGNAC — 2')).toBeLessThan(
      texts.indexOf('Hennessy VS')
    );
  });

  it('shows availability with a muted dash for zero stock', () => {
    const m = buildPricelistDoc(
      [
        row({ currentQuantity: 0 }),
        row({ subProductId: 'sp2', sizeId: 's2', currentQuantity: 7 }),
      ],
      null,
      opts({ showAvailability: true, groupByCategory: false })
    );
    expect(m.table.columns.map((c) => c.label)).toContain('Available');
    expect(m.table.rows[0][2].text).toBe('—');
    expect(m.table.rows[1][2].text).toBe('7');
  });

  it('banners the trade discount only when set', () => {
    const withDisc = buildPricelistDoc(
      [row()],
      null,
      opts({ discountPercent: 10 })
    );
    expect(withDisc.notice?.title.toLowerCase()).toContain('trade discount');
    expect(withDisc.notice?.body).toContain('10%');

    const clean = buildPricelistDoc([row()], null, opts());
    expect(clean.notice).toBeUndefined();
  });

  it('carries the pricelist name and validity in the notes section', () => {
    const m = buildPricelistDoc(
      [row()],
      { _id: 'p', name: 'Trade Sheet — Q3' } as never,
      opts({ validUntil: '2026-09-30' })
    );
    const body = m.sections.map((s) => s.body).join(' ');
    expect(body).toContain('Trade Sheet — Q3');
    expect(body).toContain('30 Sep 2026');
    expect(body).toContain('stock availability');
  });

  it('emits no totals, signatures or parties — a price list carries none', () => {
    const m = buildPricelistDoc([row()], null, opts());
    expect(m.totals).toHaveLength(0);
    expect(m.signatures).toHaveLength(0);
    expect(m.parties).toHaveLength(0);
  });

  it('adds a Bundle Price + Bundle Qty column when a pricelist has bundle rules', () => {
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
    const m = buildPricelistDoc(
      [row()],
      pl as never,
      opts({ groupByCategory: false })
    );
    const labels = m.table.columns.map((c) => c.label);
    expect(labels).toContain('Bundle Price');
    expect(labels).toContain('Bundle Qty');
    // The product row should have the bundle price and qty cells
    const bundlePriceIdx = labels.indexOf('Bundle Price');
    const bundleQtyIdx = labels.indexOf('Bundle Qty');
    const priceCell = m.table.rows[0][bundlePriceIdx];
    const qtyCell = m.table.rows[0][bundleQtyIdx];
    // Headline is what the customer pays for the tier: 6 × ₦9,000 = ₦54,000.
    expect(priceCell.text).toContain('54,000');
    expect(priceCell.strong).toBe(true);
    // Per-unit stays visible underneath — it is the only figure comparable to
    // the Unit Price column, and the one that applies past the threshold.
    expect(priceCell.sub).toContain('9,000');
    expect(priceCell.sub).toContain('each');
    expect(qtyCell.text).toBe('6');
  });

  it('omits bundle columns when no bundle rules exist', () => {
    const m = buildPricelistDoc([row()], null, opts());
    const labels = m.table.columns.map((c) => c.label);
    expect(labels).not.toContain('Bundle Price');
    expect(labels).not.toContain('Bundle Qty');
  });
});
