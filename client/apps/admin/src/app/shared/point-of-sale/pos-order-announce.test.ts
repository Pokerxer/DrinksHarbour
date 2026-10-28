import { describe, expect, it, vi } from 'vitest';

vi.mock('react-hot-toast', () => {
  const toast = vi.fn();
  (toast as unknown as { custom: unknown }).custom = vi.fn();
  return { default: toast };
});
import toast from 'react-hot-toast';
import { announceIncomingOrders } from './pos-order-announce';
import type { POSNotification } from './types';

const n = (id: string, over: Partial<POSNotification> = {}): POSNotification => ({
  _id: id,
  orderNumber: 'DH-1001',
  placedAt: new Date().toISOString(),
  total: 45000,
  source: 'web',
  status: 'processing',
  customer: 'Ada Obi',
  itemCount: 2,
  items: [{ name: 'Zenith Red 75cl', qty: 2, subtotal: 45000 }],
  ...over,
});

describe('announceIncomingOrders', () => {
  it('toasts and stores only genuinely new orders', () => {
    const add = vi.fn();
    const fresh = announceIncomingOrders([n('a1')], { addNotifications: add });
    expect(fresh).toHaveLength(1);
    expect(add).toHaveBeenCalledWith([expect.objectContaining({ _id: 'a1' })]);
    expect(toast).toHaveBeenCalledTimes(1);
  });

  it('is idempotent — the same id never toasts or stores twice', () => {
    const add = vi.fn();
    expect(announceIncomingOrders([n('a1')], { addNotifications: add })).toHaveLength(0);
    expect(add).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledTimes(1);
  });

  it('skips malformed entries without throwing', () => {
    expect(() =>
      announceIncomingOrders([
        null as unknown as POSNotification,
        { _id: '' } as POSNotification,
      ])
    ).not.toThrow();
  });
});
