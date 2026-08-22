/**
 * The search screen's default state — what fills the screen before anything is
 * typed. Four sections, ported from `ModalSearch.tsx:837-934`, all of which the
 * web renders at phone width.
 *
 * Data only, plus one pure function. Icon names are Ionicons glyphs and MUST be
 * validated against
 * `@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json`
 * — a wrong name renders a blank box and passes tsc, the tests AND the bundle.
 */

import type { RecentSearch } from './recent-searches.ts';

export interface QuickAction {
  label: string;
  /** Ionicons glyph — validated 2026-08-19. */
  icon: string;
  /** The web's href. `/shop` is still a stub screen; the URL is correct anyway. */
  href: string;
  tint: string;
  background: string;
  border: string;
  text: string;
}

export const QUICK_ACTIONS: QuickAction[] = [
  {
    label: 'On Sale',
    icon: 'pricetag',
    href: '/deals',
    tint: '#dc2626',
    background: '#fef2f2',
    border: '#fee2e2',
    text: '#b91c1c',
  },
  {
    label: 'New Arrivals',
    icon: 'sparkles',
    href: '/shop?sort=newest',
    tint: '#059669',
    background: '#ecfdf5',
    border: '#d1fae5',
    text: '#047857',
  },
  {
    label: 'Bestsellers',
    icon: 'trending-up',
    href: '/shop?sort=popular',
    tint: '#ea580c',
    background: '#fff7ed',
    border: '#ffedd5',
    text: '#c2410c',
  },
  {
    label: 'Top Rated',
    icon: 'star',
    href: '/shop?minRating=4',
    tint: '#ca8a04',
    background: '#fefce8',
    border: '#fef9c3',
    text: '#a16207',
  },
];

export interface BrowseCategory {
  name: string;
  emoji: string;
  slug: string;
  background: string;
  border: string;
  text: string;
}

/** Emoji rather than glyphs, exactly as the web — nothing to validate. */
export const BROWSE_CATEGORIES: BrowseCategory[] = [
  { name: 'Whiskey',   emoji: '🥃', slug: 'whiskey',   background: '#fffbeb', border: '#fde68a', text: '#92400e' },
  { name: 'Wine',      emoji: '🍷', slug: 'wine',      background: '#fff1f2', border: '#fecdd3', text: '#9f1239' },
  { name: 'Beer',      emoji: '🍺', slug: 'beer',      background: '#fefce8', border: '#fef08a', text: '#854d0e' },
  { name: 'Champagne', emoji: '🍾', slug: 'champagne', background: '#fffbeb', border: '#fde68a', text: '#92400e' },
  { name: 'Vodka',     emoji: '🫗', slug: 'vodka',     background: '#f0f9ff', border: '#bae6fd', text: '#075985' },
  { name: 'Gin',       emoji: '🍸', slug: 'gin',       background: '#f0fdfa', border: '#99f6e4', text: '#115e59' },
  { name: 'Rum',       emoji: '🌴', slug: 'rum',       background: '#fff7ed', border: '#fed7aa', text: '#9a3412' },
  { name: 'Spirits',   emoji: '✨', slug: 'spirit',    background: '#faf5ff', border: '#e9d5ff', text: '#6b21a8' },
];

export const POPULAR_SEARCHES: string[] = [
  'Whiskey', 'Red Wine', 'Beer', 'Vodka', 'Champagne',
  'Gin', 'Rum', 'Brandy', 'Tequila', 'Rosé',
];

export const SUGGESTION_LIMIT = 8;

/**
 * What to offer when `/api/products/suggestions` answers with nothing —
 * recents first, then the popular list, de-duplicated case-insensitively.
 * Transcribed from `ModalSearchContext.tsx:449-463`.
 */
export function suggestionFallback(query: string, recents: RecentSearch[]): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const seen = new Set<string>();
  const out: string[] = [];

  for (const s of [...recents.map((r) => r.query), ...POPULAR_SEARCHES]) {
    const lower = s.toLowerCase();
    if (lower.includes(q) && !seen.has(lower)) {
      seen.add(lower);
      out.push(s);
      if (out.length >= SUGGESTION_LIMIT) break;
    }
  }

  return out;
}

/**
 * Which list the chip strip shows. Transcribed from the web's
 * `ModalSearchContext.tsx:436-463`, which computes exactly this and then never
 * renders it — no component consumes `suggestions`. The mobile search screen
 * does render it, at the user's explicit request. See
 * `RESUME-mobile-home-web-parity.md` §0e: this is a deliberate mobile-only
 * addition, not a parity gap to be "cleaned up".
 *
 * `fromServer === null` means the request FAILED — not "no matches". Both fall
 * back, because a dead endpoint should still leave something tappable.
 */
export function resolveSuggestions(
  fromServer: string[] | null,
  term: string,
  recents: RecentSearch[],
): string[] {
  const typed = term.trim().toLowerCase();
  if (!typed) return [];

  const fromServerClean = (fromServer ?? []).filter(
    (s): s is string => typeof s === 'string' && s.trim().length > 0,
  );

  // A server list that answered wins outright; whether it then survives the
  // "don't offer back what is typed" filter is a separate question — an
  // answered-but-fully-filtered list stays empty rather than falling back.
  const base = fromServerClean.length ? fromServerClean : suggestionFallback(term, recents);

  return base.filter((s) => s.trim().toLowerCase() !== typed).slice(0, SUGGESTION_LIMIT);
}
