import { describe, expect, it } from 'vitest';
import {
  groupsToOrderPayloads,
  splitEqually,
  validateGroups,
} from './pos-split-helpers';
import { posItemKey } from './pos-table-helpers';
import type { POSCartItem } from '../types';

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

describe('splitEqually', () => {
  it('deals whole units round-robin from the highest unit price down', () => {
    // Dealt per unit: a→P1, a→P2, b→P1, b→P2, b→P1 — value lands ₦9000/₦7000,
    // far closer to an even split than dealing whole lines would.
    const items = [
      cartItem({ subProductId: 'a', name: 'Champagne', price: 5000, quantity: 2 }),
      cartItem({ subProductId: 'b', name: 'Beer', price: 2000, quantity: 3 }),
    ];

    const [p1, p2] = splitEqually(items, posItemKey, 2);

    expect(p1.itemRefs).toEqual(['a', 'b']);
    expect(p1.qtys).toEqual({ a: 1, b: 2 });
    expect(p2.itemRefs).toEqual(['a', 'b']);
    expect(p2.qtys).toEqual({ a: 1, b: 1 });
  });

  it('preserves total units exactly across all payers', () => {
    const items = [
      cartItem({ subProductId: 'a', price: 5000, quantity: 2 }),
      cartItem({ subProductId: 'b', price: 2000, quantity: 3 }),
      cartItem({ subProductId: 'c', price: 800, quantity: 7 }),
      cartItem({
        subProductId: 'd',
        sizeId: 'sz1',
        price: 1500,
        quantity: 4,
      }),
    ];

    const groups = splitEqually(items, posItemKey, 3);

    expect(groups).toHaveLength(3);
    for (const item of items) {
      const key = posItemKey(item);
      const allocated = groups.reduce(
        (s, g) => s + (g.qtys?.[key] ?? 0),
        0
      );
      expect(allocated).toBe(item.quantity);
    }
  });

  it('spreads an indivisible high-price line one unit at a time', () => {
    // One line, 3 units, 3 payers → each payer receives exactly 1 unit.
    const items = [cartItem({ subProductId: 'dom', price: 10000, quantity: 3 })];

    const groups = splitEqually(items, posItemKey, 3);

    expect(groups.map((g) => g.qtys?.['dom'])).toEqual([1, 1, 1]);
  });

  it('labels payers Payer 1..N with stable ids', () => {
    const items = [cartItem({ quantity: 4 })];

    const groups = splitEqually(items, posItemKey, 4);

    expect(groups.map((g) => g.label)).toEqual([
      'Payer 1',
      'Payer 2',
      'Payer 3',
      'Payer 4',
    ]);
    expect(groups.map((g) => g.id)).toEqual(['payer-1', 'payer-2', 'payer-3', 'payer-4']);
  });

  it('leaves trailing groups empty when there are fewer units than payers', () => {
    // The modal clamps its stepper; the helper stays honest about the math.
    const items = [cartItem({ subProductId: 'only', quantity: 1 })];

    const groups = splitEqually(items, posItemKey, 3);

    expect(groups[0].qtys).toEqual({ only: 1 });
    expect(groups[1].itemRefs).toEqual([]);
    expect(groups[2].itemRefs).toEqual([]);
  });

  it('orders allocation by the injected unit price accessor, not raw price', () => {
    // Raw prices are equal; effective pricing makes "expensive" cost more.
    // With effective desc order: exp,exp,cheap → P1: exp,cheap P2: exp
    const items = [
      cartItem({ subProductId: 'cheap', price: 1000, quantity: 1 }),
      cartItem({ subProductId: 'expensive', price: 1000, quantity: 2 }),
    ];
    const effective = (i: POSCartItem) =>
      i.subProductId === 'expensive' ? 9000 : 1000;

    const [p1, p2] = splitEqually(items, posItemKey, 2, effective);

    expect(p1.qtys).toEqual({ expensive: 1, cheap: 1 });
    expect(p2.qtys).toEqual({ expensive: 1 });
  });
});

