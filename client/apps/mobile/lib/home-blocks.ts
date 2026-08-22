/**
 * Which home blocks exist, in what order, and when each one is allowed to be
 * on screen.
 *
 * The order and the membership are not a design choice made here — they are
 * `apps/platform/src/app/page.tsx`, read top to bottom. Note what is NOT in the
 * list: the web page mounts `HomeCategoryDrawer` first, but its `showCategories`
 * state is initialised `false` and never set, so it renders nothing. There is no
 * category rail on the platform homepage, and there is none here.
 *
 * The rules live here rather than inside each block component because a block
 * component cannot be rendered in this test setup, and "did the failing rail
 * disappear" is exactly the behaviour worth pinning down.
 */

export type HomeBlockId =
  | 'hero'
  | 'flashSale'
  | 'featuredDeals'
  | 'featuredProducts'
  | 'secondaryBanner'
  | 'benefits'
  | 'recommended';

export type BlockPhase = 'loading' | 'ready' | 'error';

export interface BlockState {
  phase: BlockPhase;
  itemCount: number;
}

/** Web parity, in web order — `page.tsx:160-208`. */
export const HOME_BLOCK_ORDER: readonly HomeBlockId[] = [
  'hero',
  'flashSale',
  'featuredDeals',
  'featuredProducts',
  'secondaryBanner',
  'benefits',
  'recommended',
];

/**
 * loading -> skeleton, error -> nothing, empty -> nothing.
 *
 * No block on this screen is essential to its purpose, so a failure is logged
 * and hidden rather than surfaced. Four stacked "Error: 500" rows is a broken
 * screen; one missing rail is a normal one.
 *
 * Two blocks deliberately never reach `hidden`: the hero substitutes its
 * fallback slides, and Benefits is static copy. Both mirror the web.
 */
export function blockRender(state: BlockState): 'skeleton' | 'content' | 'hidden' {
  if (state.phase === 'loading') return 'skeleton';
  if (state.phase === 'error') return 'hidden';
  return state.itemCount > 0 ? 'content' : 'hidden';
}

/**
 * True only once every reporting block has settled and none produced content.
 * A single still-loading block keeps this false, so the retry screen never
 * flashes over a home that is merely slow.
 */
/**
 * True once every block has finished — the signal the pull-to-refresh spinner
 * stops on.
 *
 * Home owns no fetch of its own, so there is no single loading flag to read;
 * this derives one from the states the screen already collects. That is sound
 * because every block reports unconditionally on mount — six through
 * `components/home/use-block.ts`, whose `run()` sets `loading` synchronously
 * before it awaits, and Benefit, which reports `ready` in a mount effect.
 *
 * It demands **all seven**, not "someone reported and nobody is loading": on a
 * refresh the blocks land one at a time, and the weaker rule would stop the
 * spinner as soon as the first cached block arrived while six requests were
 * still in flight. `{}` is deliberately unsettled — `retry()` clears the states
 * before remounting the blocks, and that frame must not read as finished.
 */
export function isHomeSettled(states: Partial<Record<HomeBlockId, BlockState>>): boolean {
  return HOME_BLOCK_ORDER.every((id) => states[id] && states[id]?.phase !== 'loading');
}

export function isHomeEmpty(states: Partial<Record<HomeBlockId, BlockState>>): boolean {
  const reported = Object.values(states).filter((s): s is BlockState => !!s);
  if (!reported.length) return false;
  if (reported.some((s) => s.phase === 'loading')) return false;

  return reported.every((s) => blockRender(s) === 'hidden');
}
