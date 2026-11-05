'use client';
import { useCallback, useEffect, useState } from 'react';
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
 */
export function useCompare(slug: string) {
  const [items, setItems] = useState<KioskProduct[]>(() => readStored(slug));
  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey(slug), JSON.stringify(items));
    } catch {
      /* private mode — the tray simply lives in memory */
    }
  }, [slug, items]);
  const add = useCallback(
    (product: KioskProduct) =>
      setItems((list) => addCompareItem(list, product)),
    []
  );
  const remove = useCallback(
    (key: string) => setItems((list) => removeCompareItem(list, key)),
    []
  );
  const clear = useCallback(() => setItems([]), []);
  return { items, add, remove, clear, canAdd: items.length < MAX_COMPARE_ITEMS };
}
