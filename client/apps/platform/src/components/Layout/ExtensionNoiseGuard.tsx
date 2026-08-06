"use client";

import { useEffect } from "react";

// Renders an inline guard script as part of the SSR'd <body>. Because the
// script tag is in the initial HTML (rendered by this client component at
// build/request time), the browser executes it during HTML parsing — BEFORE
// the deferred Next.js bundle registers the dev-overlay window 'error' /
// 'unhandledrejection' listeners. Wallet extensions (MetaMask etc.) inject
// inpage.js at document_start and throw/log "Failed to connect to MetaMask"
// whenever their background service worker is unreachable. Those errors are
// dispatched at window, where listeners fire in registration order — by
// registering first we can stopImmediatePropagation() them away from the
// overlay entirely.
//
// Scoping is deliberately strict (extension URL schemes + wallet script
// names): a real app error never contains any of these markers, so nothing
// legitimate can be swallowed. Renders only the script; never touches app
// errors.
const EXTENSION_NOISE_GUARD_SCRIPT = `(function () {
  var schemeRe = /^(chrome|moz|safari|edge|brave)-extension:\\/\\//i;
  var noiseRe = /MetaMask|metamask|inpage\\.js|contentscript\\.js/i;
  function textOf(value) {
    if (!value) return String(value);
    return value.stack || value.message || String(value);
  }
  function isNoise(text) {
    return !!(text && (schemeRe.test(text) || noiseRe.test(text)));
  }
  function onError(evt) {
    if (isNoise(textOf(evt.error)) || isNoise(evt.filename)) {
      evt.preventDefault();
      evt.stopImmediatePropagation();
    }
  }
  function onRejection(evt) {
    if (isNoise(textOf(evt.reason))) {
      evt.preventDefault();
      evt.stopImmediatePropagation();
    }
  }
  window.addEventListener('error', onError, true);
  window.addEventListener('unhandledrejection', onRejection, true);
  var originalConsoleError = window.console.error.bind(window.console);
  window.console.error = function () {
    var parts = [];
    for (var i = 0; i < arguments.length; i++) {
      parts.push(textOf(arguments[i]));
    }
    if (!isNoise(parts.join(' '))) {
      originalConsoleError.apply(window.console, arguments);
    }
  };
})();`;

export default function ExtensionNoiseGuard() {
  // Defense-in-depth: after hydration, Next's dev overlay has re-wrapped
  // console.error on top of the guard's early patch, so re-apply the filter
  // for any extension noise that fires post-hydration. The window listeners
  // are already in place (inline script ran first during HTML parsing), so
  // only the console.error stream needs the re-wrap.
  useEffect(() => {
    const originalError = console.error;
    console.error = (...args: unknown[]) => {
      const text = args
        .map((a) => (a instanceof Error ? a.stack ?? a.message : String(a)))
        .join(" ");
      if (text && /MetaMask|metamask|inpage\.js|contentscript\.js/i.test(text)) {
        return;
      }
      originalError.apply(console, args);
    };
    return () => {
      console.error = originalError;
    };
  }, []);

  return (
    <script
      type="text/javascript"
      dangerouslySetInnerHTML={{ __html: EXTENSION_NOISE_GUARD_SCRIPT }}
    />
  );
}
