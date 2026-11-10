'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { KioskProduct } from './types';

export const MAX_COMPARE_ITEMS = 4;

/** Identity within the tray: barcode when known, name+size otherwise. */
export function compareKey(product: KioskProduct): string {
  return product.barcode || `${product.name}|${product.size || ''}`;
}

export function addCompareItem(
  items: KioskProduct[],
  product: KioskProduct
): KioskProduct[] {
  const key = compareKey(product);
  if (items.some((item) => compareKey(item) === key)) return items;
  if (items.length >= MAX_COMPARE_ITEMS) return items;
  return [...items, product];
}

export function removeCompareItem(
  items: KioskProduct[],
  key: string
): KioskProduct[] {
  return items.filter((item) => compareKey(item) !== key);
}

/** The tray is full — trade the oldest-held bottle for the new scan. */
export function replaceOldest(
  items: KioskProduct[],
  product: KioskProduct
): KioskProduct[] {
  if (!items.length) return [product];
  return [...items.slice(1), product];
}

/** Swap the keyed entry in place (order preserved). Unknown key: no-op. */
export function replaceByKey(
  items: KioskProduct[],
  product: KioskProduct,
  key: string
): KioskProduct[] {
  return items.map((item) => (compareKey(item) === key ? product : item));
}

const storageKey = (slug: string) => `price-checker-compare-${slug}`;

function readStored(slug: string): KioskProduct[] {
  try {
    const list: unknown = JSON.parse(
      sessionStorage.getItem(storageKey(slug)) || '[]'
    );
    if (!Array.isArray(list)) return [];
    return list
      .filter(
        (row): row is KioskProduct =>
          !!row &&
          typeof row === 'object' &&
          typeof (row as KioskProduct).name === 'string' &&
          typeof (row as KioskProduct).price === 'number'
      )
      .slice(0, MAX_COMPARE_ITEMS);
  } catch {
    return [];
  }
}

/**
 * The temporary tray of scanned bottles the customer wants to compare.
 * Holds up to MAX_COMPARE_ITEMS entries, survives kiosk auto-resets via
 * sessionStorage, and never reaches the server's persistent stores.
 * `swapKey` (armed via the tray's ⇄) redirects the next add/phone scan into
 * an in-place replacement of that entry.
 */
export function useCompare(slug: string) {
  const [items, setItems] = useState<KioskProduct[]>(() => readStored(slug));
  const [swapKey, setSwapKey] = useState<string | null>(null);
  const swapKeyRef = useRef(swapKey);
  swapKeyRef.current = swapKey;
  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey(slug), JSON.stringify(items));
    } catch {
      /* private mode — the tray simply lives in memory */
    }
  }, [slug, items]);
  const add = useCallback(
    (product: KioskProduct) => {
      setItems((list) => {
        const armed = swapKeyRef.current;
        if (armed) {
          const targetIndex = list.findIndex((item) => compareKey(item) === armed);
          if (targetIndex < 0) {
            swapKeyRef.current = null;
            return addCompareItem(list, product);
          }
          // Another held bottle with the same key? Treat as a plain duplicate.
          const others = list.filter((_, index) => index !== targetIndex);
          if (others.some((item) => compareKey(item) === compareKey(product)))
            return list;
          const replaced = product;
          swapKeyRef.current = null;
          setTimeout(() => setSwapKey(null), 0);
          return list.map((item, index) => (index === targetIndex ? replaced : item));
        }
        return addCompareItem(list, product);
      });
    },
    []
  );
  const remove = useCallback(
    (key: string) => setItems((list) => removeCompareItem(list, key)),
    []
  );
  const clear = useCallback(() => {
    setItems([]);
    setSwapKey(null);
  }, []);
  return {
    items,
    add,
    remove,
    clear,
    canAdd: items.length < MAX_COMPARE_ITEMS,
    /** Oldest-held bottle (first entry) — the "replace oldest" target. */
    oldest: items[0] as KioskProduct | undefined,
    swapKey,
    armSwap: setSwapKey,
    disarmSwap: useCallback(() => setSwapKey(null), []),
    /** Replaces the oldest entry with `product` (result-screen button). */
    replaceOldestWith: useCallback(
      (product: KioskProduct) =>
        setItems((list) => replaceOldest(list, product)),
      []
    ),
  };
}
