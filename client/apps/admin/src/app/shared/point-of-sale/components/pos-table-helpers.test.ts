import { describe, expect, it } from 'vitest';
import {
  computeUnfiredLocal,
  groupTablesBySection,
  posItemKey,
  tabElapsedLabel,
  tableStatusClasses,
} from './pos-table-helpers';
import type { POSTableSummary, POSCartItem } from '../types';

function cartItem(over: Partial<POSCartItem> = {}): POSCartItem {
  return {
    subProductId: 'sp1',
    name: 'Line',
    variant: '',
    sku: '',
    price: 100,
    quantity: 2,
    discount: 0,
    stock: 10,
    costPrice: 50,
    ...over,
  } as POSCartItem;
}

function table(over: Partial<POSTableSummary> = {}): POSTableSummary {
  return {
    _id: over._id ?? Math.random().toString(36).slice(2),
    name: 'T1',
    section: 'Main',
    seats: 4,
    sortOrder: 0,
    status: 'available',
    currentTabId: null,
    tab: null,
    ...over,
  };
}

describe('groupTablesBySection', () => {
  it('sorts by sortOrder then name inside each section', () => {
    const tables = [
      table({ _id: 'b', name: 'T2', sortOrder: 1 }),
      table({ _id: 'a', name: 'T10', sortOrder: 1 }),
      table({ _id: 'c', name: 'T3', sortOrder: 2 }),
      table({ _id: 'd', name: 'T0', sortOrder: 0 }),
    ];

    const groups = groupTablesBySection(tables);

    expect(groups).toHaveLength(1);
    expect(groups[0].section).toBe('Main');
    expect(groups[0].tables.map((t) => t.name)).toEqual([
      'T0',
      'T10',
      'T2',
      'T3',
    ]);
  });

  it('buckets empty and missing sections under "Main"', () => {
    const groups = groupTablesBySection([
      table({ name: 'A', section: '' }),
      table({ name: 'B' }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].section).toBe('Main');
    expect(groups[0].tables.map((t) => t.name)).toEqual(['A', 'B']);
  });

  it('orders sections by first appearance of the globally sorted list', () => {
    const groups = groupTablesBySection([
      // Global sort puts Patio's T9 (sortOrder 5) after Main's pair, so Patio
      // must appear second even though "Patio" sorts before "Bar" alphabetically.
      table({ name: 'T9', section: 'Patio', sortOrder: 5 }),
      table({ name: 'B1', section: 'Bar', sortOrder: 2 }),
      table({ name: 'M1', section: 'Main', sortOrder: 1 }),
      table({ name: 'M2', section: 'Main', sortOrder: 6 }),
      table({ name: 'B2', section: 'Bar', sortOrder: 7 }),
    ]);

    expect(groups.map((g) => g.section)).toEqual(['Main', 'Bar', 'Patio']);
    expect(groups[1].tables.map((t) => t.name)).toEqual(['B1', 'B2']);
  });

  it('does not mutate the array it is given', () => {
    const tables = [table({ name: 'B', sortOrder: 2 }), table({ name: 'A', sortOrder: 1 })];
    groupTablesBySection(tables);
    expect(tables.map((t) => t.name)).toEqual(['B', 'A']);
  });
});

describe('tabElapsedLabel', () => {
  const now = new Date('2026-08-26T18:00:00Z');

  it('returns empty for a tab with no open time', () => {
    expect(tabElapsedLabel(undefined, now)).toBe('');
    expect(tabElapsedLabel('', now)).toBe('');
  });

  it('shows whole minutes under an hour', () => {
    expect(tabElapsedLabel('2026-08-26T17:48:00Z', now)).toBe('12m');
  });

  it('pads the minute part once hours are showing', () => {
    expect(tabElapsedLabel('2026-08-26T16:55:00Z', now)).toBe('1h 05m');
  });

  it('floors partial minutes', () => {
    expect(tabElapsedLabel('2026-08-26T17:59:30Z', now)).toBe('0m');
  });

  it('clamps a future open time to zero rather than going negative', () => {
    expect(tabElapsedLabel('2026-08-26T18:05:00Z', now)).toBe('0m');
  });
});

describe('posItemKey', () => {
  it('matches the server buildPosItemKey for every line shape', () => {
    expect(posItemKey({ subProductId: 'sp1' })).toBe('sp1');
    expect(posItemKey({ subProductId: 'sp1', sizeId: 'sz9' })).toBe('sp1_sz9');
    const comboLine: POSCartItem = {
      ...(cartItem({ quantity: 1 })),
      sizeId: 'sz9',
      comboRef: { comboId: 'cb1', comboName: 'Combo', instanceId: 'ci7' },
    };
    expect(posItemKey(comboLine)).toBe('sp1_sz9__ci_ci7');
    const bxgyLine: POSCartItem = {
      ...cartItem({ quantity: 1 }),
      bxgyRef: {
        rewardId: 'rw2',
        role: 'get',
        discPct: 100,
        originalPrice: 100,
      },
    };
    expect(posItemKey(bxgyLine)).toBe('sp1__bxgy_rw2_get');
  });
});

describe('computeUnfiredLocal', () => {
  it('returns full quantities when nothing has been fired yet', () => {
    const items = [cartItem({ subProductId: 'a', quantity: 3 }), cartItem({ subProductId: 'b' })];

    const unfired = computeUnfiredLocal(items, posItemKey, undefined);

    expect(unfired).toHaveLength(2);
    expect(unfired.map((l) => l.remaining)).toEqual([3, 2]);
    expect(unfired[0].key).toBe('a');
  });

  it('nets partial fires across two rounds down to the remainder', () => {
    const items = [cartItem({ subProductId: 'a', quantity: 5 })];
    const firedLog = [
      { key: 'a', qty: 2, roundNo: 1 },
      { key: 'a', qty: 1, roundNo: 2 },
    ];

    const unfired = computeUnfiredLocal(items, posItemKey, firedLog);

    expect(unfired).toHaveLength(1);
    expect(unfired[0].remaining).toBe(2);
  });

  it('filters out a line whose quantity is fully exhausted by fires', () => {
    const items = [
      cartItem({ subProductId: 'done', quantity: 2 }),
      cartItem({ subProductId: 'left', quantity: 4 }),
    ];
    const firedLog = [{ key: 'done', qty: 2, roundNo: 1 }];

    const unfired = computeUnfiredLocal(items, posItemKey, firedLog);

    expect(unfired.map((l) => l.key)).toEqual(['left']);
  });

  it('treats combo instances of the same product as distinct lines', () => {
    const items = [
      cartItem({
        subProductId: 'sp1',
        comboRef: { comboId: 'cb1', comboName: 'Combo', instanceId: 'c1' },
        quantity: 2,
      }),
      cartItem({
        subProductId: 'sp1',
        comboRef: { comboId: 'cb1', comboName: 'Combo', instanceId: 'c2' },
        quantity: 1,
      }),
    ];
    const firedLog = [{ key: 'sp1__ci_c1', qty: 2, roundNo: 1 }];

    const unfired = computeUnfiredLocal(items, posItemKey, firedLog);

    expect(unfired).toHaveLength(1);
    expect(unfired[0].key).toBe('sp1__ci_c2');
    expect(unfired[0].remaining).toBe(1);
  });

  it('ignores over-firing rather than going negative', () => {
    const items = [cartItem({ subProductId: 'a', quantity: 1 })];
    const firedLog = [
      { key: 'a', qty: 2, roundNo: 1 },
      { key: 'a', qty: 1, roundNo: 2 },
    ];

    expect(computeUnfiredLocal(items, posItemKey, firedLog)).toHaveLength(0);
  });
});

describe('tableStatusClasses', () => {
  it('paints occupied tables red', () => {
    expect(tableStatusClasses('occupied')).toBe(
      'border-red-300 bg-red-50 text-red-700'
    );
  });

  it('paints reserved tables amber', () => {
    expect(tableStatusClasses('reserved')).toBe(
      'border-amber-300 bg-amber-50 text-amber-700'
    );
  });

  it('greys inactive tables out', () => {
    expect(tableStatusClasses('inactive')).toBe(
      'border-gray-200 bg-gray-100 text-gray-400 opacity-60'
    );
  });

  it('leaves available tables white with the brand hover', () => {
    expect(tableStatusClasses('available')).toBe(
      'border-gray-200 bg-white text-gray-700 hover:border-[#b20202] hover:text-[#b20202]'
    );
  });
});
