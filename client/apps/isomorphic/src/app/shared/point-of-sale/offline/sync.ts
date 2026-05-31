import { posDb } from './db';
import type { QueueEntry } from './db';
import { posApi } from '../api';
import { getProducts } from './api';

export type SyncResult =
  | { ok: true; synced: number }
  | { ok: false; error: string };

let _syncRunning = false;

export async function runSyncEngine(token?: string): Promise<SyncResult> {
  if (_syncRunning) return { ok: true, synced: 0 };
  _syncRunning = true;
  let synced = 0;

  try {
    const pending = await posDb.offlineQueue
      .where('status')
      .equals('pending')
      .sortBy('createdAt');

    for (const entry of pending) {
      await posDb.offlineQueue.update(entry.id!, { status: 'syncing' });
      const t = (entry.payload as any)._token ?? token ?? '';

      try {
        if (entry.type === 'order') {
          const { _token, ...body } = entry.payload as any;
          const data = await posApi.createOrder(t, body);
          if (data?.order) await posDb.orders.put(data.order);
          await posDb.stockAdjust.where('queueId').equals(entry.id!).delete();
          await posDb.offlineQueue.delete(entry.id!);
          synced++;
        } else if (entry.type === 'refund') {
          const { _token, orderId, items, reason, refundPaymentMethod } =
            entry.payload as any;
          await posApi.refundOrder(
            t,
            orderId,
            items,
            reason,
            refundPaymentMethod
          );
          await posDb.offlineQueue.delete(entry.id!);
          synced++;
        } else if (entry.type === 'void') {
          const { _token, orderId, reason } = entry.payload as any;
          await posApi.voidOrder(t, orderId, reason);
          await posDb.offlineQueue.delete(entry.id!);
          synced++;
        }
      } catch (err: any) {
        const status = err?.response?.status ?? err?.status ?? 0;
        const isConflict = status === 409 || status === 422;
        const newRetries = (entry.retries ?? 0) + 1;

        if (isConflict || newRetries >= 3) {
          await posDb.offlineQueue.update(entry.id!, {
            status: 'failed',
            retries: newRetries,
            errorMessage: err?.message ?? String(err),
          });
        } else {
          await posDb.offlineQueue.update(entry.id!, {
            status: 'pending',
            retries: newRetries,
          });
          break;
        }
      }
    }

    if (typeof navigator !== 'undefined' && navigator.onLine && token) {
      try {
        await getProducts(token);
      } catch {
        // best-effort refresh
      }
    }
  } finally {
    _syncRunning = false;
  }

  return { ok: true, synced };
}

export async function registerBackgroundSync(): Promise<void> {
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    const reg = await navigator.serviceWorker.ready;
    await (reg as any).sync.register('pos-queue-sync');
  }
}

export async function getPendingCount(): Promise<number> {
  return posDb.offlineQueue.where('status').equals('pending').count();
}

export async function getFailedEntries(): Promise<QueueEntry[]> {
  return posDb.offlineQueue.where('status').equals('failed').toArray();
}
