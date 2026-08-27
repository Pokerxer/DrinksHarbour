import { defaultCache } from '@serwist/next/worker';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import {
  CacheableResponsePlugin,
  CacheFirst,
  ExpirationPlugin,
  Serwist,
  StaleWhileRevalidate,
} from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[];
  }
}

declare const self: ServiceWorkerGlobalScope;

declare class SyncEvent extends Event {
  readonly tag: string;
  waitUntil(f: Promise<any>): void;
}

// `runtimeCaching` entries passed to `new Serwist()` must carry a Strategy
// INSTANCE as `handler` — the same shape `defaultCache` below uses.
//
// These two rules previously used the `@serwist/build` config shape instead
// (`handler: 'CacheFirst'` as a string, with a sibling `options` object). That
// shape is only valid for the build-time injectManifest config; the runtime
// constructor never reads `options`, and it passes the handler through
// `normalizeHandler`, which wraps a non-object into `{ handle: handler }`. The
// handler therefore became `{ handle: 'CacheFirst' }` — `handle` a string, not
// a function.
//
// Serwist's `handleRequest` then did `handler.handle(...)` inside a try/catch
// and turned the resulting TypeError into `Promise.reject(err)`, which it
// passed straight to `event.respondWith()`. There is no fall-through to the
// next matching route and no network fallback, so every request matching these
// rules failed at the service-worker layer and rendered as a broken image —
// across products, banners, categories, brands and warehouses alike, and for
// plain `<img>` as much as for `next/image`. It only showed on deployed builds
// because `withSerwist` is disabled in development.
//
// Cache version: bump to invalidate all old caches when fixing the broken SW.
// Old clients with the buggy SW will bypass it entirely once they receive the
// new SW (skipWaiting + clientsClaim), but this version bump ensures NO stale
// entries from the old broken SW can be served.
const CACHE_VERSION = 'v2';

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      matcher: /\/_next\/image/,
      handler: new CacheFirst({
        cacheName: `pos-images-${CACHE_VERSION}`,
        plugins: [
          // Same-origin and always a real response, so only a 200 is worth
          // keeping; caching an error would replay it for the full maxAge.
          new CacheableResponsePlugin({ statuses: [200] }),
          new ExpirationPlugin({
            maxEntries: 200,
            maxAgeSeconds: 7 * 24 * 60 * 60,
            purgeOnQuotaError: true,
          }),
        ],
      }),
    },
    {
      // Every `<img>` in the admin matches this, not just the POS — the cache
      // name is historical. Product art is cross-origin (Cloudinary) and so
      // arrives as an opaque `no-cors` response: `status === 0`, and padded to
      // roughly 7MB each against the origin storage quota.
      //
      // StaleWhileRevalidate rather than CacheFirst for that reason: it still
      // serves the cached copy instantly (and offline, for the POS), but it
      // returns the network response when a cache write fails and refreshes
      // entries in the background, so a bad entry heals on the next load
      // instead of being pinned for the full maxAge.
      matcher: ({ request }: { request: Request }) =>
        request.destination === 'image',
      handler: new StaleWhileRevalidate({
        cacheName: `pos-product-images-${CACHE_VERSION}`,
        plugins: [
          // 0 is an opaque cross-origin image, 200 a same-origin one. Without
          // 0 the Cloudinary art would never be cached and the POS would have
          // no images offline.
          new CacheableResponsePlugin({ statuses: [0, 200] }),
          new ExpirationPlugin({
            // Opaque padding means each entry costs ~7MB whatever its real
            // size, so this ceiling is far smaller than the count suggests.
            maxEntries: 150,
            maxAgeSeconds: 7 * 24 * 60 * 60,
            purgeOnQuotaError: true,
          }),
        ],
      }),
    },
    ...defaultCache,
  ],
});

serwist.addEventListeners();

self.addEventListener('sync', (event: SyncEvent) => {
  if (event.tag === 'pos-queue-sync') {
    event.waitUntil(
      import('./app/shared/point-of-sale/offline/sync').then((m: any) =>
        m.runSyncEngine()
      )
    );
  }
});
