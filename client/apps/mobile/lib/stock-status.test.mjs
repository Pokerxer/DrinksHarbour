import { describe, expect, test } from 'vitest';

const { toStockStatusView } = await import('./stock-status.ts');

/**
 * The thresholds are a product decision, not styling: "Selling Fast" at 70% sold
 * is a claim the web and the app must make at the same moment. These pin the
 * band boundaries so a refactor cannot slide them.
 */
describe('bands', () => {
  test('90% sold or more is Almost Gone', () => {
    expect(toStockStatusView({ stock: 10, totalStock: 100 }).text).toBe('Almost Gone');
    expect(toStockStatusView({ stock: 9, totalStock: 100 }).tone).toBe('almost');
  });

  test('70% sold is Selling Fast', () => {
    expect(toStockStatusView({ stock: 30, totalStock: 100 }).text).toBe('Selling Fast');
  });

  test('50% sold is Limited Stock', () => {
    expect(toStockStatusView({ stock: 50, totalStock: 100 }).text).toBe('Limited Stock');
  });

  test('below 50% sold is In Stock', () => {
    expect(toStockStatusView({ stock: 51, totalStock: 100 }).text).toBe('In Stock');
  });

  test('the boundary belongs to the more urgent band', () => {
    // Exactly 70% sold reads "Selling Fast", not "Limited Stock".
    expect(toStockStatusView({ stock: 30, totalStock: 100 }).tone).toBe('fast');
    expect(toStockStatusView({ stock: 31, totalStock: 100 }).tone).toBe('limited');
  });
});

describe('out of stock', () => {
  test('stock exactly 0 is Out of Stock regardless of the band maths', () => {
    const view = toStockStatusView({ stock: 0, totalStock: 100 });
    expect(view.text).toBe('Out of Stock');
    expect(view.remainingPct).toBe(0);
  });

  test('inStock:false is Out of Stock even with units on hand', () => {
    expect(toStockStatusView({ stock: 80, totalStock: 100, inStock: false }).text).toBe(
      'Out of Stock'
    );
  });
});

describe('"Only N left"', () => {
  test('replaces the band label at 5 or fewer', () => {
    expect(toStockStatusView({ stock: 3, totalStock: 100 }).text).toBe('Only 3 left');
  });

  test('does not apply at 6', () => {
    expect(toStockStatusView({ stock: 6, totalStock: 100 }).text).toBe('Almost Gone');
  });

  // 0 is Out of Stock, not "Only 0 left" — the web guards `stock > 0`.
  test('does not apply at 0', () => {
    expect(toStockStatusView({ stock: 0, totalStock: 100 }).text).toBe('Out of Stock');
  });
});

describe('the progress bar', () => {
  test('shows the REMAINING share, not the sold share', () => {
    expect(toStockStatusView({ stock: 25, totalStock: 100 }).remainingPct).toBe(25);
  });

  test('availableStock wins over stock when both are given', () => {
    expect(
      toStockStatusView({ stock: 90, availableStock: 10, totalStock: 100 }).remainingPct
    ).toBe(10);
  });

  test('is clamped, so bad data cannot draw a bar past either end', () => {
    expect(toStockStatusView({ stock: 500, totalStock: 100 }).remainingPct).toBe(100);
    expect(toStockStatusView({ stock: -50, totalStock: 100 }).remainingPct).toBe(0);
  });

  // The web prop defaults totalStock to 100; a card that knows only `stock`
  // must still land on a sensible band rather than divide by nothing.
  test('totalStock defaults to 100, matching the web prop default', () => {
    // 40 units against the assumed 100 is 60% sold — the Limited Stock band.
    expect(toStockStatusView({ stock: 40 }).text).toBe('Limited Stock');
    expect(toStockStatusView({ stock: 40 }).remainingPct).toBe(40);
  });

  test('with nothing known at all it reads as fully in stock', () => {
    expect(toStockStatusView({}).text).toBe('In Stock');
    expect(toStockStatusView({}).remainingPct).toBe(100);
  });
});
