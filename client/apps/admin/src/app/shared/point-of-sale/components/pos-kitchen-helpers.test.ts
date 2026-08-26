import { describe, expect, it } from 'vitest';
import {
  groupRoundsByColumn,
  roundElapsedLabel,
  isRoundLate,
} from './pos-kitchen-helpers';
import type { KitchenOrder, KitchenRound } from '../types';

function round(over: Partial<KitchenRound> = {}): KitchenRound {
  return {
    roundNo: over.roundNo ?? 1,
    items: over.items ?? [
      { key: 'sub1', name: 'Heineken', variant: '330ml', quantity: 2 },
    ],
    firedAt: over.firedAt ?? '2026-08-26T18:00:00Z',
    status: over.status ?? 'pending',
  };
}

function order(over: Partial<KitchenOrder> & { rounds?: KitchenRound[] } = {}): KitchenOrder {
  return {
    orderId: over.orderId ?? 'order-a',
    tableName: over.tableName ?? 'T5',
    guests: over.guests ?? 2,
    openedAt: over.openedAt ?? '2026-08-26T17:00:00Z',
    rounds: over.rounds ?? [round()],
  };
}

describe('groupRoundsByColumn', () => {
  it('buckets rounds from multiple orders into their status columns, preserving server order', () => {
    const orders = [
      order({
        orderId: 'o1',
        tableName: 'T1',
        rounds: [round({ roundNo: 1, status: 'pending' })],
      }),
      order({
        orderId: 'o2',
        tableName: 'T2',
        rounds: [
          round({ roundNo: 1, status: 'preparing' }),
          round({ roundNo: 2, status: 'pending' }),
        ],
      }),
      order({
        orderId: 'o3',
        tableName: null,
        rounds: [round({ roundNo: 1, status: 'ready' }), round({ roundNo: 2, status: 'ready' })],
      }),
    ];

    const cols = groupRoundsByColumn(orders);

    expect(cols.pending.map((c) => `${c.order.orderId}#${c.round.roundNo}`)).toEqual([
      'o1#1',
      'o2#2',
    ]);
    expect(cols.preparing.map((c) => c.order.orderId)).toEqual(['o2']);
    expect(cols.ready.map((c) => `${c.order.orderId}#${c.round.roundNo}`)).toEqual([
      'o3#1',
      'o3#2',
    ]);
  });

  it('carries the owning order onto every flattened card', () => {
    const o = order({ orderId: 'own', tableName: 'Patio', guests: 4 });
    const cols = groupRoundsByColumn([o]);
    expect(cols.pending[0].order).toBe(o);
    expect(cols.pending[0].round.roundNo).toBe(1);
  });

  it('excludes served rounds even if the server ever sent them', () => {
    const orders = [
      order({
        orderId: 'o1',
        rounds: [round({ roundNo: 1, status: 'served' }), round({ roundNo: 2, status: 'pending' })],
      }),
      order({ orderId: 'o2', rounds: [round({ roundNo: 1, status: 'served' })] }),
    ];

    const cols = groupRoundsByColumn(orders);

    expect(cols.pending.map((c) => c.order.orderId)).toEqual(['o1']);
    expect(cols.preparing).toHaveLength(0);
    expect(cols.ready).toHaveLength(0);
  });

  it('returns empty columns for empty or malformed input', () => {
    expect(groupRoundsByColumn([])).toEqual({
      pending: [],
      preparing: [],
      ready: [],
    });
    expect(groupRoundsByColumn(undefined as never)).toEqual({
      pending: [],
      preparing: [],
      ready: [],
    });
  });

  it('ignores unknown statuses rather than throwing', () => {
    const orders = [order({ rounds: [round({ status: 'wat' as never })] })];
    const cols = groupRoundsByColumn(orders);
    expect(cols.pending).toHaveLength(0);
    expect(cols.preparing).toHaveLength(0);
    expect(cols.ready).toHaveLength(0);
  });
});

describe('roundElapsedLabel', () => {
  const now = Date.parse('2026-08-26T18:00:00Z');

  it('shows whole minutes under an hour', () => {
    expect(roundElapsedLabel('2026-08-26T17:56:00Z', now)).toBe('4m');
  });

  it('floors partial minutes', () => {
    expect(roundElapsedLabel('2026-08-26T17:59:30Z', now)).toBe('0m');
  });

  it('pads the minute part once hours are showing', () => {
    expect(roundElapsedLabel('2026-08-26T16:57:00Z', now)).toBe('1h 03m');
    expect(roundElapsedLabel('2026-08-26T15:00:00Z', now)).toBe('3h 00m');
  });

  it('clamps a future fire time to zero rather than going negative', () => {
    expect(roundElapsedLabel('2026-08-26T18:05:00Z', now)).toBe('0m');
  });

  it('returns empty for an unusable timestamp', () => {
    expect(roundElapsedLabel('', now)).toBe('');
    expect(roundElapsedLabel('not-a-date', now)).toBe('');
  });
});

describe('isRoundLate', () => {
  const now = Date.parse('2026-08-26T18:10:00Z');

  it('is not late before the alert window elapses', () => {
    expect(isRoundLate('2026-08-26T18:04:00Z', 10, now)).toBe(false);
  });

  it('is late exactly at the alert boundary', () => {
    expect(isRoundLate('2026-08-26T18:00:00Z', 10, now)).toBe(true);
  });

  it('is late past the alert boundary', () => {
    expect(isRoundLate('2026-08-26T17:55:00Z', 10, now)).toBe(true);
  });

  it('honours a custom alert window', () => {
    expect(isRoundLate('2026-08-26T18:04:00Z', 5, now)).toBe(true);
  });

  it('is never late for an unusable timestamp', () => {
    expect(isRoundLate('not-a-date', 10, now)).toBe(false);
  });
});
