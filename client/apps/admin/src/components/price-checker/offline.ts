'use client';
import type { KioskConfig, KioskProduct } from './types';

const BOOK_KEY = (slug: string) => `price-checker-book-${slug}`;
const QUEUE_KEY = (slug: string) => `price-checker-queue-${slug}`;
export const BOOK_JSON_LIMIT = 4_000_000; // ~4MB localStorage budget guard
export const QUEUE_CAP = 500;

export type OfflineProduct = KioskProduct & { barcode: string };

export interface OfflineBook {
  generatedAt: string;
  config: KioskConfig;
  items: OfflineProduct[];
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
      typeof (row as OfflineProduct).price === 'number'
  );
}

/** Validates + persists a book payload. Returns false when unusable/too big. */
export function saveBook(
  slug: string,
  payload: { generatedAt: string; config: unknown; items: unknown }
): boolean {
  const session = storage(BOOK_KEY(slug));
  if (!session) return false;
  const generatedAt =
    typeof payload?.generatedAt === 'string' &&
    Number.isFinite(Date.parse(payload.generatedAt))
      ? payload.generatedAt
      : null;
  const config = payload?.config as KioskConfig | null;
  const items = parseItems(payload?.items);
  if (!generatedAt || !config?.slug || !Array.isArray(items)) return false;
  try {
    const json = JSON.stringify({ generatedAt, config, items });
    if (json.length > BOOK_JSON_LIMIT) return false;
    session.setItem(BOOK_KEY(slug), json);
    return true;
  } catch {
    return false; // quota / private mode
  }
}

export function loadBook(slug: string): OfflineBook | null {
  const session = storage(BOOK_KEY(slug));
  if (!session) return null;
  try {
    const raw = session.getItem(BOOK_KEY(slug));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      generatedAt?: string;
      config?: KioskConfig;
      items?: unknown[];
    };
    const items = parseItems(parsed.items);
    if (!parsed.generatedAt || !parsed.config?.slug) return null;
    return {
      generatedAt: parsed.generatedAt,
      config: parsed.config,
      items,
    };
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
