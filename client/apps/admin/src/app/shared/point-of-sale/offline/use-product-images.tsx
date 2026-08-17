'use client';

// Owns the object-URL side of the offline image cache: one URL per cached blob,
// created once, revoked exactly once.
//
// Deliberately thin. Admin vitest runs `environment: 'node'` with no jsdom, so
// nothing here can be unit-tested — every decision worth pinning lives in
// `image-cache.ts` and `image-store.ts`, which are pure or Dexie-only and are
// tested there.

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  POS_IMAGES_UPDATED,
  resolveImageSource,
  type ImageSource,
} from './image-cache';
import { loadObjectUrls } from './image-store';

type ImageMap = ReadonlyMap<string, string>;

const EMPTY: ImageMap = new Map();
const ProductImageContext = createContext<{ urls: ImageMap; ready: boolean }>({
  urls: EMPTY,
  ready: false,
});

export function ProductImageProvider({ children }: { children: ReactNode }) {
  const [urls, setUrls] = useState<ImageMap>(EMPTY);
  const [ready, setReady] = useState(false);
  // Revocation reads the latest map without re-running the effect and tearing
  // down URLs the grid is still painting.
  const held = useRef<ImageMap>(EMPTY);
  held.current = urls;

  useEffect(() => {
    let alive = true;

    async function absorb() {
      // Only mint URLs for blobs we do not already hold, so a precache landing
      // mid-session does not force every tile to re-decode.
      // `Array.from`/`forEach` throughout: `downlevelIteration` is off here, so
      // spreading a Map or Set is a compile error.
      const fresh = await loadObjectUrls(
        new Set(Array.from(held.current.keys()))
      );
      if (!alive) {
        fresh.forEach((url) => URL.revokeObjectURL(url));
        return;
      }
      if (fresh.size > 0) {
        setUrls((prev) => {
          const next = new Map(prev);
          fresh.forEach((url, key) => next.set(key, url));
          return next;
        });
      }
      setReady(true);
    }

    void absorb();
    window.addEventListener(POS_IMAGES_UPDATED, absorb);

    return () => {
      alive = false;
      window.removeEventListener(POS_IMAGES_UPDATED, absorb);
      held.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const value = useMemo(() => ({ urls, ready }), [urls, ready]);

  return (
    <ProductImageContext.Provider value={value}>
      {children}
    </ProductImageContext.Provider>
  );
}

/**
 * What this tile should render, and whether it is bytes we hold or a URL that
 * needs a network.
 *
 * While the map is still loading from IndexedDB, an imaged product reports
 * `remote` — correct online, and offline it paints the placeholder for the few
 * milliseconds before the blobs arrive rather than flashing a broken image.
 */
export function useProductImage(product: unknown): ImageSource {
  const { urls } = useContext(ProductImageContext);
  return useMemo(
    () => resolveImageSource(product, urls as Map<string, string>),
    [product, urls]
  );
}

/**
 * The raw key → object-URL map, for callers that must resolve several products
 * at once (a combo collage) and so cannot call `useProductImage` per item.
 */
export function useProductImageUrls(): Map<string, string> {
  return useContext(ProductImageContext).urls as Map<string, string>;
}

/** True once Dexie has been read, whatever it contained. */
export function useProductImagesReady(): boolean {
  return useContext(ProductImageContext).ready;
}
