// app/shared/purchases/purchases-orders-helpers.test.ts
// Pure helpers behind the orders list page's search, filters and summaries.
import { describe, it, expect } from 'vitest';
import {
  matchesSearch,
  distinctVendors,
  distinctWarehouses,
  withinDatePreset,
  orderItemsSummary,
  type DatePreset,
} from './purchases-orders-helpers';
import type { PurchaseOrder } from './types';

const order = (over: Record<string, unknown> = {}) =>
  ({
    poNumber: 'PO-2026-0001',
    vendorName: 'Meads & Sons',
    status: 'confirmed',
    currency: 'NGN',
    createdAt: '2026-08-01T10:00:00.000Z',
    items: [
      { quantity: 24, unitPrice: 1000, subProductName: 'Hennessy VS' },
      { quantity: 6, unitPrice: 5000, subProductName: 'Moet Imperial' },
    ],
    ...over,
  }) as unknown as PurchaseOrder;

describe('matchesSearch', () => {
  it('matches PO number, vendor and warehouse label case-insensitively', () => {
    const o = order({
      warehouse: { _id: 'w1', name: 'Maitama Store', code: 'MTM' },
    });
    expect(matchesSearch(o, 'po-2026')).toBe(true);
    expect(matchesSearch(o, 'meads')).toBe(true);
    expect(matchesSearch(o, 'maitama')).toBe(true);
    expect(matchesSearch(o, 'MTM')).toBe(true);
  });

  it('matches line product names', () => {
    expect(matchesSearch(order(), 'hennessy')).toBe(true);
    expect(matchesSearch(order(), 'moet')).toBe(true);
  });

  it('rejects non-matching and empty queries gracefully', () => {
    expect(matchesSearch(order(), 'cognac')).toBe(false);
    expect(matchesSearch(order(), '')).toBe(true);
    expect(matchesSearch(order({ items: [] }), 'hennessy')).toBe(false);
  });
});

describe('distinctVendors / distinctWarehouses', () => {
  it('returns sorted unique vendor names, blanks dropped', () => {
    const list = [
      order({ vendorName: 'Zeta' }),
      order({ vendorName: 'Alpha' }),
      order({ vendorName: 'Alpha' }),
      order({ vendorName: undefined }),
    ];
    expect(distinctVendors(list)).toEqual(['Alpha', 'Zeta']);
  });

  it('returns warehouse options sorted by label with id + label', () => {
    const list = [
      order({ warehouse: { _id: 'w2', name: 'Utako', code: 'UTK' } }),
      order({ warehouse: { _id: 'w1', name: 'Maitama', code: 'MTM' } }),
      order({ warehouse: 'w3' }),
      order({ warehouse: undefined }),
    ];
    expect(distinctWarehouses(list)).toEqual([
      { id: 'w1', label: 'Maitama (MTM)' },
      { id: 'w2', label: 'Utako (UTK)' },
    ]);
  });
});

describe('withinDatePreset', () => {
  const now = Date.now();
  const daysAgo = (n: number) =>
    new Date(now - n * 24 * 60 * 60 * 1000).toISOString();

  it.each([['all'], ['7d'], ['30d'], ['90d'], ['year']] as DatePreset[])(
    'preset %s accepts a fresh order',
    (preset) => {
      expect(withinDatePreset(order({ createdAt: daysAgo(1) }), preset)).toBe(
        true
      );
    }
  );

  it('bounds exclude older orders', () => {
    expect(withinDatePreset(order({ createdAt: daysAgo(10) }), '7d')).toBe(
      false
    );
    expect(withinDatePreset(order({ createdAt: daysAgo(10) }), '30d')).toBe(
      true
    );
    expect(withinDatePreset(order({ createdAt: daysAgo(400) }), 'year')).toBe(
      false
    );
  });

  it('orders without createdAt only pass the all preset', () => {
    expect(withinDatePreset(order({ createdAt: undefined }), 'all')).toBe(
      true
    );
    expect(withinDatePreset(order({ createdAt: undefined }), '30d')).toBe(
      false
    );
  });
});

describe('orderItemsSummary', () => {
  it('summarises line count and unit total', () => {
    expect(orderItemsSummary(order())).toBe('2 items · 30 units');
  });
  it('singularises cleanly', () => {
    expect(
      orderItemsSummary(
        order({
          items: [{ quantity: 1, unitPrice: 100 }],
        })
      )
    ).toBe('1 item · 1 unit');
  });
});
