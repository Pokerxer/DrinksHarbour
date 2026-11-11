'use client';
import type { KioskConfig, KioskProduct } from './types';

const BOOK_KEY = (slug: string) => `price-checker-book-v2-${slug}`;
const QUEUE_KEY = (slug: string) => `price-checker-queue-${slug}`;
export const BOOK_JSON_LIMIT = 4_000_000; // ~4MB localStorage budget guard
export const QUEUE_CAP = 500;

export type OfflineProduct = KioskProduct & { barcode: string; suggestible?: boolean };

export interface OfflineBook {
  generatedAt: string;
  config: KioskConfig;
  items: OfflineProduct[];
  unavailableBarcodes?: string[];
}

function storage(_legacyKey?: string): Storage | null {
  try {
    const session = globalThis.localStorage;
    if (!session) return null;
    session.getItem(BOOK_PROBE);
    return session;
  } catch {
    return null;
  }
}
const BOOK_PROBE = 'price-checker-probe';

function parseItems(value: unknown): OfflineProduct[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (row): row is OfflineProduct =>
      !!row &&
      typeof row === 'object' &&
      typeof (row as OfflineProduct).barcode === 'string' &&
      typeof (row as OfflineProduct).name === 'string' &&
      Number.isFinite((row as OfflineProduct).price) && (row as OfflineProduct).price >= 0
  );
}

export function parseBook(slug: string, value: unknown): OfflineBook | null {
  const payload = value as Partial<OfflineBook> | null;
  if (
    typeof payload?.generatedAt !== 'string' ||
    !Number.isFinite(Date.parse(payload.generatedAt)) ||
    payload.config?.slug !== slug ||
    !Array.isArray(payload.items)
  ) return null;
  return {
    generatedAt: payload.generatedAt,
    config: payload.config,
    items: parseItems(payload.items),
    unavailableBarcodes: Array.isArray(payload.unavailableBarcodes)
      ? payload.unavailableBarcodes.filter((code) => typeof code === 'string')
      : [],
  };
}

/** Persists a public pricebook within the device storage budget. */
export function saveBook(slug: string, payload: unknown): boolean {
  const session = storage(BOOK_KEY(slug));
  const book = parseBook(slug, payload);
  if (!session || !book) return false;
  try {
    const json = JSON.stringify(book);
    if (json.length > BOOK_JSON_LIMIT) return false;
    session.removeItem(`price-checker-book-${slug}`);
    session.setItem(BOOK_KEY(slug), json);
    return true;
  } catch {
    return false;
  }
}

export function loadBook(slug: string): OfflineBook | null {
  const session = storage(BOOK_KEY(slug));
  if (!session) return null;
  try {
    const raw = session.getItem(BOOK_KEY(slug));
    if (!raw) return null;
    return parseBook(slug, JSON.parse(raw));
  } catch {
    return null;
  }
}

export function lookupBook(
  items: OfflineProduct[] | undefined,
  barcode: string
): OfflineProduct | null {
  if (!items?.length || !barcode) return null;
  return items.find((row) => row.barcode === barcode) ?? null;
}

// ── offline scan queue ──────────────────────────────────────────────────────
export interface OfflineScanRecord {
  barcode: string;
  requestId: string;
  scannedAt: string;
}

function queueStorage(_slug: string): Storage | null {
  try {
    const session = globalThis.localStorage;
    if (!session) return null;
    session.getItem(BOOK_PROBE);
    return session;
  } catch {
    return null;
  }
}

/** Append-only, deduped by requestId, newest last, capped. */
export function addQueue(
  slug: string,
  record: OfflineScanRecord
): OfflineScanRecord[] {
  const session = queueStorage(slug);
  if (!session) return [];
  const queue = readQueue(slug).filter(
    (row) => row.requestId !== record.requestId
  );
  queue.push(record);
  const capped = queue.slice(-QUEUE_CAP);
  try {
    session.setItem(QUEUE_KEY(slug), JSON.stringify(capped));
  } catch {
    return queue;
  }
  return capped;
}

export function readQueue(slug: string): OfflineScanRecord[] {
  const session = queueStorage(slug);
  if (!session) return [];
  try {
    const list: unknown = JSON.parse(session.getItem(QUEUE_KEY(slug)) || '[]');
    if (!Array.isArray(list)) return [];
    return list.filter(
      (row): row is OfflineScanRecord =>
        !!row &&
        typeof row === 'object' &&
        typeof (row as OfflineScanRecord).barcode === 'string' &&
        typeof (row as OfflineScanRecord).requestId === 'string' &&
        typeof (row as OfflineScanRecord).scannedAt === 'string'
    );
  } catch {
    return [];
  }
}

export function dropQueue(slug: string, requestIds: string[]): void {
  const session = queueStorage(slug);
  if (!session) return;
  const keep = readQueue(slug).filter(
    (row) => !requestIds.includes(row.requestId)
  );
  try {
    session.setItem(QUEUE_KEY(slug), JSON.stringify(keep));
  } catch {
    /* keep queue in memory */
  }
}

export interface SyncOutcome {
  synced: { requestId: string }[];
  rejected: { requestId: string; error: string }[];
}

/** POSTs pending offline scans to the server and trims what it accepted. */
export async function flushQueue(
  slug: string,
  signal?: AbortSignal
): Promise<SyncOutcome | null> {
  const queued = readQueue(slug);
  if (!queued.length) return { synced: [], rejected: [] };
  try {
    const response = await fetch(`/api/price-checker/${encodeURIComponent(slug)}/sync`, {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scans: queued }),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { data?: SyncOutcome };
    if (!payload?.data) return null;
    dropQueue(
      slug,
      payload.data.synced.map((row) => row.requestId)
    );
    return {
      synced: payload.data.synced,
      rejected: payload.data.rejected ?? [],
    };
  } catch {
    return null;
  }
}

/** Test/UX helper: the ids still floating after a partial sync. */
export function pendingCount(slug: string): number {
  return readQueue(slug).length;
}

export function pruneSeen(list: OfflineScanRecord[]): OfflineScanRecord[] {
  const seen = new Set<string>();
  return list.filter((row) => {
    if (seen.has(row.requestId)) return false;
    seen.add(row.requestId);
    return true;
  });
}
