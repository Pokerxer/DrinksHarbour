// What actually goes over the wire, and what actually lands in Dexie, when the
// terminal precaches its product images.
//
// The assertions here are on the payload at the boundary — the URL handed to
// `fetch` (with its `mode`), and the record handed to `bulkPut` — not on the
// return value of the function under test. A precache that reports success while
// storing nothing, or while storing the 107 KB original instead of the 10.6 KB
// derivative, would pass a return-value test and still leave the cashier with a
// wall of broken thumbnails.
//
// See docs/superpowers/specs/2026-08-17-pos-offline-product-images-design.md.

import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { ImageRecord } from './db';

let rows: ImageRecord[] = [];
const bulkPutCalls: ImageRecord[][] = [];
const bulkDeleteCalls: string[][] = [];

vi.mock('./db', () => {
  const images = {
    toCollection: () => ({
      primaryKeys: async () => rows.map((r) => r.key),
    }),
    bulkPut: async (recs: ImageRecord[]) => {
      bulkPutCalls.push(recs);
      for (const r of recs) {
        const at = rows.findIndex((x) => x.key === r.key);
        if (at === -1) rows.push(r);
        else rows[at] = r;
      }
    },
    bulkDelete: async (keys: string[]) => {
      bulkDeleteCalls.push(keys);
      rows = rows.filter((r) => !keys.includes(r.key));
    },
    each: async (fn: (r: ImageRecord) => void) => {
      for (const r of rows) fn(r);
    },
  };
  return { posDb: { images } };
});

import { loadObjectUrls, precacheImages, pruneImages } from './image-store';

const A =
  'https://res.cloudinary.com/ds1sacenk/image/upload/f_auto,q_auto,w_300/v1/a.jpg';
const B =
  'https://res.cloudinary.com/ds1sacenk/image/upload/f_auto,q_auto,w_300/v1/b.jpg';
const C =
  'https://res.cloudinary.com/ds1sacenk/image/upload/f_auto,q_auto,w_300/v1/c.jpg';

type FetchCall = { url: string; mode?: string };
let fetchCalls: FetchCall[] = [];

/** Stub `fetch`: any key in `fails` throws, any key in `notFound` 404s. */
function stubFetch(opts: { fails?: string[]; notFound?: string[] } = {}) {
  fetchCalls = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    fetchCalls.push({ url: String(url), mode: init?.mode });
    if (opts.fails?.includes(String(url)))
      throw new TypeError('Failed to fetch');
    if (opts.notFound?.includes(String(url)))
      return new Response('<html>not found</html>', { status: 404 });
    // 10 bytes stands in for the ~10.6 KB real derivative.
    return new Response(new Uint8Array(10), { status: 200 });
  });
}

async function record(key: string, bytes = 10): Promise<ImageRecord> {
  return {
    key,
    blob: new Blob([new Uint8Array(bytes)]),
    bytes,
    fetchedAt: '2026-01-01',
  };
}

beforeEach(async () => {
  rows = [];
  bulkPutCalls.length = 0;
  bulkDeleteCalls.length = 0;
  vi.unstubAllGlobals();
});

