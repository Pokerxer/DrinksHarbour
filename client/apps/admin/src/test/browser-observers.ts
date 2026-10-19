// jsdom has no layout engine. Supply missing browser APIs for floating controls;
// real geometry and clipping are verified separately in Chromium.
if (typeof window !== 'undefined') {
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  if (!HTMLElement.prototype.scrollIntoView) {
    HTMLElement.prototype.scrollIntoView = function () {};
  }
}
