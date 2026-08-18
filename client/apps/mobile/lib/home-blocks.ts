/**
 * Which home blocks exist, in what order, and when each one is allowed to be
 * on screen.
 *
 * The rules live here rather than inside each block component because a block
 * component cannot be rendered in this test setup, and "did the failing rail
 * disappear" is exactly the behaviour worth pinning down.
 */

export type HomeBlockId =
  | 'categories'
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

/** Web parity, in web order — an explicit user decision (design §2). */
export const HOME_BLOCK_ORDER: readonly HomeBlockId[] = [
  'categories',
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
export function isHomeEmpty(states: Partial<Record<HomeBlockId, BlockState>>): boolean {
  const reported = Object.values(states).filter((s): s is BlockState => !!s);
  if (!reported.length) return false;
  if (reported.some((s) => s.phase === 'loading')) return false;

  return reported.every((s) => blockRender(s) === 'hidden');
}
