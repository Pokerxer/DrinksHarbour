import { describe, expect, test } from 'vitest';

const {
  FALLBACK_HERO_SLIDES,
  contentPosition,
  placementAspectRatio,
  placementCtaSkin,
  placementTextAlign,
  textAlignOf,
} = await import('./banner.ts');

describe('FALLBACK_HERO_SLIDES', () => {
  /**
   * A mobile user and a web user must not see a different "empty" store: these
   * are the same two slides, same copy, same colours as HeroBanner.tsx:41-68.
   */
  test('is the web pair, verbatim', () => {
    expect(FALLBACK_HERO_SLIDES.map((s) => s.title)).toEqual([
      'Premium Spirits, Delivered',
      'Weekend Flash Sale',
    ]);
    expect(FALLBACK_HERO_SLIDES.map((s) => s.backgroundColor)).toEqual(['#1A1A2E', '#7C1D1D']);
  });

  // The `isFallback` / `fallback-` id is what keeps CTR honest — a fabricated
  // slide must never register an impression or a click.
  test('every slide is marked as a fallback', () => {
    expect(FALLBACK_HERO_SLIDES.every((s) => s.isFallback)).toBe(true);
    expect(FALLBACK_HERO_SLIDES.every((s) => s._id.startsWith('fallback'))).toBe(true);
  });
});

describe('contentPosition', () => {
  /**
   * The axis swap is the whole point. The web writes `items-* justify-*` on a
   * ROW container, so `items-` is vertical; RN defaults to a COLUMN, where
   * `justifyContent` is vertical. Copying the names across without swapping
   * puts every banner's text on the wrong axis.
   */
  test('maps top-left to top on the vertical axis and left on the horizontal', () => {
    expect(contentPosition('top-left')).toEqual({
      justifyContent: 'flex-start',
      alignItems: 'flex-start',
    });
  });

  test('maps bottom-right to the opposite corner', () => {
    expect(contentPosition('bottom-right')).toEqual({
      justifyContent: 'flex-end',
      alignItems: 'flex-end',
    });
  });

  test('center-left is vertically centred and horizontally left', () => {
    expect(contentPosition('center-left')).toEqual({
      justifyContent: 'center',
      alignItems: 'flex-start',
    });
  });

  test('an unknown or absent position falls back to centre', () => {
    expect(contentPosition('sideways')).toEqual({
      justifyContent: 'center',
      alignItems: 'center',
    });
    expect(contentPosition()).toEqual({ justifyContent: 'center', alignItems: 'center' });
  });
});

describe('text alignment', () => {
  test('PlacementBanner pins the alignment to the slot', () => {
    expect(placementTextAlign('bottom-right')).toBe('right');
    expect(placementTextAlign('top-left')).toBe('left');
    expect(placementTextAlign('center')).toBe('center');
  });

  test('the hero honours its own textAlignment field', () => {
    expect(textAlignOf('left')).toBe('left');
    expect(textAlignOf('right')).toBe('right');
    expect(textAlignOf('nonsense')).toBe('center');
  });
});

describe('placementAspectRatio', () => {
  // home_secondary is a short strip, NOT the 21:9 hero shape. Getting this wrong
  // makes the promo slot three times too tall.
  test('home_secondary is 3:1 and everything else is 21:9', () => {
    expect(placementAspectRatio('home_secondary')).toBe(3);
    expect(placementAspectRatio('home_hero')).toBeCloseTo(21 / 9);
    expect(placementAspectRatio('anything_else')).toBeCloseTo(21 / 9);
  });
});

describe('placementCtaSkin', () => {
  test('primary is the orange fill', () => {
    expect(placementCtaSkin('primary').backgroundColor).toBe('#f97316');
  });

  test('outline is transparent with a white 2px border', () => {
    const skin = placementCtaSkin('outline');
    expect(skin.backgroundColor).toBe('transparent');
    expect(skin.borderWidth).toBe(2);
  });

  test('text is underlined with no fill', () => {
    expect(placementCtaSkin('text').underline).toBe(true);
  });

  test('an unknown style falls back to primary', () => {
    expect(placementCtaSkin('rainbow')).toEqual(placementCtaSkin('primary'));
    expect(placementCtaSkin()).toEqual(placementCtaSkin('primary'));
  });
});
