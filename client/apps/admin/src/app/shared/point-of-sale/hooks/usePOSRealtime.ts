'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { io, type Socket } from 'socket.io-client';
import toast from 'react-hot-toast';
import {
  usePOSAuth,
  usePOSShopScope,
  usePOSRealtimeTick,
  usePOSNotifications,
} from '@/app/shared/point-of-sale/store';
import { announceIncomingOrders } from '@/app/shared/point-of-sale/pos-order-announce';
import type { POSNotification } from '@/app/shared/point-of-sale/types';
import { routes } from '@/config/routes';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

/**
 * Live session feed for the sell terminal.
 *
 * Subscribes this device to its tenant+terminal room and reacts when another
 * device changes shared state:
 *   – session closed elsewhere → the till is no longer in a session, so it
 *     goes to the lock screen. Selling on after a close would be exactly what
 *     closing is meant to prevent.
 *   – cashier switched / session opened / order created → bump the realtime
 *     tick that session views refetch on.
 *   – marketplace:new_order → a customer just bought this tenant's stock on
 *     the main platform — pop it for the cashier and feed the bell store.
 *
 * Everything degrades to today's behaviour when the socket never connects
 * (offline terminal, serverless deploy without websockets): REST polling and
 * explicit refreshes still drive every screen.
 */
export function usePOSRealtime() {
  const { shopId } = usePOSShopScope();
  const { token, terminal } = usePOSAuth();
  const router = useRouter();
  const { bumpRealtimeTick } = usePOSRealtimeTick();
  const { addNotifications } = usePOSNotifications();

  useEffect(() => {
    if (!token) return;

    const socket: Socket = io(API_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionDelayMax: 15_000,
    });

    socket.on('connect', () => {
      // Re-join after every (re)connect — rooms are per-connection.
      socket.emit('pos:join', { shopId });
    });

    socket.on('session:closed', () => {
      toast('Session was closed on another device', { icon: '🔒' });
      router.replace(`${routes.pos.lock}?terminal=${terminal ?? 'retail'}`);
    });

    socket.on('session:cashier_switched', (payload?: { cashierName?: string }) => {
      if (payload?.cashierName) {
        toast(`Cashier switched to ${payload.cashierName}`, { icon: '👤' });
      }
      bumpRealtimeTick();
    });

    socket.on('session:opened', () => bumpRealtimeTick());
    socket.on('order:created', () => bumpRealtimeTick());

    // A marketplace order just landed for this tenant — pop it for the
    // cashier immediately and feed the bell store so the badge is current.
    // The payload shape mirrors getPOSNotifications rows (POSNotification).
    socket.on('marketplace:new_order', (payload?: POSNotification) => {
      if (payload) announceIncomingOrders([payload], { addNotifications });
      bumpRealtimeTick();
    });

    return () => {
      socket.disconnect();
    };
  }, [token, terminal, shopId, router, bumpRealtimeTick, addNotifications]);
}
