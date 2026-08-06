'use client';

import { useEffect } from 'react';

// MetaMask and other wallet extensions inject scripts into every page they
// run on. When the extension's background service worker is unreachable
// (locked, crashed, or another wallet extension conflicts on window.ethereum)
// they throw/log errors such as "Failed to connect to MetaMask" whose stacks
// live entirely inside the extension. DrinksHarbour never touches
// window.ethereum, so those errors are noise — filter them at the window and
// console level so the dev overlay and DevTools console stay readable.
//
// Scoping is deliberately strict (extension URL schemes + wallet script
// names): a real app error never contains any of these markers, so nothing
// legitimate can be swallowed.

const EXTENSION_SCHEME_RE =
  /^(chrome|moz|safari|edge|brave)-extension:\/\//i;
const EXTENSION_NOISE_RE =
  /MetaMask|metamask|inpage\.js|contentscript\.js/i;

/**
 * Known benign noise patterns — errors that fire during normal operation
 * and don't indicate a real problem:
 *
 * - CLIENT_FETCH_ERROR: NextAuth's SessionProvider fetches `/api/auth/session`
 *   on mount. During HMR/server restarts the endpoint temporarily returns HTML,
 *   which the client correctly ignores. The SessionProvider retries on its own.
 */
const KNOWN_NOISE_RE =
  /CLIENT_FETCH_ERROR|next-auth.*client_fetch_error/i;

/** True when an error string originates from a browser wallet extension. */
export function isExtensionNoise(text: string): boolean {
  return (
    EXTENSION_SCHEME_RE.test(text) ||
    EXTENSION_NOISE_RE.test(text) ||
    KNOWN_NOISE_RE.test(text)
  );
}

/**
 * console.error wrapper that drops extension-originated messages. Extension
 * code logs via console.error directly (e.g. "Failed to connect to
 * MetaMask"), which never produces a window event, so the console stream
 * itself has to be filtered.
 */
export function filterExtensionConsoleError(original: typeof console.error) {
  return ((...args: unknown[]) => {
    const text = args
      .map((a) => (a instanceof Error ? a.stack ?? a.message : String(a)))
      .join(' ');
    if (isExtensionNoise(text)) return;
    original.apply(console, args);
  }) as typeof console.error;
}

/**
 * Window 'error' / 'unhandledrejection' handlers that swallow extension
 * noise. preventDefault() stops the browser's default console print;
 * stopImmediatePropagation() keeps downstream listeners (e.g. the Next dev
 * overlay) from reporting them as app errors.
 */
export function makeExtensionErrorHandlers() {
  const onError = (event: ErrorEvent) => {
    const stack = String(
      event.error?.stack ?? event.error?.message ?? event.message ?? ''
    );
    if (isExtensionNoise(stack) || isExtensionNoise(event.filename ?? '')) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  };

  const onRejection = (event: PromiseRejectionEvent) => {
    const stack = String(
      event.reason?.stack ?? event.reason?.message ?? event.reason ?? ''
    );
    if (isExtensionNoise(stack)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  };

  return { onError, onRejection };
}

export default function ExtensionErrorFilter() {
  useEffect(() => {
    const { onError, onRejection } = makeExtensionErrorHandlers();
    const originalError = console.error;
    console.error = filterExtensionConsoleError(originalError);

    window.addEventListener('error', onError, true);
    window.addEventListener('unhandledrejection', onRejection, true);

    return () => {
      window.removeEventListener('error', onError, true);
      window.removeEventListener('unhandledrejection', onRejection, true);
      console.error = originalError;
    };
  }, []);

  return null;
}
