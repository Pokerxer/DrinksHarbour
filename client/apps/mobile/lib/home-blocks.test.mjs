import { describe, expect, test } from 'vitest';

const { HOME_BLOCK_ORDER, blockRender, isHomeEmpty, isHomeSettled } = await import(
  './home-blocks.ts'
);

/** Every block reporting the same thing — the shape the screen actually holds. */
const allBlocks = (state) =>
  Object.fromEntries(HOME_BLOCK_ORDER.map((id) => [id, state]));

describe('HOME_BLOCK_ORDER', () => {
  // Parity with the web homepage, read off `apps/platform/src/app/page.tsx`.
  // There is no `categories` entry: the page mounts HomeCategoryDrawer, but its
  // `showCategories` state is never set true, so the web renders no rail.
  test('is the seven web sections in web order', () => {
    expect(Array.from(HOME_BLOCK_ORDER)).toEqual([
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

  // The Benefit section is static local copy — it has no fetch and no items, but
  // it must still render. It reports itself ready with a non-zero count.
  test('a block that never fetches still renders when it reports items', () => {
    expect(blockRender({ phase: 'ready', itemCount: 1 })).toBe('content');
  });
});

describe('isHomeEmpty', () => {
  test('every block failed is an empty home', () => {
    expect(
      isHomeEmpty({
        flashSale: { phase: 'error', itemCount: 0 },
        hero: { phase: 'error', itemCount: 0 },
      })
    ).toBe(true);
  });

  test('one surviving block is not an empty home', () => {
    expect(
      isHomeEmpty({
        flashSale: { phase: 'error', itemCount: 0 },
        hero: { phase: 'ready', itemCount: 2 },
      })
    ).toBe(false);
  });

  // Still-loading blocks must not trigger the retry screen mid-flight.
  test('a still-loading block is not an empty home', () => {
    expect(
      isHomeEmpty({
        flashSale: { phase: 'error', itemCount: 0 },
        hero: { phase: 'loading', itemCount: 0 },
      })
    ).toBe(false);
  });

  test('everything ready but empty is an empty home', () => {
    expect(
      isHomeEmpty({
        flashSale: { phase: 'ready', itemCount: 0 },
        hero: { phase: 'ready', itemCount: 0 },
      })
    ).toBe(true);
  });

  test('no blocks reported yet is not an empty home', () => {
    expect(isHomeEmpty({})).toBe(false);
  });
});

/**
 * The pull-to-refresh spinner reads this. Home has no single loading flag —
 * each of the seven blocks owns its own fetch — so "the refresh has finished"
 * has to be derived from the states the screen already collects.
 *
 * Sound because every block reports unconditionally on mount: six through
 * `components/home/use-block.ts`, whose `run()` sets `{phase:'loading'}`
 * synchronously before it awaits, and Benefit, which reports `ready` in a mount
 * effect.
 */
describe('isHomeSettled', () => {
  test('every block done is settled', () => {
    expect(isHomeSettled(allBlocks({ phase: 'ready', itemCount: 4 }))).toBe(true);
  });

  // A block that failed is finished; it is not going to report again.
  test('failures count as done', () => {
    expect(isHomeSettled(allBlocks({ phase: 'error', itemCount: 0 }))).toBe(true);
  });

  test('one block still loading is not settled', () => {
    expect(
      isHomeSettled({
        ...allBlocks({ phase: 'ready', itemCount: 4 }),
        recommended: { phase: 'loading', itemCount: 0 },
      })
    ).toBe(false);
  });

  // The reason the rule is "all seven reported" rather than "someone reported
  // and none is loading": on a refresh the blocks report one at a time, and the
  // weaker rule stops the spinner the instant the first cached block lands while
  // six requests are still in flight — which is the dishonesty being fixed.
  test('one fast block landing alone is not settled', () => {
    expect(isHomeSettled({ hero: { phase: 'ready', itemCount: 2 } })).toBe(false);
  });

  test('six of seven reported is not settled', () => {
    const states = allBlocks({ phase: 'ready', itemCount: 4 });
    delete states.recommended;
    expect(isHomeSettled(states)).toBe(false);
  });

  // `retry()` clears states before remounting the blocks. That frame must not
  // read as "finished", or the spinner vanishes the moment it is pulled.
  test('the cleared state at the start of a refresh is not settled', () => {
    expect(isHomeSettled({})).toBe(false);
  });
});
