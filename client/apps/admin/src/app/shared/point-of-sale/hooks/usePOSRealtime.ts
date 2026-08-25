'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { io, type Socket } from 'socket.io-client';
import toast from 'react-hot-toast';
import {
  usePOSAuth,
  usePOSRealtimeTick,
} from '@/app/shared/point-of-sale/store';
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
 *
 * Everything degrades to today's behaviour when the socket never connects
 * (offline terminal, serverless deploy without websockets): REST polling and
 * explicit refreshes still drive every screen.
 */
export function usePOSRealtime() {
  const { token, terminal } = usePOSAuth();
  const router = useRouter();
  const { bumpRealtimeTick } = usePOSRealtimeTick();

  useEffect(() => {
    if (!token) return;

    const socket: Socket = io(API_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionDelayMax: 15_000,
    });

    socket.on('connect', () => {
      // Re-join after every (re)connect — rooms are per-connection.
      socket.emit('pos:join', { terminalType: terminal ?? 'retail' });
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

    return () => {
      socket.disconnect();
    };
  }, [token, terminal, router, bumpRealtimeTick]);
}
