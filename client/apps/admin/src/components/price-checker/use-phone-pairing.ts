'use client';
import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { KioskProduct } from './types';

/**
 * Joins the kiosk's phone-pairing room so a customer's phone camera can feed
 * bottles to the kiosk's price result. Purely consumer-grade: the
 * pairing session id carried in the QR URL is the only credential, the room
 * receives only public product payloads, and a failed connect simply means
 * the customer's phone keeps working on its own.
 */
export function usePhonePairing(
  apiUrl: string,
  session: string,
  onScan: (product: KioskProduct) => void
) {
  const [connected, setConnected] = useState(false);
  const scan = useRef(onScan);
  scan.current = onScan;
  useEffect(() => {
    if (!apiUrl) return;
    let disposed = false;
    let socket: Socket | undefined;
    const controller = new AbortController();
    const probe = setTimeout(() => controller.abort(), 5000);
    void (async () => {
      try {
        const response = await fetch(`${apiUrl}/realtime-status`, {
          signal: controller.signal,
          credentials: 'omit',
          cache: 'no-store',
        });
        if (!response.ok || disposed) return;
        const status: unknown = await response.json();
        if (
          !status ||
          typeof status !== 'object' ||
          !('available' in status) ||
          (status as { available: unknown }).available !== true
        )
          return;
        socket = io(apiUrl, {
          transports: ['websocket', 'polling'],
          reconnectionAttempts: 3,
          reconnectionDelay: 5000,
          timeout: 5000,
        });
        socket.on('connect', () => {
          if (disposed) return;
          setConnected(true);
          socket?.emit('pkiosk:join', session);
        });
        socket.on('connect_error', () => setConnected(false));
        socket.on('kiosk:scan', (payload: { found?: boolean; product?: KioskProduct }) => {
          if (payload?.found && payload.product) scan.current(payload.product);
        });
      } catch {
        /* pairing is optional — the kiosk works without it */
      }
    })();
    return () => {
      disposed = true;
      clearTimeout(probe);
      controller.abort();
      socket?.disconnect();
    };
  }, [apiUrl, session]);
  return { connected };
}
