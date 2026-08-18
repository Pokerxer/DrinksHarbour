import { describe, expect, test } from 'vitest';

const { HOME_BLOCK_ORDER, blockRender, isHomeEmpty } = await import('./home-blocks.ts');

describe('HOME_BLOCK_ORDER', () => {
  // Parity with the web homepage was an explicit user decision (design §2).
  test('is the eight web blocks in web order', () => {
    expect(Array.from(HOME_BLOCK_ORDER)).toEqual([
      'categories',
      'hero',
      'flashSale',
      'featuredDeals',
      'featuredProducts',
      'secondaryBanner',
      'benefits',
      'recommended',
    ]);
  });

  test('has no duplicates', () => {
    expect(new Set(HOME_BLOCK_ORDER).size).toBe(HOME_BLOCK_ORDER.length);
  });
});

describe('blockRender', () => {
  test('a loading block shows a skeleton', () => {
    expect(blockRender({ phase: 'loading', itemCount: 0 })).toBe('skeleton');
  });

  test('a ready block with items shows content', () => {
    expect(blockRender({ phase: 'ready', itemCount: 4 })).toBe('content');
  });

  // Design §7: a home screen missing one rail is a normal home screen; a home
  // screen showing "Error: 500" four times is broken.
  test('a failed block is hidden, never an error message', () => {
    expect(blockRender({ phase: 'error', itemCount: 0 })).toBe('hidden');
  });

  test('a ready but empty block is hidden', () => {
    expect(blockRender({ phase: 'ready', itemCount: 0 })).toBe('hidden');
  });

  // The benefits strip is static local copy — it has no fetch and no items, but
  // it must still render. It reports itself ready with a non-zero count.
  test('a block that never fetches still renders when it reports items', () => {
    expect(blockRender({ phase: 'ready', itemCount: 1 })).toBe('content');
  });
});

describe('isHomeEmpty', () => {
  test('every block failed is an empty home', () => {
    expect(
      isHomeEmpty({
        categories: { phase: 'error', itemCount: 0 },
        hero: { phase: 'error', itemCount: 0 },
      })
    ).toBe(true);
  });

  test('one surviving block is not an empty home', () => {
    expect(
      isHomeEmpty({
        categories: { phase: 'error', itemCount: 0 },
        hero: { phase: 'ready', itemCount: 2 },
      })
    ).toBe(false);
  });

  // Still-loading blocks must not trigger the retry screen mid-flight.
  test('a still-loading block is not an empty home', () => {
    expect(
      isHomeEmpty({
        categories: { phase: 'error', itemCount: 0 },
        hero: { phase: 'loading', itemCount: 0 },
      })
    ).toBe(false);
  });

  test('everything ready but empty is an empty home', () => {
    expect(
      isHomeEmpty({
        categories: { phase: 'ready', itemCount: 0 },
        hero: { phase: 'ready', itemCount: 0 },
      })
    ).toBe(true);
  });

  test('no blocks reported yet is not an empty home', () => {
    expect(isHomeEmpty({})).toBe(false);
  });
});
