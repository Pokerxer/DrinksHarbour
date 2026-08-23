import { describe, it, expect } from 'vitest';
import { computeTransferTotals } from './transfer-money';

describe('computeTransferTotals (server mirror)', () => {
  it('applies discount then tax then weighted charge share', () => {
    const t = computeTransferTotals(
      [
        { quantity: 1, costPrice: 3000 },
        { quantity: 1, costPrice: 1000, discountRate: 10 },
      ],
      190
    );
    // nets: 3000 / 900 → weight-share of 190: 146.15 / 43.85
    expect(t.lines[0]).toMatchObject({
      net: 3000,
      chargeShare: 146.15,
      effectiveUnitCost: 3146.15,
    });
    expect(t.lines[1]).toMatchObject({ net: 900, chargeShare: 43.85 });
    expect(t.total).toBe(3000 + 900 + 190);
    expect(t.subtotal).toBe(4000);
    expect(t.discountAmount).toBe(100);
  });

  it('handles zero-value carts without NaN', () => {
    const t = computeTransferTotals([{ quantity: 2, costPrice: 0 }], 99);
    expect(t.lines[0].chargeShare).toBe(0);
    expect(t.total).toBe(0);
  });
});
