// app/shared/purchases/purchases-scan-selection.test.ts
import { describe, expect, it } from 'vitest';
import {
  scanRowToPurchaseLine,
  appendScannedLines,
  type PurchaseLineDraft,
} from './purchases-scan-selection';
import type {
  ScanResultItem,
  ScanMatchedSubProduct,
  ScanMatchedSize,
} from '@/services/scan.service';

const size = (over: Partial<ScanMatchedSize> = {}): ScanMatchedSize => ({
  size: 'size-70cl',
  displayName: '70cl',
  sku: 'HEN-VS-70',
  sellingPrice: 95_000,
  costPrice: 61_000,
  unitsPerPack: 12,
  availableStock: 40,
  isDefault: true,
  ...over,
});

const sub = (
  over: Partial<ScanMatchedSubProduct> = {}
): ScanMatchedSubProduct => ({
  _id: 'sp-1',
  sku: 'HEN-VS',
  baseSellingPrice: 90_000,
  costPrice: 58_000,
  taxRate: 7.5,
  sellWithoutSizeVariants: false,
  bundleDeals: [],
  sizes: [size()],
  ...over,
});

const item = (over: Partial<ScanResultItem> = {}): ScanResultItem => ({
  extractedName: 'Hennessy VS 70cl',
  qty: 3,
  confidence: 'exact',
  matchedProductName: 'Hennessy VS',
  matchedProductId: 'p-1',
  matchedSubProducts: [sub()],
  suggestedSizeId: 'size-70cl',
  partial: false,
  ...over,
});

