// Maps category slugs/names to Phosphor Icons (react-icons/pi) so the
// mobile category drawer and the desktop sidebar use consistent, themeable
// SVG icons instead of emoji. Falls back to a wine glass for unknown cats.

import * as Icon from "react-icons/pi";

export interface CategoryIcon {
  icon: React.ElementType;
  color: string;       // hex — used for tinted backgrounds
  bgTint: string;       // tailwind bg-* class for the chip background
}

const FALLBACK: CategoryIcon = {
  icon: Icon.PiWine,
  color: "#B91C1C",
  bgTint: "bg-red-50",
};

// Slug/name → icon mapping. Keys are lowercased and matched against either
// the category slug or name (both checked in resolveCategoryIcon).
const MAP: Record<string, CategoryIcon> = {
  // ─── Beverages ───────────────────────────────────────────────────────────
  wine:        { icon: Icon.PiWine,           color: "#9333EA", bgTint: "bg-purple-50" },
  red:         { icon: Icon.PiWine,           color: "#B91C1C", bgTint: "bg-red-50" },
  white:       { icon: Icon.PiWine,           color: "#CA8A04", bgTint: "bg-amber-50" },
  champagne:   { icon: Icon.PiWine,           color: "#CA8A04", bgTint: "bg-yellow-50" },
  sparkling:   { icon: Icon.PiWine,           color: "#0891B2", bgTint: "bg-cyan-50" },
  rose:        { icon: Icon.PiWine,           color: "#DB2777", bgTint: "bg-pink-50" },

  spirit:      { icon: Icon.PiFlask,          color: "#B45309", bgTint: "bg-amber-50" },
  spirits:     { icon: Icon.PiFlask,          color: "#B45309", bgTint: "bg-amber-50" },
  whiskey:     { icon: Icon.PiFlask,          color: "#78350F", bgTint: "bg-amber-100" },
  whisky:      { icon: Icon.PiFlask,          color: "#78350F", bgTint: "bg-amber-100" },
  vodka:       { icon: Icon.PiFlask,          color: "#0EA5E9", bgTint: "bg-sky-50" },
  rum:         { icon: Icon.PiFlask,          color: "#92400E", bgTint: "bg-amber-50" },
  gin:         { icon: Icon.PiFlask,          color: "#0D9488", bgTint: "bg-teal-50" },
  tequila:     { icon: Icon.PiFlask,          color: "#A16207", bgTint: "bg-yellow-50" },
  cognac:      { icon: Icon.PiFlask,          color: "#7C2D12", bgTint: "bg-orange-50" },
  brandy:      { icon: Icon.PiFlask,          color: "#7C2D12", bgTint: "bg-orange-50" },
  liqueur:     { icon: Icon.PiFlask,          color: "#BE185D", bgTint: "bg-pink-50" },
  liqueurs:    { icon: Icon.PiFlask,          color: "#BE185D", bgTint: "bg-pink-50" },

  beer:        { icon: Icon.PiBeerBottle,     color: "#CA8A04", bgTint: "bg-yellow-50" },
  beers:       { icon: Icon.PiBeerBottle,     color: "#CA8A04", bgTint: "bg-yellow-50" },
  ale:         { icon: Icon.PiBeerBottle,     color: "#A16207", bgTint: "bg-amber-50" },
  stout:       { icon: Icon.PiBeerBottle,     color: "#1E293B", bgTint: "bg-slate-100" },
  cider:       { icon: Icon.PiBeerBottle,     color: "#84CC16", bgTint: "bg-lime-50" },

  coffee:      { icon: Icon.PiCoffee,         color: "#78350F", bgTint: "bg-amber-100" },
  tea:         { icon: Icon.PiTeaBag,         color: "#16A34A", bgTint: "bg-green-50" },
  juice:       { icon: Icon.PiPintGlass,      color: "#EA580C", bgTint: "bg-orange-50" },
  water:       { icon: Icon.PiDrop,           color: "#0EA5E9", bgTint: "bg-sky-50" },
  soda:        { icon: Icon.PiPintGlass,      color: "#DC2626", bgTint: "bg-red-50" },
  soft:        { icon: Icon.PiPintGlass,      color: "#DC2626", bgTint: "bg-red-50" },
  energy:      { icon: Icon.PiLightning,      color: "#16A34A", bgTint: "bg-green-50" },

  // ─── Cocktail / recipe ───────────────────────────────────────────────────
  cocktail:    { icon: Icon.PiMartini,        color: "#BE185D", bgTint: "bg-pink-50" },
  cocktails:   { icon: Icon.PiMartini,        color: "#BE185D", bgTint: "bg-pink-50" },
  recipe:      { icon: Icon.PiCookingPot,     color: "#EA580C", bgTint: "bg-orange-50" },
  recipes:     { icon: Icon.PiCookingPot,     color: "#EA580C", bgTint: "bg-orange-50" },

  // ─── Accessories / gifts ─────────────────────────────────────────────────
  accessory:   { icon: Icon.PiSprayBottle,    color: "#6B7280", bgTint: "bg-gray-100" },
  accessories: { icon: Icon.PiSprayBottle,    color: "#6B7280", bgTint: "bg-gray-100" },
  gift:        { icon: Icon.PiGift,           color: "#DB2777", bgTint: "bg-pink-50" },
  gifts:       { icon: Icon.PiGift,           color: "#DB2777", bgTint: "bg-pink-50" },
  hamper:      { icon: Icon.PiGift,           color: "#DB2777", bgTint: "bg-pink-50" },
  mixers:      { icon: Icon.PiBowlSteam,      color: "#0891B2", bgTint: "bg-cyan-50" },
  ice:         { icon: Icon.PiSnowflake,      color: "#0EA5E9", bgTint: "bg-sky-50" },
  glassware:   { icon: Icon.PiPintGlass,      color: "#6B7280", bgTint: "bg-gray-100" },
};

function normalize(s?: string): string {
  return String(s || "").toLowerCase().trim();
}

/** Resolve a Category or SubCategory to a Phosphor icon + color. */
export function resolveCategoryIcon(cat: { slug?: string; name?: string; icon?: string; color?: string }): CategoryIcon {
  const slug = normalize(cat.slug);
  const name = normalize(cat.name);

  // 1. Try slug match
  if (MAP[slug]) return MAP[slug];
  // 2. Try name match
  if (MAP[name]) return MAP[name];
  // 3. Try partial name match (e.g. "Red Wine" → "wine")
  for (const key of Object.keys(MAP)) {
    if (name.includes(key) || slug.includes(key)) return MAP[key];
  }
  // 4. Fall back — allow a custom color override from the category data
  if (cat.color) {
    return { icon: FALLBACK.icon, color: cat.color, bgTint: FALLBACK.bgTint };
  }
  return FALLBACK;
}