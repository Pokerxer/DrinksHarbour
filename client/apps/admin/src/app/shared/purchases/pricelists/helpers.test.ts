// app/shared/purchases/pricelists/helpers.test.ts
import { describe, expect, it } from 'vitest';
import {
  BIG_JUMP_THRESHOLD,
  buildPricelistCsv,
  duplicateLineKeys,
  effectiveNet,
  emptyLine,
  isBigJump,
  lineDelta,
  lineIsValid,
  makeLineKey,
  netPrice,
  parsePricelistCsv,
  toPayloadItems,
} from './helpers';
import type { EditorLine } from './helpers';

const line = (over: Partial<EditorLine> = {}): EditorLine => ({
  ...emptyLine(),
  ...over,
});

describe('netPrice / effectiveNet', () => {
  it('applies the line discount', () => {
    expect(netPrice({ unitPrice: 1000, discountPercent: 10 })).toBe(900);
  });
  it('clamps discounts to 0–100', () => {
    expect(netPrice({ unitPrice: 1000, discountPercent: 150 })).toBe(0);
    expect(netPrice({ unitPrice: 1000, discountPercent: -20 })).toBe(1000);
  });
  it('stacks the global discount on top', () => {
    expect(effectiveNet({ unitPrice: 1000, discountPercent: 10 }, 10)).toBeCloseTo(810);
  });
});

describe('line validity', () => {
  it('requires a product identity (link or manual name)', () => {
    expect(lineIsValid(line())).toBe(false);
    expect(lineIsValid(line({ productName: 'Manual item' }))).toBe(false);
    expect(lineIsValid(line({ productName: 'M', unitPrice: 25 }))).toBe(true);
    expect(lineIsValid(line({ subProductId: 'abc', unitPrice: 25 }))).toBe(true);
  });
  it('rejects zero/negative prices', () => {
    expect(lineIsValid(line({ subProductId: 'a', unitPrice: 0 }))).toBe(false);
    expect(lineIsValid(line({ subProductId: 'a', unitPrice: -3 }))).toBe(false);
  });
});

describe('duplicate detection', () => {
  it('flags every member of a duplicated product+size pair', () => {
    const a = line({ subProductId: 'p1' });
    const b = line({ subProductId: 'p1' });
    const c = line({ subProductId: 'p2' });
    const dupes = duplicateLineKeys([a, b, c]);
    expect(dupes.has(a._key)).toBe(true);
    expect(dupes.has(b._key)).toBe(true);
    expect(dupes.has(c._key)).toBe(false);
  });
  it('ignores manual-name lines', () => {
    const a = line({ productName: 'X' });
    const b = line({ productName: 'X' });
    expect(duplicateLineKeys([a, b]).size).toBe(0);
  });
});

describe('toPayloadItems', () => {
  it('strips _key and drops invalid lines', () => {
    const good = line({ subProductId: 'p1', unitPrice: 5 });
    const bad = line({ unitPrice: 0 });
    const out = toPayloadItems([good, bad]);
    expect(out).toHaveLength(1);
    expect(out[0]).not.toHaveProperty('_key');
    expect(out[0].unitPrice).toBe(5);
  });
});

describe('CSV round-trip', () => {
  it('parses a header row into typed lines', () => {
    const csv = [
      'productName,sku,vendorProductCode,unitPrice,discountPercent,minQuantity,maxQuantity,leadTimeDays,packaging,notes',
      '"Hennessy 70cl",HNK70,VL-1,15000,5,2,,7,carton,Fragile"',
    ].join('\n');
    const lines = parsePricelistCsv(csv);
    expect(lines).toHaveLength(1);
    expect(lines[0].productName).toBe('Hennessy 70cl');
    expect(lines[0].unitPrice).toBe(15000);
    expect(lines[0].discountPercent).toBe(5);
    expect(lines[0].minQuantity).toBe(2);
    expect(lines[0].packaging).toBe('carton');
  });
  it('throws on a missing/unrecognised header', () => {
    expect(() => parsePricelistCsv('just,some,cells')).toThrow(/header/i);
  });
  it('round-trips through buildPricelistCsv', () => {
    const src = [line({ productName: 'A,B', sku: 'S1', unitPrice: 10, leadTimeDays: 3 })];
    const parsed = parsePricelistCsv(buildPricelistCsv(src));
    expect(parsed).toHaveLength(1);
    expect(parsed[0].productName).toBe('A,B');
    expect(parsed[0].sku).toBe('S1');
    expect(parsed[0].unitPrice).toBe(10);
  });
});

describe('keys & deltas', () => {
  it('generates unique keys', () => {
    const keys = new Set(Array.from({ length: 50 }, () => makeLineKey()));
    expect(keys.size).toBe(50);
  });
  it('derives delta from latest history entry', () => {
    const l = line({
      unitPrice: 110,
      priceHistory: [{ unitPrice: 100, changePercent: 10, source: 'po' }],
    });
    expect(lineDelta(l)).toBe(10);
    expect(isBigJump(l)).toBe(false);
    expect(BIG_JUMP_THRESHOLD).toBeGreaterThanOrEqual(20);
  });
});