describe('validateGroups', () => {
  const items = [
    cartItem({ subProductId: 'a', quantity: 2 }),
    cartItem({ subProductId: 'b', quantity: 1 }),
  ];

  it('passes when every cart line is assigned exactly once', () => {
    const groups = [
      { id: 'payer-1', label: 'Payer 1', itemRefs: ['a'] },
      { id: 'payer-2', label: 'Payer 2', itemRefs: ['b'] },
    ];

    expect(validateGroups(groups, posItemKey, items)).toEqual({ ok: true });
  });

  it('rejects a key assigned to more than one payer', () => {
    const groups = [
      { id: 'payer-1', label: 'Payer 1', itemRefs: ['a'] },
      { id: 'payer-2', label: 'Payer 2', itemRefs: ['a'] },
    ];

    const result = validateGroups(groups, posItemKey, items);

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/more than once/);
  });

  it('rejects uncovered items when settling all', () => {
    const groups = [{ id: 'payer-1', label: 'Payer 1', itemRefs: ['a'] }];

    const result = validateGroups(groups, posItemKey, items);

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/assigned/);
  });

  it('allows uncovered items when settling selected lines only', () => {
    const groups = [{ id: 'payer-1', label: 'Payer 1', itemRefs: ['a'] }];

    const result = validateGroups(groups, posItemKey, items, {
      requireFullCoverage: false,
    });

    expect(result.ok).toBe(true);
  });

  it('rejects an allocation with nothing assigned', () => {
    const groups = [
      { id: 'payer-1', label: 'Payer 1', itemRefs: [] },
      { id: 'payer-2', label: 'Payer 2', itemRefs: [] },
    ];

    const result = validateGroups(groups, posItemKey, items);

    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('rejects equal-split quantities exceeding the line quantity', () => {
    const groups = [
      {
        id: 'payer-1',
        label: 'Payer 1',
        itemRefs: ['a'],
        qtys: { a: 3 }, // line a only has 2 units
      },
      { id: 'payer-2', label: 'Payer 2', itemRefs: [] },
    ];

    const result = validateGroups(groups, posItemKey, items, {
      requireFullCoverage: false,
    });

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/quantity/i);
  });
});

describe('groupsToOrderPayloads', () => {
  const items = [
    cartItem({
      subProductId: 'a',
      name: 'Champagne',
      price: 5000,
      quantity: 5,
      sizeId: 'sz1',
    }),
    cartItem({ subProductId: 'b', name: 'Beer', price: 2000, quantity: 3 }),
  ];

  it('maps whole lines when no quantities are given (by-item mode)', () => {
    const groups = [
      { id: 'payer-1', label: 'Payer 1', itemRefs: ['a_sz1'] },
      { id: 'payer-2', label: 'Payer 2', itemRefs: ['b'] },
    ];

    const [p1, p2] = groupsToOrderPayloads(groups, items);

    expect(p1.items).toHaveLength(1);
    expect(p1.items[0].name).toBe('Champagne');
    expect(p1.items[0].quantity).toBe(5);
    expect(p1.items[0].sizeId).toBe('sz1');
    expect(p2.items[0].subProductId).toBe('b');
    expect(p2.items[0].quantity).toBe(3);
  });

  it('applies allocated quantities when present (equal mode)', () => {
    const groups = [
      { id: 'payer-1', label: 'Payer 1', itemRefs: ['a_sz1'], qtys: { a_sz1: 2 } },
      { id: 'payer-2', label: 'Payer 2', itemRefs: ['a_sz1'], qtys: { a_sz1: 3 } },
    ];

    const [p1, p2] = groupsToOrderPayloads(groups, items);

    expect(p1.items[0].quantity).toBe(2);
    expect(p2.items[0].quantity).toBe(3);
  });

  it('carries the source group so callers can label toasts/receipts', () => {
    const groups = [{ id: 'payer-1', label: 'Payer 1', itemRefs: ['a_sz1'] }];

    const [p1] = groupsToOrderPayloads(groups, items);

    expect(p1.group.id).toBe('payer-1');
    expect(p1.group.label).toBe('Payer 1');
  });

  it('skips refs that match no cart line and keeps group order', () => {
    const groups = [
      { id: 'payer-1', label: 'Payer 1', itemRefs: ['ghost'] },
      {
        id: 'payer-2',
        label: 'Payer 2',
        itemRefs: ['b', 'a_sz1'],
        qtys: { b: 1, a_sz1: 1 },
      },
    ];

    const payloads = groupsToOrderPayloads(groups, items);

    expect(payloads).toHaveLength(2);
    expect(payloads[0].items).toHaveLength(0);
    expect(payloads[1].items.map((i) => i.subProductId)).toEqual(['b', 'a']);
    expect(payloads[1].items.map((i) => i.quantity)).toEqual([1, 1]);
  });
});
