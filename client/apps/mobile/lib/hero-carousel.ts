/**
 * The hero carousel's arithmetic — index wrapping, page offsets, and the single
 * boolean that gates autoplay.
 *
 * It lives here rather than in `components/home/hero-banner.tsx` for the reason
 * everything else in `lib/` does: vitest runs `environment: 'node'` in this app,
 * so a component cannot be rendered, and these four functions are exactly the
 * parts that can be wrong without anything failing to compile.
 *
 * The slides are rendered side-by-side in a horizontal `pagingEnabled`
 * ScrollView rather than driven by a hand-rolled pan gesture: paging gives
 * native momentum, the native rubber-band at both ends, and pause-on-touch for
 * free through onScrollBeginDrag/onMomentumScrollEnd. The one thing it cannot do
 * is wrap — see `wrapIndex`.
 */

/**
 * The web's `(i - 1 + n) % n` / `(i + 1) % n`, made safe.
 *
 * JS `%` keeps the sign of the dividend (`-1 % 5 === -1`), so a bare modulo
 * hands `slides[-1]` — undefined — to the left arrow on the first slide. `n === 0`
 * would be NaN, and `slides` is genuinely empty for a frame while the banners
 * are still in flight.
 *
 * A paging ScrollView cannot scroll past its own content, so the last→first wrap
 * is a `scrollTo` jump rather than a slide. That is accepted: cloning slides to
 * fake infinity would double-count banner impressions and desync the dots.
 */
export function wrapIndex(index: number, count: number): number {
  if (count <= 0) return 0;
  return ((index % count) + count) % count;
}

/** Where a paging ScrollView rests when slide `index` fills the screen. */
export function pageOffset(index: number, width: number): number {
  return index * width;
}

/**
 * Which slide a scroll offset settled on.
 *
 * Rounded, not floored: momentum and fractional screen widths (390.0909… on a
 * scaled device) land a pixel or two either side of the exact multiple. Clamped,
 * because iOS rubber-bands past both ends and neither a negative offset nor one
 * past the last page may become a slide index. Width is 0 on the first layout
 * pass, which would divide to Infinity.
 */
export function pageIndexFromOffset(offsetX: number, width: number, count: number): number {
  if (width <= 0 || count <= 0) return 0;
  return Math.min(count - 1, Math.max(0, Math.round(offsetX / width)));
}

/**
 * Whether the carousel should be advancing itself right now.
 *
 * One function because the autoplay timer and the progress bar must agree — they
 * previously duplicated `loading || slides.length <= 1`, and the finger adds a
 * third term to both. A bar that keeps filling under a stationary slide is worse
 * than no bar.
 */
export function shouldAutoplay({
  loading,
  slideCount,
  interacting,
}: {
  loading: boolean;
  slideCount: number;
  interacting: boolean;
}): boolean {
  return !loading && !interacting && slideCount > 1;
}
