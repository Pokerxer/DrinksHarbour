'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { KioskProduct } from './types';
import {
  addQueue,
  flushQueue,
  loadBook,
  lookupBook,
  parseBook,
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
export function useOfflineBook(slug: string, enabled = true) {
  const [book, setBook] = useState<OfflineBook | null>(() => loadBook(slug));

  const refresh = useCallback(async () => {
    if (!slug) return;
    try {
      const response = await fetch(
        `/api/price-checker/${encodeURIComponent(slug)}/book`,
        {
          credentials: 'same-origin',
          cache: 'no-store',
          signal: AbortSignal.timeout(15000),
        }
      );
      if (!response.ok) return; // keep the cached book honest about its age
      const payload = (await response.json().catch(() => null)) as {
        data?: unknown;
      } | null;
      const next = parseBook(slug, payload?.data);
      if (!next) return;
      saveBook(slug, next);
      setBook(next);
    } catch {
      /* offline — the stale cache keeps serving */
    }
  }, [slug]);

  const flush = useCallback(
    () => flushQueue(slug),
    [slug]
  );

  useEffect(() => {
    if (!slug || !enabled) return;
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
  }, [slug, enabled, refresh, flush]);

  const activeBook = book?.config.slug === slug ? book : null;
  const support: OfflineSupport | null = activeBook
    ? {
        generatedAt: activeBook.generatedAt,
        config: activeBook.config,
        lookup: (barcode: string) => {
          const item = lookupBook(activeBook.items, barcode);
          if (!item) return null;
          const product: KioskProduct = { ...item };
          if (!activeBook.config.settings.displayBarcode) delete product.barcode;
          return product;
        },
        unavailable: (barcode) => activeBook.unavailableBarcodes?.includes(barcode) ?? false,
        onOfflineScan: (record) => {
          addQueue(slug, record);
        },
      }
    : null;
  return { book: activeBook, support, refresh, flush };
}
