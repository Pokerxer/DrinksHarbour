import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { KioskConfig } from './types';
import {
  addQueue,
  flushQueue,
  loadBook,
  lookupBook,
  readQueue,
  saveBook,
} from './offline';

interface Item {
  barcode: string;
  name: string;
  price: number;
  currency: string;
  alcoholic: boolean;
  taxLabel: string;
}

const store: Record<string, string> = {};
const config = { slug: 'counter', currency: 'NGN' } as KioskConfig;

beforeEach(() => {
  vi.stubGlobal('sessionStorage', undefined);
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
  });
});

const item = (barcode = '4901877007131', name = 'Glen Grant 12'): Item => ({
  barcode,
  name,
  price: 8000,
  currency: 'NGN',
  alcoholic: true,
  taxLabel: 'Includes tax',
});

describe('offline pricebook cache', () => {
  it('round-trips a parsed book and exposes generatedAt', () => {
    expect(saveBook('counter', { generatedAt: '2026-11-07T09:00:00Z', config, items: [item()] })).toBe(true);
    const book = loadBook('counter');
    expect(book?.generatedAt).toBe('2026-11-07T09:00:00Z');
    expect(lookupBook(book!.items, '4901877007131')?.name).toBe('Glen Grant 12');
    expect(lookupBook(book!.items, 'missing')).toBeNull();
  });
  it('rejects malformed payloads on parse and on load', () => {
    expect(saveBook('counter', { generatedAt: 'x', config, items: 'nope' })).toBe(false);
    store['price-checker-book-v2-counter'] = '{{{';
    expect(loadBook('counter')).toBeNull();
    store['price-checker-book-v2-counter'] = JSON.stringify({ no: 'shape' });
    expect(loadBook('counter')).toBeNull();
  });
});

describe('offline scan queue', () => {
  it('adds validated records and flushes them to the sync endpoint', async () => {
    addQueue('counter', {
      barcode: '4901877007131',
      requestId: 'aaaaaaaaaaaaaaaa',
      scannedAt: '2026-11-07T09:00:00Z',
    });
    expect(readQueue('counter')).toHaveLength(1);
    const mockFetch = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            success: true,
            data: { synced: [{ requestId: 'aaaaaaaaaaaaaaaa' }], rejected: [] },
          }),
          { status: 200 }
        )
      )
    );
    vi.stubGlobal('fetch', mockFetch);
    const outcome = await flushQueue('counter');
    expect(outcome?.synced).toEqual([{ requestId: 'aaaaaaaaaaaaaaaa' }]);
    expect(readQueue('counter')).toHaveLength(0);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/price-checker/counter/sync',
      expect.objectContaining({ method: 'POST' })
    );
  });
  it('keeps the queue when the sync endpoint is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))));
    addQueue('counter', {
      barcode: '4901877007131',
      requestId: 'bbbbbbbbbbbbbbbb',
      scannedAt: '2026-11-07T09:00:00Z',
    });
    const outcome = await flushQueue('counter');
    expect(outcome).toBeNull();
    expect(readQueue('counter')).toHaveLength(1);
  });
});
