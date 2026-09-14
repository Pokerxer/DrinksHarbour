import { describe, expect, it, vi } from 'vitest';
import type { SalesLineItem } from '@/services/salesOrder.service';
import { blankLine } from './sales-create-pricing-helpers';
import {
  mergeRepricedLines,
  singleFlight,
  pricingSignature,
} from './sales-repricing';
const previous = {
  ...blankLine(),
  key: 'old',
  subProductId: 'sp',
  sizeId: 'size',
  sizeName: '750ml',
  costPrice: 700,
  availableStock: 12,
  originalPrice: 1200,
  activeBundles: [],
  baseUnitPrice: 999,
  priceOverridden: true,
};
const item = {
  _id: 'new',
  lineType: 'product',
  subproduct: 'sp',
  size: 'size',
  quantity: 2,
  unitPrice: 1100,
  discount: 0,
  taxRate: 0,
  packSize: 6,
  priceOverridden: false,
} as SalesLineItem;
describe('server repricing', () => {
  it('keeps catalog metadata even when line IDs change, using authoritative prices', () => {
    expect(mergeRepricedLines([previous], [item])[0]).toMatchObject({
      key: 'new',
      sizeName: '750ml',
      costPrice: 700,
      availableStock: 12,
      originalPrice: 1200,
      activeBundles: [],
      baseUnitPrice: 1100,
      priceOverridden: false,
      enginePriced: true,
      quantity: 2,
      packSize: 6,
    });
  });
  it('does not copy stock or cost across sizes', () => {
    const [line] = mergeRepricedLines([previous], [{ ...item, size: 'other' }]);
    expect(line.availableStock).toBeUndefined();
    expect(line.costPrice).toBe(0);
  });
  it('matches duplicate products by ID first', () => {
    expect(
      mergeRepricedLines(
        [previous, { ...previous, key: 'other', costPrice: 800 }],
        [{ ...item, _id: 'other' }]
      )[0].costPrice
    ).toBe(800);
  });
  it('ignores metadata changes but detects quantity and pricelist changes', () => {
    const lines = mergeRepricedLines([previous], [item]);
    expect(pricingSignature(lines, 'pl')).toBe(
      pricingSignature(
        lines.map((l) => ({ ...l, costPrice: 1 })),
        'pl'
      )
    );
    expect(pricingSignature(lines, 'pl')).not.toBe(
      pricingSignature(
        lines.map((l) => ({ ...l, quantity: 3 })),
        'pl'
      )
    );
    expect(pricingSignature(lines, 'pl')).not.toBe(
      pricingSignature(lines, 'other')
    );
  });
});
describe('overlapping updates', () => {
  it('runs one save/reprice chain while pending and allows later updates', async () => {
    const run = singleFlight();
    let finish!: () => void;
    const action = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        })
    );
    const first = run(action);
    const second = run(action);
    await Promise.resolve();
    expect(action).toHaveBeenCalledTimes(1);
    finish();
    await Promise.all([first, second]);
    const next = vi.fn(async () => 42);
    await expect(run(next)).resolves.toBe(42);
    expect(next).toHaveBeenCalledTimes(1);
  });
  it('allows an explicit retry after failure', async () => {
    const run = singleFlight();
    await expect(
      run(async () => {
        throw new Error('offline');
      })
    ).rejects.toThrow('offline');
    await expect(run(async () => 42)).resolves.toBe(42);
  });
});
