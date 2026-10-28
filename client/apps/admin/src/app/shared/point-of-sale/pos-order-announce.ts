'use client';

import toast from 'react-hot-toast';
import type { POSNotification } from './types';

/**
 * Announce marketplace orders that just arrived.
 *
 * Both delivery paths converge here: the websocket event
 * (`marketplace:new_order`, instant) and the bell's 30s poll (the fallback
 * for serverless deploys without websockets). The announced-set makes the two
 * paths idempotent — the same order can never toast twice in one page load.
 * The set is module-level on purpose: it survives re-renders but not reloads,
 * which is exactly the window in which a duplicate could occur.
 */
const announcedOrderIds = new Set<string>();

export function announceIncomingOrders(
  incoming: POSNotification[],
  opts: { addNotifications?: (list: POSNotification[]) => void } = {}
): POSNotification[] {
  const fresh = incoming.filter((n) => n?._id && !announcedOrderIds.has(n._id));
  fresh.forEach((n) => announcedOrderIds.add(n._id));

  if (opts.addNotifications && fresh.length) {
    try {
      opts.addNotifications(fresh);
    } catch {
      // a store problem must never break the sell screen
    }
  }

  fresh.forEach((n) => {
    const total =
      typeof n.total === 'number'
        ? ` · ₦${n.total.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`
        : '';
    toast(
      `New online order #${n.orderNumber} · ${n.itemCount} item${n.itemCount !== 1 ? 's' : ''}${total} — see the bell for details`,
      { icon: '🛒', duration: 8000 }
    );
  });

  return fresh;
}
