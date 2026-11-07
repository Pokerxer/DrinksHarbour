'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { KioskProduct } from './types';
import {
  addQueue,
  flushQueue,
  loadBook,
  lookupBook,
  saveBook,
  type OfflineBook,
} from './offline';
import type { OfflineSupport } from './use-kiosk';

const REFRESH_MS = 600_000;

/**
 * Owns the kiosk's offline pricebook + scan queue. The hook fetches the book
 * while the kiosk is live, refreshes it every 10 minutes and whenever the
 * browser regains connectivity, and drains the queue through the server's
 * batched /sync endpoint.
 */
export function useOfflineBook(slug: string) {
  const [book, setBook] = useState<OfflineBook | null>(() => loadBook(slug));

  const refresh = useCallback(async () => {
    try {
      const controller = new AbortController();
      const response = await fetch(
        `/api/price-checker/${encodeURIComponent(slug)}/book`,
        {
          credentials: 'same-origin',
          cache: 'no-store',
          signal: controller.signal,
        }
      );
      if (!response.ok) return; // keep the cached book honest about its age
      const payload = (await response.json().catch(() => null)) as {
        data?: unknown;
      } | null;
      if (payload?.data && saveBook(slug, payload.data as never))
        setBook(loadBook(slug));
    } catch {
      /* offline — the stale cache keeps serving */
    }
  }, [slug]);

  const flush = useCallback(
    () => flushQueue(slug),
    [slug]
  );

  useEffect(() => {
    const backOnline = () => {
      void refresh();
      void flush();
    };
    window.addEventListener('online', backOnline);
    const timer = window.setInterval(() => void refresh(), REFRESH_MS);
    void refresh();
    void flush();
    return () => {
      window.removeEventListener('online', backOnline);
      window.clearInterval(timer);
    };
  }, [refresh, flush]);

  const support: OfflineSupport | null = book
    ? {
        generatedAt: book.generatedAt,
        config: book.config,
        lookup: (barcode: string) =>
          (lookupBook(book.items, barcode) as KioskProduct | null) ?? null,
        onOfflineScan: (record) => {
          addQueue(slug, record);
        },
      }
    : null;
  return { book, support, refresh, flush };
}