describe('scanRowToPurchaseLine', () => {
  it('takes the size cost price, never the selling price', () => {
    // The whole point of the purchases port: a PO line is what we PAY, and the
    // scan payload carries both numbers. Taking sellingPrice here would inflate
    // every scanned PO by the margin.
    const line = scanRowToPurchaseLine(item(), { sizeId: 'size-70cl', qty: 3 });

    expect(line?.unitPrice).toBe(61_000);
    expect(line?.unitPrice).not.toBe(95_000);
  });

  it('maps unitsPerPack onto packSize', () => {
    const line = scanRowToPurchaseLine(item(), { sizeId: 'size-70cl', qty: 3 });

    expect(line?.packSize).toBe(12);
  });

  it('defaults packSize to 1 when the size has no unitsPerPack', () => {
    // Size.unitsPerPack defaults to 1 in the schema but older rows predate the
    // field entirely, so it arrives undefined. A 0 or undefined packSize would
    // divide-by-zero the pack totals on the PO form.
    const noPack = item({
      matchedSubProducts: [sub({ sizes: [size({ unitsPerPack: undefined })] })],
    });

    expect(
      scanRowToPurchaseLine(noPack, { sizeId: 'size-70cl', qty: 1 })?.packSize
    ).toBe(1);
  });

  it('falls back to the sub-product cost price when the size has none', () => {
    const zeroCost = item({
      matchedSubProducts: [sub({ sizes: [size({ costPrice: 0 })] })],
    });

    expect(
      scanRowToPurchaseLine(zeroCost, { sizeId: 'size-70cl', qty: 1 })
        ?.unitPrice
    ).toBe(58_000);
  });

  it('labels the line with the matched product name and size', () => {
    const line = scanRowToPurchaseLine(item(), { sizeId: 'size-70cl', qty: 3 });

    expect(line?.productName).toBe('Hennessy VS – 70cl');
    expect(line?.sizeId).toBe('size-70cl');
    expect(line?.sizeName).toBe('70cl');
    expect(line?.sku).toBe('HEN-VS-70');
  });

  it('handles a sizeless sub-product', () => {
    const sizeless = item({
      suggestedSizeId: null,
      matchedSubProducts: [sub({ sellWithoutSizeVariants: true, sizes: [] })],
    });

    const line = scanRowToPurchaseLine(sizeless, { sizeId: null, qty: 2 });

    expect(line?.productName).toBe('Hennessy VS');
    expect(line?.unitPrice).toBe(58_000);
    expect(line?.packSize).toBe(1);
    expect(line?.sizeId).toBeUndefined();
  });

  it('falls back to the extracted name when nothing was matched by name', () => {
    const noName = item({ matchedProductName: null });

    expect(
      scanRowToPurchaseLine(noName, { sizeId: 'size-70cl', qty: 1 })
        ?.productName
    ).toBe('Hennessy VS 70cl – 70cl');
  });

  it('carries the reviewed quantity, not the extracted one', () => {
    // The operator can edit qty in the review list before adding.
    const line = scanRowToPurchaseLine(item({ qty: 3 }), {
      sizeId: 'size-70cl',
      qty: 7,
    });

    expect(line?.quantity).toBe(7);
  });

  it('returns null when there is no match and no override', () => {
    const unmatched = item({
      confidence: 'none',
      matchedProductName: null,
      matchedProductId: null,
      matchedSubProducts: [],
      suggestedSizeId: null,
    });

    expect(
      scanRowToPurchaseLine(unmatched, { sizeId: null, qty: 1 })
    ).toBeNull();
  });

  it('returns null when confidence is none even if a sub-product tagged along', () => {
    // scanMatch can attach near-miss candidates on a 'none' verdict; adding one
    // silently would put a product the buyer never chose onto the PO.
    const noConfidence = item({ confidence: 'none' });

    expect(
      scanRowToPurchaseLine(noConfidence, { sizeId: 'size-70cl', qty: 1 })
    ).toBeNull();
  });

  it('prefers a manual override over the AI match', () => {
    const line = scanRowToPurchaseLine(item(), {
      sizeId: 'size-70cl',
      qty: 2,
      override: {
        subProductId: 'sp-override',
        productName: 'Jameson Irish Whiskey – 1L',
        sku: 'JAM-1L',
        unitPrice: 44_000,
        packSize: 6,
        sizeId: 'size-1l',
        sizeName: '1L',
      },
    });

    expect(line?.subProductId).toBe('sp-override');
    expect(line?.productName).toBe('Jameson Irish Whiskey – 1L');
    expect(line?.unitPrice).toBe(44_000);
    expect(line?.packSize).toBe(6);
    expect(line?.quantity).toBe(2);
  });

  it('adds an unmatched row when the operator overrides it manually', () => {
    const unmatched = item({
      confidence: 'none',
      matchedProductName: null,
      matchedSubProducts: [],
    });

    const line = scanRowToPurchaseLine(unmatched, {
      sizeId: null,
      qty: 1,
      override: {
        subProductId: 'sp-9',
        productName: 'Moet & Chandon',
        sku: 'MOET',
        unitPrice: 120_000,
        packSize: 1,
      },
    });

    expect(line?.subProductId).toBe('sp-9');
  });

  it('picks the selected size, not merely the first one', () => {
    const twoSizes = item({
      matchedSubProducts: [
        sub({
          sizes: [
            size(),
            size({
              size: 'size-1l',
              displayName: '1L',
              sku: 'HEN-VS-1L',
              costPrice: 82_000,
              unitsPerPack: 6,
            }),
          ],
        }),
      ],
    });

    const line = scanRowToPurchaseLine(twoSizes, { sizeId: 'size-1l', qty: 1 });

    expect(line?.unitPrice).toBe(82_000);
    expect(line?.packSize).toBe(6);
    expect(line?.sizeName).toBe('1L');
  });

  it('never emits a quantity below 1', () => {
    expect(
      scanRowToPurchaseLine(item(), { sizeId: 'size-70cl', qty: 0 })?.quantity
    ).toBe(1);
  });

  it('carries the tax rate through', () => {
    expect(
      scanRowToPurchaseLine(item(), { sizeId: 'size-70cl', qty: 1 })?.taxRate
    ).toBe(7.5);
  });
});

