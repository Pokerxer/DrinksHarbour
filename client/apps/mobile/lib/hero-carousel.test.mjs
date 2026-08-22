import { describe, expect, test } from 'vitest';

const { wrapIndex, pageOffset, pageIndexFromOffset, shouldAutoplay } = await import(
  './hero-carousel.ts'
);

describe('wrapIndex', () => {
  // The web's arrows are `(index - 1 + slides.length) % slides.length` and
  // `(index + 1) % slides.length`. Both wrap, and autoplay depends on the
  // forward wrap to loop the carousel at all.
  test('an index inside the range is returned unchanged', () => {
    expect(wrapIndex(2, 5)).toBe(2);
  });

  test('one past the end wraps to the first slide', () => {
    expect(wrapIndex(5, 5)).toBe(0);
  });

  // This is the whole reason the function exists. JS `%` keeps the sign of the
  // dividend, so `-1 % 5` is `-1`, not `4` — a bare modulo sends the left arrow
  // on the first slide to `slides[-1]`, which is `undefined`.
  test('one before the start wraps to the last slide', () => {
    expect(wrapIndex(-1, 5)).toBe(4);
  });

  test('wraps from far outside the range in both directions', () => {
    expect(wrapIndex(12, 5)).toBe(2);
    expect(wrapIndex(-12, 5)).toBe(3);
  });

  test('a single slide always resolves to itself', () => {
    expect(wrapIndex(1, 1)).toBe(0);
    expect(wrapIndex(-1, 1)).toBe(0);
  });

  // `slides` is empty for exactly one frame while the fetch is in flight, and a
  // modulo by zero is NaN — which would be handed straight to scrollTo.
  test('an empty carousel resolves to 0 rather than NaN', () => {
    expect(wrapIndex(3, 0)).toBe(0);
    expect(wrapIndex(0, 0)).toBe(0);
  });
});

describe('pageOffset', () => {
  test('slide n sits n screen widths along', () => {
    expect(pageOffset(0, 390)).toBe(0);
    expect(pageOffset(3, 390)).toBe(1170);
  });
});

describe('pageIndexFromOffset', () => {
  test('a settled page reports its own index', () => {
    expect(pageIndexFromOffset(780, 390, 5)).toBe(2);
  });

  // paging ScrollViews settle on exact multiples, but momentum rounding and
  // fractional widths (390.0909…) mean the offset arrives a pixel or two off.
  test('an offset a few pixels off still reports the nearest page', () => {
    expect(pageIndexFromOffset(778, 390, 5)).toBe(2);
    expect(pageIndexFromOffset(783, 390, 5)).toBe(2);
  });

  // iOS rubber-bands past both ends, producing negative offsets and offsets
  // beyond the last page. Neither may become a slide index.
  test('a rubber-band overscroll clamps to the ends', () => {
    expect(pageIndexFromOffset(-60, 390, 5)).toBe(0);
    expect(pageIndexFromOffset(2000, 390, 5)).toBe(4);
  });

  // The first layout pass reports width 0, and dividing by it gives Infinity.
  test('a zero width reports the first page rather than Infinity', () => {
    expect(pageIndexFromOffset(500, 0, 5)).toBe(0);
  });

  test('an empty carousel reports the first page', () => {
    expect(pageIndexFromOffset(0, 390, 0)).toBe(0);
  });
});

describe('shouldAutoplay', () => {
  test('a multi-slide carousel at rest autoplays', () => {
    expect(shouldAutoplay({ loading: false, slideCount: 3, interacting: false })).toBe(true);
  });

  test('nothing autoplays while the banners are still loading', () => {
    expect(shouldAutoplay({ loading: true, slideCount: 3, interacting: false })).toBe(false);
  });

  // The web's `slides.length <= 1` guard: a one-slide carousel has nowhere to go,
  // and running the progress bar over it would suggest otherwise.
  test('a single slide does not autoplay', () => {
    expect(shouldAutoplay({ loading: false, slideCount: 1, interacting: false })).toBe(false);
    expect(shouldAutoplay({ loading: false, slideCount: 0, interacting: false })).toBe(false);
  });

  // The point of the whole gesture change: the timer must not fire a slide out
  // from under a finger that is mid-swipe.
  test('autoplay is suspended while the finger is down', () => {
    expect(shouldAutoplay({ loading: false, slideCount: 3, interacting: true })).toBe(false);
  });
});
