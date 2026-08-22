/**
 * Category slug/name → icon, colour and chip tint.
 *
 * A port of `apps/platform/src/lib/category-icons.ts`. **The hex colours and the
 * Tailwind tint classes are the web's, verbatim** — only the glyph identity
 * differs, because the web draws Phosphor (`react-icons/pi`) and this draws
 * MaterialCommunityIcons from `@expo/vector-icons`. Keeping the colours identical
 * is what makes a category chip look the same on both.
 *
 * `icon` is a glyph NAME rather than a component so this module stays pure and
 * testable — nothing here imports React.
 */

export interface CategoryIcon {
  /** MaterialCommunityIcons glyph name. */
  icon: string;
  /** Hex — the glyph colour, and the web's tint source. */
  color: string;
  /** Tailwind class for the chip background. */
  bgTint: string;
}

export const CATEGORY_ICON_FALLBACK: CategoryIcon = {
  icon: 'glass-wine',
  color: '#B91C1C',
  bgTint: 'bg-red-50',
};

/**
 * Keys are matched against slug, then name, then as a substring of either —
 * insertion order therefore matters for the substring pass, exactly as it does
 * on the web (`Object.keys(MAP)`).
 */
const MAP: Record<string, CategoryIcon> = {
  // ─── Beverages ───────────────────────────────────────────────────────────
  wine: { icon: 'glass-wine', color: '#9333EA', bgTint: 'bg-purple-50' },
  red: { icon: 'glass-wine', color: '#B91C1C', bgTint: 'bg-red-50' },
  white: { icon: 'glass-wine', color: '#CA8A04', bgTint: 'bg-amber-50' },
  champagne: { icon: 'glass-flute', color: '#CA8A04', bgTint: 'bg-yellow-50' },
  sparkling: { icon: 'glass-flute', color: '#0891B2', bgTint: 'bg-cyan-50' },
  rose: { icon: 'glass-wine', color: '#DB2777', bgTint: 'bg-pink-50' },

  spirit: { icon: 'flask', color: '#B45309', bgTint: 'bg-amber-50' },
  spirits: { icon: 'flask', color: '#B45309', bgTint: 'bg-amber-50' },
  whiskey: { icon: 'glass-tulip', color: '#78350F', bgTint: 'bg-amber-100' },
  whisky: { icon: 'glass-tulip', color: '#78350F', bgTint: 'bg-amber-100' },
  vodka: { icon: 'bottle-tonic', color: '#0EA5E9', bgTint: 'bg-sky-50' },
  rum: { icon: 'bottle-tonic', color: '#92400E', bgTint: 'bg-amber-50' },
  gin: { icon: 'bottle-tonic', color: '#0D9488', bgTint: 'bg-teal-50' },
  tequila: { icon: 'bottle-tonic', color: '#A16207', bgTint: 'bg-yellow-50' },
  cognac: { icon: 'glass-tulip', color: '#7C2D12', bgTint: 'bg-orange-50' },
  brandy: { icon: 'glass-tulip', color: '#7C2D12', bgTint: 'bg-orange-50' },
  liqueur: { icon: 'bottle-tonic-plus', color: '#BE185D', bgTint: 'bg-pink-50' },
  liqueurs: { icon: 'bottle-tonic-plus', color: '#BE185D', bgTint: 'bg-pink-50' },

  beer: { icon: 'bottle-wine', color: '#CA8A04', bgTint: 'bg-yellow-50' },
  beers: { icon: 'bottle-wine', color: '#CA8A04', bgTint: 'bg-yellow-50' },
  ale: { icon: 'glass-mug', color: '#A16207', bgTint: 'bg-amber-50' },
  stout: { icon: 'glass-mug', color: '#1E293B', bgTint: 'bg-slate-100' },
  cider: { icon: 'glass-mug-variant', color: '#84CC16', bgTint: 'bg-lime-50' },

  coffee: { icon: 'coffee', color: '#78350F', bgTint: 'bg-amber-100' },
  tea: { icon: 'tea', color: '#16A34A', bgTint: 'bg-green-50' },
  juice: { icon: 'cup', color: '#EA580C', bgTint: 'bg-orange-50' },
  water: { icon: 'water', color: '#0EA5E9', bgTint: 'bg-sky-50' },
  soda: { icon: 'cup', color: '#DC2626', bgTint: 'bg-red-50' },
  soft: { icon: 'cup', color: '#DC2626', bgTint: 'bg-red-50' },
  energy: { icon: 'lightning-bolt', color: '#16A34A', bgTint: 'bg-green-50' },

  // ─── Cocktail / recipe ───────────────────────────────────────────────────
  cocktail: { icon: 'glass-cocktail', color: '#BE185D', bgTint: 'bg-pink-50' },
  cocktails: { icon: 'glass-cocktail', color: '#BE185D', bgTint: 'bg-pink-50' },
  recipe: { icon: 'pot-steam', color: '#EA580C', bgTint: 'bg-orange-50' },
  recipes: { icon: 'pot-steam', color: '#EA580C', bgTint: 'bg-orange-50' },

  // ─── Accessories / gifts ─────────────────────────────────────────────────
  accessory: { icon: 'spray-bottle', color: '#6B7280', bgTint: 'bg-gray-100' },
  accessories: { icon: 'spray-bottle', color: '#6B7280', bgTint: 'bg-gray-100' },
  gift: { icon: 'gift', color: '#DB2777', bgTint: 'bg-pink-50' },
  gifts: { icon: 'gift', color: '#DB2777', bgTint: 'bg-pink-50' },
  hamper: { icon: 'gift', color: '#DB2777', bgTint: 'bg-pink-50' },
  mixers: { icon: 'bowl-mix', color: '#0891B2', bgTint: 'bg-cyan-50' },
  ice: { icon: 'snowflake', color: '#0EA5E9', bgTint: 'bg-sky-50' },
  glassware: { icon: 'glass-mug-variant', color: '#6B7280', bgTint: 'bg-gray-100' },
};

const normalize = (value?: string): string => String(value ?? '').toLowerCase().trim();

export function resolveCategoryIcon(cat: {
  slug?: string;
  name?: string;
  icon?: string;
  color?: string;
}): CategoryIcon {
  const slug = normalize(cat.slug);
  const name = normalize(cat.name);

  if (MAP[slug]) return MAP[slug];
  if (MAP[name]) return MAP[name];

  // Partial match, e.g. "Red Wine" → "red".
  for (const key of Object.keys(MAP)) {
    if ((name && name.includes(key)) || (slug && slug.includes(key))) return MAP[key];
  }

  // Unknown, but the category carries its own brand colour.
  if (cat.color) {
    return { icon: CATEGORY_ICON_FALLBACK.icon, color: cat.color, bgTint: CATEGORY_ICON_FALLBACK.bgTint };
  }

  return CATEGORY_ICON_FALLBACK;
}