describe('precacheImages', () => {
  test('fetches each key in CORS mode and hands Dexie the blob and its byte count', async () => {
    stubFetch();

    const report = await precacheImages([A, B]);

    // CORS, not no-cors: every one of these URLs serves Access-Control-Allow-Origin,
    // and an opaque response is padded in Chrome's quota accounting to far more
    // than its real size.
    expect(fetchCalls).toEqual([
      { url: A, mode: 'cors' },
      { url: B, mode: 'cors' },
    ]);

    const stored = bulkPutCalls
      .flat()
      .sort((x, y) => x.key.localeCompare(y.key));
    expect(stored.map((r) => r.key)).toEqual([A, B]);
    expect(stored.map((r) => r.bytes)).toEqual([10, 10]);
    for (const r of stored) expect(r.blob).toBeInstanceOf(Blob);

    expect(report).toMatchObject({
      requested: 2,
      alreadyCached: 0,
      fetched: 2,
      failed: 0,
      bytes: 20,
    });
  });

  test('does not re-fetch a key whose bytes are already held', async () => {
    rows = [await record(A)];
    stubFetch();

    const report = await precacheImages([A, B]);

    expect(fetchCalls.map((c) => c.url)).toEqual([B]);
    expect(report).toMatchObject({
      requested: 2,
      alreadyCached: 1,
      fetched: 1,
    });
  });

  test('fetches a duplicated key once', async () => {
    stubFetch();

    await precacheImages([A, A, B, A]);

    expect(fetchCalls.map((c) => c.url).sort()).toEqual([A, B]);
  });

  test('counts a network failure instead of swallowing it, and still stores the rest', async () => {
    // A silent cap is what caused the last POS catalogue bug. A precache that
    // reports `failed: 0` after losing half the images is the same defect.
    stubFetch({ fails: [B] });

    const report = await precacheImages([A, B, C]);

    expect(report).toMatchObject({ requested: 3, fetched: 2, failed: 1 });
    expect(
      bulkPutCalls
        .flat()
        .map((r) => r.key)
        .sort()
    ).toEqual([A, C]);
  });

  test('does not store the body of a non-OK response', async () => {
    // Caching a 404's HTML under an image key is the worst outcome available:
    // it is a permanent miss that looks like a hit.
    stubFetch({ notFound: [A] });

    const report = await precacheImages([A]);

    expect(report).toMatchObject({ fetched: 0, failed: 1 });
    expect(bulkPutCalls.flat()).toEqual([]);
    expect(rows).toEqual([]);
  });

  test('reports nothing to do for an empty key set without touching the network', async () => {
    stubFetch();

    const report = await precacheImages([]);

    expect(fetchCalls).toEqual([]);
    expect(report).toMatchObject({
      requested: 0,
      fetched: 0,
      failed: 0,
      bytes: 0,
    });
  });
});

describe('pruneImages', () => {
  test('deletes exactly the keys the current catalogue no longer references', async () => {
    rows = [await record(A), await record(B), await record(C)];

    const deleted = await pruneImages([A, C]);

    expect(bulkDeleteCalls).toEqual([[B]]);
    expect(rows.map((r) => r.key)).toEqual([A, C]);
    expect(deleted).toBe(1);
  });

  test('does not touch Dexie when every stored key is still live', async () => {
    rows = [await record(A), await record(B)];

    const deleted = await pruneImages([A, B]);

    expect(bulkDeleteCalls).toEqual([]);
    expect(deleted).toBe(0);
  });

  test('empties the table when the catalogue references nothing', async () => {
    rows = [await record(A)];

    await pruneImages([]);

    expect(rows).toEqual([]);
  });
});

describe('loadObjectUrls', () => {
  test('maps every stored key to an object URL for its blob', async () => {
    rows = [await record(A), await record(B)];
    const seen: Blob[] = [];
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: (b: Blob) => {
        seen.push(b);
        return `blob:stub/${seen.length}`;
      },
    });

    const map = await loadObjectUrls();

    expect(Array.from(map.entries())).toEqual([
      [A, 'blob:stub/1'],
      [B, 'blob:stub/2'],
    ]);
    expect(seen).toHaveLength(2);
  });

  test('returns an empty map when nothing is cached', async () => {
    expect((await loadObjectUrls()).size).toBe(0);
  });

  test('mints no URL for a key the caller already holds', async () => {
    // A precache landing mid-session reloads this map. Re-minting a URL for an
    // image the grid is already displaying would orphan the old handle and make
    // every tile re-decode for nothing.
    rows = [await record(A), await record(B)];
    const seen: Blob[] = [];
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: (b: Blob) => {
        seen.push(b);
        return `blob:stub/${seen.length}`;
      },
    });

    const map = await loadObjectUrls(new Set([A]));

    expect(Array.from(map.keys())).toEqual([B]);
    expect(seen).toHaveLength(1);
  });
});