// ── appendScannedLines ──────────────────────────────────────────────────────

interface TestLine {
  subProductId: string;
  productName: string;
  sku: string;
  sizeId?: string;
  sizeName?: string;
  quantity: number;
  packSize: number;
  packQty: number;
  unitPrice: number;
  packPrice: number;
  type: string;
  uom: string;
  taxRate: number;
}

const blank = (): TestLine => ({
  subProductId: '',
  productName: '',
  sku: '',
  quantity: 1,
  packSize: 1,
  packQty: 1,
  unitPrice: 0,
  packPrice: 0,
  type: 'unit',
  uom: 'unit',
  taxRate: 0,
});

const draft = (over: Partial<PurchaseLineDraft> = {}): PurchaseLineDraft => ({
  subProductId: 'sp-1',
  productName: 'Hennessy VS – 70cl',
  sku: 'HEN-VS-70',
  quantity: 5,
  packSize: 12,
  unitPrice: 61_000,
  taxRate: 7.5,
  ...over,
});

describe('appendScannedLines', () => {
  it('replaces the untouched blank line a fresh PO starts with', () => {
    // Both create and edit seed the form with one empty line. Appending after
    // it would leave a phantom row that fails the "not linked to a catalog
    // product" save guard.
    const next = appendScannedLines([blank()], [draft()], blank);

    expect(next).toHaveLength(1);
    expect(next[0].productName).toBe('Hennessy VS – 70cl');
  });

  it('keeps lines the buyer already filled in', () => {
    const typed = {
      ...blank(),
      productName: 'Typed by hand',
      subProductId: 'sp-0',
    };

    const next = appendScannedLines([typed], [draft()], blank);

    expect(next).toHaveLength(2);
    expect(next[0].productName).toBe('Typed by hand');
  });

  it('drops only the trailing blanks, not a blank between filled lines', () => {
    const typed = { ...blank(), productName: 'Typed', subProductId: 'sp-0' };
    const gap = blank();
    const typed2 = { ...blank(), productName: 'Typed 2', subProductId: 'sp-2' };

    const next = appendScannedLines(
      [typed, gap, typed2, blank()],
      [draft()],
      blank
    );

    expect(next.map((l) => l.productName)).toEqual([
      'Typed',
      '',
      'Typed 2',
      'Hennessy VS – 70cl',
    ]);
  });

  it('derives packPrice and packQty the way updateItem does', () => {
    const next = appendScannedLines(
      [],
      [draft({ quantity: 25, packSize: 12, unitPrice: 61_000 })],
      blank
    );

    expect(next[0].packPrice).toBe(61_000 * 12);
    // 25 units at 12 per pack is 3 packs — partial packs round up.
    expect(next[0].packQty).toBe(3);
  });

  it('never divides by a zero pack size', () => {
    const next = appendScannedLines(
      [],
      [draft({ packSize: 0, quantity: 4 })],
      blank
    );

    expect(Number.isFinite(next[0].packQty)).toBe(true);
    expect(next[0].packQty).toBe(4);
  });

  it('keeps the blank line defaults the draft does not set', () => {
    const next = appendScannedLines([], [draft()], blank);

    expect(next[0].type).toBe('unit');
    expect(next[0].uom).toBe('unit');
  });

  it('appends several scanned rows in order', () => {
    const next = appendScannedLines(
      [blank()],
      [
        draft({ productName: 'A' }),
        draft({ productName: 'B' }),
        draft({ productName: 'C' }),
      ],
      blank
    );

    expect(next.map((l) => l.productName)).toEqual(['A', 'B', 'C']);
  });

  it('returns the original list untouched when there is nothing to add', () => {
    const typed = { ...blank(), productName: 'Typed', subProductId: 'sp-0' };

    expect(appendScannedLines([typed], [], blank)).toEqual([typed]);
  });
});
