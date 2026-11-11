import { useEffect, useRef, useState } from 'react';
import { mergeScan, type Checked } from './phone-results';

function readHistory(key: string): Checked[] | null {
  try {
    const entries: unknown = JSON.parse(localStorage.getItem(key) || '[]');
    if (!Array.isArray(entries)) return [];
    return entries.filter((value: unknown): value is Checked => {
      const entry = value as Partial<Checked> | null;
      return typeof entry?.barcode === 'string' && typeof entry.product?.name === 'string' &&
        Number.isFinite(entry.product.price) && entry.product.price >= 0;
    });
  } catch {
    return null;
  }
}

export function usePhoneHistory(slug: string, session: string) {
  const key = `price-checker-phone-history-v2-${slug}-${session}`;
  const [entries, setEntries] = useState(() => readHistory(key) ?? []);
  const latest = useRef(entries);
  const persisted = useRef(true);

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key !== key || !persisted.current) return;
      latest.current = readHistory(key) ?? latest.current;
      setEntries(latest.current);
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [key]);

  function update(change: (current: Checked[]) => Checked[]) {
    const current = persisted.current ? readHistory(key) ?? latest.current : latest.current;
    const next = change(current);
    latest.current = next;
    try {
      if (next.length) localStorage.setItem(key, JSON.stringify(next));
      else localStorage.removeItem(key);
      persisted.current = true;
    } catch {
      persisted.current = false;
    }
    setEntries(next);
  }

  return {
    entries,
    add: (entry: Checked) => update((current) => mergeScan(current, entry)),
    remove: (barcode: string) => update((current) => current.filter((entry) => entry.barcode !== barcode)),
    clear: () => update(() => []),
  };
}
