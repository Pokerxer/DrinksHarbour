// The seam between a catalogue sync and the image cache.
//
// `getProducts` is where the terminal learns what it will need to sell offline.
// These tests assert on what that hand-off actually passes — the exact key list
// given to the precache and to the prune — because the previous attempt at this
// looked correct at the call site and cached nothing usable: it fetched raw
// full-size URLs into a Cache API bucket, swallowed every error, and left no way
// to tell a populated cache from an empty one.
//
// See docs/superpowers/specs/2026-08-17-pos-offline-product-images-design.md.

import { beforeEach, describe, expect, test, vi } from 'vitest';

let stored: any[] = [];
const precacheCalls: string[][] = [];
const pruneCalls: string[][] = [];
let precacheReport = {
  requested: 0,
  alreadyCached: 0,
  fetched: 0,
  failed: 0,
  bytes: 0,
};

vi.mock('./db', () => ({
  posDb: {
    products: {
      bulkPut: async (recs: any[]) => {
        stored = recs;
      },
      toArray: async () => stored,
    },
  },
}));

vi.mock('./image-store', () => ({
  precacheImages: async (keys: string[]) => {
    precacheCalls.push(keys);
    return precacheReport;
  },
  pruneImages: async (keys: string[]) => {
    pruneCalls.push(keys);
    return 0;
  },
  loadObjectUrls: async () => new Map(),
}));

let apiProducts: any[] = [];
vi.mock('../api', () => ({
  posApi: {
    getProducts: async () => ({ products: apiProducts }),
  },
}));

import { getProducts } from './api';
import { POS_IMAGES_UPDATED } from './image-cache';

const JPG =
  'https://res.cloudinary.com/ds1sacenk/image/upload/v1783601019/drinksharbour/products/gallery/a.jpg';
const JPG_W300 =
  'https://res.cloudinary.com/ds1sacenk/image/upload/f_auto,q_auto,w_300/v1783601019/drinksharbour/products/gallery/a.jpg';
const WEBP =
  'https://res.cloudinary.com/ds1sacenk/image/upload/v1785448713/drinksharbour/products/gallery/b.webp';
const WEBP_W300 =
  'https://res.cloudinary.com/ds1sacenk/image/upload/f_auto,q_auto,w_300/v1785448713/drinksharbour/products/gallery/b.webp';

/**
 * The image precache is deliberately not awaited by `getProducts` — the till
 * must open before the photos arrive. Let it finish before asserting on it.
 */
async function settled() {
  await new Promise((r) => setTimeout(r, 0));
}

function posProduct(id: string, images: { url: string }[]) {
  return {
    _id: id,
    sku: `SKU-${id}`,
    baseSellingPrice: 1000,
    availableStock: 3,
    sizes: [],
    product: { _id: `p-${id}`, name: `Product ${id}`, images },
    updatedAt: '2026-08-17T00:00:00.000Z',
  };
}

beforeEach(() => {
  stored = [];
  apiProducts = [];
  precacheCalls.length = 0;
  pruneCalls.length = 0;
  precacheReport = {
    requested: 0,
    alreadyCached: 0,
    fetched: 0,
    failed: 0,
    bytes: 0,
  };
  vi.unstubAllGlobals();
  vi.stubGlobal('navigator', { onLine: true });
});

describe('getProducts — image precaching', () => {
  test('precaches the w_300 derivative of every imaged product, and only those', async () => {
    apiProducts = [
      posProduct('a', [{ url: JPG }]),
      posProduct('b', [{ url: WEBP }]),
      posProduct('c', []), // one of the 426 with no photo — not a cache failure
    ];

    await getProducts('token');
    await settled();

    // The derivative, not the 107 KB original: caching the original would work
    // and quietly cost 10x the storage and transfer.
    expect(precacheCalls).toEqual([[JPG_W300, WEBP_W300]]);
  });

  test('prunes against the same key set it precaches, so storage tracks the catalogue', async () => {
    apiProducts = [posProduct('a', [{ url: JPG }])];

    await getProducts('token');
    await settled();

    expect(pruneCalls).toEqual([[JPG_W300]]);
  });

  test('never touches the Cache API — the blobs in Dexie are the mechanism now', async () => {
    // The old path wrote opaque responses into a `pos-product-images` Cache
    // bucket whose service worker does not exist in dev at all. If this starts
    // failing, two caches are being kept in sync by accident.
    const open = vi.fn();
    vi.stubGlobal('caches', { open, match: vi.fn() });
    apiProducts = [posProduct('a', [{ url: JPG }])];

    await getProducts('token');
    await settled();

    expect(open).not.toHaveBeenCalled();
  });

  test('announces a shortfall instead of leaving a half-filled cache looking full', async () => {
    // A silent cap is what caused the last POS catalogue bug.
    precacheReport = {
      requested: 10,
      alreadyCached: 0,
      fetched: 7,
      failed: 3,
      bytes: 70,
    };
    apiProducts = [posProduct('a', [{ url: JPG }])];
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await getProducts('token');
    await settled();

    expect(warn).toHaveBeenCalled();
    expect(warn.mock.calls.flat().join(' ')).toMatch(/3/);
    warn.mockRestore();
  });

  test('stays quiet when every image was cached', async () => {
    precacheReport = {
      requested: 1,
      alreadyCached: 0,
      fetched: 1,
      failed: 0,
      bytes: 10,
    };
    apiProducts = [posProduct('a', [{ url: JPG }])];
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await getProducts('token');
    await settled();

    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  test('announces newly cached bytes so the open grid can swap to them', async () => {
    // A terminal that syncs and then loses the network in the same session has
    // the blobs in Dexie but no object URLs for them yet. Without this signal
    // its tiles keep pointing at remote URLs and break at exactly the moment
    // the cache existed to prevent.
    precacheReport = {
      requested: 2,
      alreadyCached: 0,
      fetched: 2,
      failed: 0,
      bytes: 20,
    };
    apiProducts = [posProduct('a', [{ url: JPG }])];
    const events: string[] = [];
    vi.stubGlobal('navigator', { onLine: true });
    vi.stubGlobal('window', {
      dispatchEvent: (e: Event) => events.push(e.type),
    });

    await getProducts('token');
    await settled();

    expect(events).toEqual([POS_IMAGES_UPDATED]);
  });

  test('stays silent when the precache fetched nothing new', async () => {
    // Every reload would otherwise churn hundreds of object URLs for no change.
    precacheReport = {
      requested: 2,
      alreadyCached: 2,
      fetched: 0,
      failed: 0,
      bytes: 0,
    };
    apiProducts = [posProduct('a', [{ url: JPG }])];
    const events: string[] = [];
    vi.stubGlobal('navigator', { onLine: true });
    vi.stubGlobal('window', {
      dispatchEvent: (e: Event) => events.push(e.type),
    });

    await getProducts('token');
    await settled();

    expect(events).toEqual([]);
  });

  test('returns the catalogue to the grid unchanged', async () => {
    // Precaching must not become a gate on the till opening.
    apiProducts = [posProduct('a', [{ url: JPG }])];

    const returned = await getProducts('token');
    await settled();

    expect(returned).toHaveLength(1);
    expect(returned[0]._id).toBe('a');
  });
});
