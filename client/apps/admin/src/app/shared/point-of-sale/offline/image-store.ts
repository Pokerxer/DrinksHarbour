// Getting product image bytes into Dexie, and back out as object URLs.
//
// Keys are the exact w_300 derivative URLs the tiles ask for (`image-cache.ts`),
// so "is this cached?" is a lookup on the same string the <img> would use.

import { posDb } from './db';
import type { ImageRecord } from './db';

/** Enough to keep the link busy; few enough not to starve the catalogue fetch. */
const DEFAULT_CONCURRENCY = 6;
/** Write in batches so a crash mid-precache does not lose everything before it. */
const FLUSH_EVERY = 25;

export interface PrecacheReport {
  /** Distinct keys asked for. */
  requested: number;
  alreadyCached: number;
  fetched: number;
  failed: number;
  /** Bytes newly written this run. */
  bytes: number;
}

/**
 * Fetch and store the bytes for every key not already held.
 *
 * Failures are counted and returned, never swallowed: the previous attempt at
 * this wrapped each fetch in `catch {}`, so a precache that lost half the
 * catalogue was indistinguishable from one that worked. The caller announces
 * the shortfall.
 */
export async function precacheImages(
  keys: string[],
  opts: { concurrency?: number } = {}
): Promise<PrecacheReport> {
  // Array.from rather than a spread: `downlevelIteration` is off in this project.
  const wanted = Array.from(new Set(keys));
  const report: PrecacheReport = {
    requested: wanted.length,
    alreadyCached: 0,
    fetched: 0,
    failed: 0,
    bytes: 0,
  };
  if (wanted.length === 0) return report;

  const held = new Set(await posDb.images.toCollection().primaryKeys());
  const missing = wanted.filter((k) => !held.has(k));
  report.alreadyCached = wanted.length - missing.length;
  if (missing.length === 0) return report;

  const pending: ImageRecord[] = [];
  const flush = async () => {
    if (pending.length === 0) return;
    const batch = pending.splice(0, pending.length);
    await posDb.images.bulkPut(batch);
  };

  let next = 0;
  const worker = async () => {
    while (next < missing.length) {
      const key = missing[next++];
      try {
        // CORS, not no-cors: res.cloudinary.com serves Access-Control-Allow-Origin
        // on every one of these, and an opaque response is padded in Chrome's
        // quota accounting to far beyond its real size.
        const res = await fetch(key, { mode: 'cors', credentials: 'omit' });
        // A 404's HTML body stored under an image key is a permanent miss that
        // looks like a hit — refuse it rather than cache it.
        if (!res.ok) {
          report.failed++;
          continue;
        }
        const blob = await res.blob();
        pending.push({
          key,
          blob,
          bytes: blob.size,
          fetchedAt: new Date().toISOString(),
        });
        report.fetched++;
        report.bytes += blob.size;
        if (pending.length >= FLUSH_EVERY) await flush();
      } catch {
        report.failed++;
      }
    }
  };

  const lanes = Math.max(
    1,
    Math.min(opts.concurrency ?? DEFAULT_CONCURRENCY, missing.length)
  );
  await Promise.all(Array.from({ length: lanes }, worker));
  await flush();

  return report;
}

/**
 * Drop stored images the catalogue no longer references, so storage stays
 * bounded by the size of the catalogue rather than growing with every price
 * change or re-photograph. Returns how many rows went.
 */
export async function pruneImages(liveKeys: string[]): Promise<number> {
  const live = new Set(liveKeys);
  const stored = await posDb.images.toCollection().primaryKeys();
  const dead = stored.filter((k) => !live.has(k));
  if (dead.length === 0) return 0;
  await posDb.images.bulkDelete(dead);
  return dead.length;
}

/**
 * Cached keys → object URLs for their blobs, skipping any key in `alreadyHeld`.
 *
 * The skip matters when a precache lands while the grid is open: re-minting a
 * URL for an image already on screen orphans the old handle and forces every
 * tile to re-decode for no change. The caller owns revocation; see
 * `use-product-images.tsx`.
 */
export async function loadObjectUrls(
  alreadyHeld: ReadonlySet<string> = new Set()
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  await posDb.images.each((row) => {
    if (alreadyHeld.has(row.key)) return;
    map.set(row.key, URL.createObjectURL(row.blob));
  });
  return map;
}
