'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import toast from 'react-hot-toast';
import { posApi } from '@/app/shared/point-of-sale/api';
import { usePOSAuth } from '@/app/shared/point-of-sale/store';
import type { KitchenOrder, KitchenRoundStatus } from '../types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
const POLL_MS = 15_000;

/**
 * Live feed for the kitchen display: the full board of active fired rounds.
 *
 * Two drivers, one source of truth — a 15s poll keeps the board honest when
 * websockets can't connect (same degrade path as the sell terminal), and the
 * `kds:<tenantId>` socket room makes every fire/bump elsewhere land the
 * moment it happens. The room is joined with `kds:join`; the tenant comes
 * from the verified POS token server-side, never from the client.
 *
 * Bumps are deliberately NOT optimistic: tap → server validates the
 * forward-only transition → refetch regardless. A rejected bump (stale
 * screen, already bumped by another display) simply snaps back on refresh,
 * and the reason surfaces as a toast instead of silently vanishing.
 */
export function useKdsFeed() {
  const { token } = usePOSAuth();
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number | null>(null);
  const tokenRef = useRef(token);
  tokenRef.current = token;

  const refresh = useCallback(async () => {
    const t = tokenRef.current;
    if (!t) return;
    setLoading(true);
    try {
      const data = await posApi.getKitchenActive(t);
      setOrders(data.orders);
      setLastRefreshedAt(Date.now());
    } finally {
      setLoading(false);
    }
  }, []);

  // Poll while signed in; refresh is stable so this only re-arms per login.
  useEffect(() => {
    if (!token) {
      setOrders([]);
      setLastRefreshedAt(null);
      return;
    }
    const safeRefresh = () => {
      // Poll failures stay quiet — the connection dot + stale "updated" time
      // already tell the kitchen the feed is down; toasting every 15s would
      // just train staff to ignore toasts.
      refresh().catch(() => {});
    };
    safeRefresh();
    const id = setInterval(safeRefresh, POLL_MS);
    return () => clearInterval(id);
  }, [token, refresh]);

  useEffect(() => {
    if (!token) return;

    const socket: Socket = io(API_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionDelayMax: 15_000,
    });

    socket.on('connect', () => {
      setConnected(true);
      // Re-join after every (re)connect — rooms are per-connection.
      socket.emit('kds:join');
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('kds:update', () => {
      refresh().catch(() => {});
    });

    return () => {
      setConnected(false);
      socket.disconnect();
    };
  }, [token, refresh]);

  const bumpRound = useCallback(
    async (orderId: string, roundNo: number, nextStatus: KitchenRoundStatus) => {
      const t = tokenRef.current;
      if (!t) return;
      try {
        await posApi.bumpKitchenRound(t, { orderId, roundNo, nextStatus });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not update the round');
      } finally {
        // Even a failed bump changes nothing locally — refetch reconciles
        // against whatever the board actually looks like now.
        refresh().catch(() => {});
      }
    },
    [refresh]
  );

  return { orders, loading, connected, lastRefreshedAt, refresh, bumpRound };
}
