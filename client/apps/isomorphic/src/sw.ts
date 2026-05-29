import { defaultCache } from '@serwist/next/worker';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { Serwist } from 'serwist';

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

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      matcher: /\/_next\/image/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'pos-images',
        expiration: { maxEntries: 200, maxAgeSeconds: 7 * 24 * 60 * 60 },
      },
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
