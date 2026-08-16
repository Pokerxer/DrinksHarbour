// Replaying a POS sale made against a quotation while the network was down.
//
// The POS is an installed PWA that sells offline: `createOrder` queues and
// replays. Reconcile had no such path — it was a bare `posApi.reconcileSalesOrder`
// fired after payment, non-blocking, with a `fulfillStatus: 'error'` shown once
// and then lost. Sell against a quotation with the network down and the sale
// landed but the Sales Order stayed open forever, with nothing recording that it
// should not have.
//
// Queueing rather than refusing to load a quotation offline, because refusing
// breaks the one case the offline POS exists for. See
// docs/superpowers/plans/2026-08-16-pos-fulfill-quotes.md §4.

import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { QueueEntry } from './db';

const calls: string[] = [];
let queue: QueueEntry[] = [];

vi.mock('./db', () => {
  const table = {
    where: (field: string) => ({
      equals: (value: unknown) => ({
        sortBy: async (key: string) =>
          queue
            .filter((e) => (e as any)[field] === value)
            .sort((a, b) => String((a as any)[key]).localeCompare(String((b as any)[key]))),
        delete: async () => {},
        count: async () => queue.filter((e) => (e as any)[field] === value).length,
        toArray: async () => queue.filter((e) => (e as any)[field] === value),
      }),
    }),
    update: async (id: number, patch: Partial<QueueEntry>) => {
      const e = queue.find((q) => q.id === id);
      if (e) Object.assign(e, patch);
    },
    delete: async (id: number) => {
      queue = queue.filter((q) => q.id !== id);
    },
    put: async () => {},
  };
  return { posDb: { offlineQueue: table, orders: table, stockAdjust: table } };
});

vi.mock('../api', () => ({
  posApi: {
    createOrder: async () => {
      calls.push('createOrder');
      return { order: { _id: 'o1' } };
    },
    refundOrder: async () => {
      calls.push('refundOrder');
    },
    voidOrder: async () => {
      calls.push('voidOrder');
    },
    reconcileSalesOrder: async (_t: string, id: string, body: any) => {
      calls.push(`reconcileSalesOrder:${id}:${body.ref}`);
      return {};
    },
  },
}));

vi.mock('./api', () => ({ getProducts: async () => [] }));

import { runSyncEngine } from './sync';
import { posApi } from '../api';

function entry(over: Partial<QueueEntry> & { id: number }): QueueEntry {
  return {
    type: 'order',
    payload: { _token: 't' },
    createdAt: '2026-08-16T10:00:00.000Z',
    status: 'pending',
    retries: 0,
    ...over,
  } as QueueEntry;
}

beforeEach(() => {
  calls.length = 0;
  queue = [];
});

describe('runSyncEngine — reconcile', () => {
  test('replays a queued reconcile against the linked sales order', () => {
    queue = [
      entry({
        id: 1,
        type: 'reconcile',
        payload: {
          _token: 't',
          salesOrderId: 'so1',
          paymentMethod: 'cash',
          ref: 'OFFLINE-1',
          items: [{ subProductId: 'sp1', sizeId: 'sz1', quantity: 3 }],
        },
      }),
    ];

    return runSyncEngine('t').then((result) => {
      expect(calls).toEqual(['reconcileSalesOrder:so1:OFFLINE-1']);
      expect(result).toEqual({ ok: true, synced: 1 });
      expect(queue).toHaveLength(0);
    });
  });

  test('replays after the sale it belongs to, never before it', async () => {
    // The queue is drained in createdAt order, so a reconcile queued right after
    // its order arrives at the server after it. A reconcile that overtook its
    // own sale would mark the order fulfilled for stock that had not moved yet.
    queue = [
      entry({ id: 2, type: 'reconcile', createdAt: '2026-08-16T10:00:01.000Z',
        payload: { _token: 't', salesOrderId: 'so1', ref: 'OFFLINE-1', items: [] } }),
      entry({ id: 1, type: 'order', createdAt: '2026-08-16T10:00:00.000Z' }),
    ];

    await runSyncEngine('t');

    expect(calls).toEqual(['createOrder', 'reconcileSalesOrder:so1:OFFLINE-1']);
  });

  test('a reconcile the server rejects is parked as failed, not retried forever', async () => {
    vi.spyOn(posApi, 'reconcileSalesOrder').mockRejectedValueOnce(
      Object.assign(new Error('Order already fulfilled'), { status: 409 })
    );

    queue = [
      entry({ id: 1, type: 'reconcile',
        payload: { _token: 't', salesOrderId: 'so1', ref: 'OFFLINE-1', items: [] } }),
    ];

    await runSyncEngine('t');

    expect(queue[0].status).toBe('failed');
    expect(queue[0].errorMessage).toBe('Order already fulfilled');
  });
});
