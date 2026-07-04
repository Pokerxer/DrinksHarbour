'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

// ─── Per-category visual configs ─────────────────────────────────────────────

interface BannerConfig {
  label: string;
  tagline: string;
  from: string;
  via: string;
  to: string;
  accent: string;       // hex – used for eyebrow, chips, glow
  accentClass: string;  // tailwind text class
  icon: string;
  subcategories: Array<{ label: string; slug: string }>;
}

const CONFIGS: Record<string, BannerConfig> = {
  whisky: {
    label: 'Whisky',
    tagline: "From Speyside peat to bourbon oak — the world's finest drams",
    from: '#431407', via: '#1c0a00', to: '#0c0500',
    accent: '#F59E0B', accentClass: 'text-amber-400',
    icon: '🥃',
    subcategories: [
      { label: 'Single Malt', slug: 'single-malt' },
      { label: 'Blended', slug: 'blended' },
      { label: 'Bourbon', slug: 'bourbon' },
      { label: 'Irish Whiskey', slug: 'irish whiskey' },
      { label: 'Japanese Whisky', slug: 'japanese whisky' },
      { label: 'Rye', slug: 'rye' },
    ],
  },
  whiskey: {
    label: 'Whiskey',
    tagline: "America's boldest spirits, straight from the barrel",
    from: '#431407', via: '#1c0a00', to: '#0c0500',
    accent: '#FB923C', accentClass: 'text-orange-400',
    icon: '🥃',
    subcategories: [
      { label: 'Bourbon', slug: 'bourbon' },
      { label: 'Irish', slug: 'irish whiskey' },
      { label: 'Rye', slug: 'rye' },
    ],
  },
  scotch: {
    label: 'Scotch Whisky',
    tagline: 'Highland heather, Islay smoke — Scotland in every sip',
    from: '#78350F', via: '#2d1000', to: '#0c0500',
    accent: '#FCD34D', accentClass: 'text-yellow-300',
    icon: '🥃',
    subcategories: [
      { label: 'Single Malt', slug: 'single-malt' },
      { label: 'Blended', slug: 'blended' },
      { label: 'Peated', slug: 'peaty' },
    ],
  },
  'scotch-whisky': {
    label: 'Scotch Whisky',
    tagline: 'Highland heather, Islay smoke — Scotland in every sip',
    from: '#78350F', via: '#2d1000', to: '#0c0500',
    accent: '#FCD34D', accentClass: 'text-yellow-300',
    icon: '🥃',
    subcategories: [
      { label: 'Single Malt', slug: 'single-malt' },
      { label: 'Blended', slug: 'blended' },
    ],
  },
  wine: {
    label: 'Wine',
    tagline: 'A world of vintages — from Bordeaux to the Cape',
    from: '#2e1065', via: '#1a0540', to: '#0d0020',
    accent: '#A78BFA', accentClass: 'text-violet-400',
    icon: '🍷',
    subcategories: [
      { label: 'Red Wine', slug: 'red wine' },
      { label: 'White Wine', slug: 'white wine' },
      { label: 'Rosé', slug: 'rosé' },
      { label: 'Sparkling', slug: 'sparkling' },
      { label: 'Dessert Wine', slug: 'dessert wine' },
    ],
  },
  champagne: {
    label: 'Champagne',
    tagline: 'Fine effervescence — every bottle, a moment to remember',
    from: '#3f2000', via: '#1c0e00', to: '#0c0600',
    accent: '#FCD34D', accentClass: 'text-yellow-300',
    icon: '🥂',
    subcategories: [],
  },
  vodka: {
    label: 'Vodka',
    tagline: 'Crystal clear, effortlessly smooth',
    from: '#0c1a3d', via: '#050e24', to: '#020810',
    accent: '#93C5FD', accentClass: 'text-blue-300',
    icon: '🍸',
    subcategories: [
      { label: 'Premium', slug: 'premium vodka' },
      { label: 'Flavoured', slug: 'flavoured vodka' },
    ],
  },
  gin: {
    label: 'Gin',
    tagline: 'Juniper-led journeys through botanical landscapes',
    from: '#052e16', via: '#011f0e', to: '#000f07',
    accent: '#34D399', accentClass: 'text-emerald-400',
    icon: '🌿',
    subcategories: [
      { label: 'London Dry', slug: 'london dry' },
      { label: 'Craft Gin', slug: 'craft gin' },
      { label: 'Flavoured', slug: 'flavoured gin' },
    ],
  },
  rum: {
    label: 'Rum',
    tagline: 'Sun-soaked sugar cane from the Caribbean and beyond',
    from: '#450a0a', via: '#1c0404', to: '#0c0000',
    accent: '#FB923C', accentClass: 'text-orange-400',
    icon: '🍹',
    subcategories: [
      { label: 'Dark Rum', slug: 'dark rum' },
      { label: 'White Rum', slug: 'white rum' },
      { label: 'Spiced Rum', slug: 'spiced rum' },
    ],
  },
  tequila: {
    label: 'Tequila',
    tagline: 'Blue agave from the high plains of Jalisco',
    from: '#1a2e05', via: '#0c1a02', to: '#060e01',
    accent: '#A3E635', accentClass: 'text-lime-400',
    icon: '🌵',
    subcategories: [],
  },
  mezcal: {
    label: 'Mezcal',
    tagline: 'Artisanal smoke from Oaxacan agave hearts',
    from: '#1c1917', via: '#0c0a09', to: '#050403',
    accent: '#D6D3D1', accentClass: 'text-stone-300',
    icon: '🏺',
    subcategories: [],
  },
  cognac: {
    label: 'Cognac',
    tagline: 'The measured art of French distillation and oak aging',
    from: '#3f1a00', via: '#1c0d00', to: '#0c0500',
    accent: '#FCD34D', accentClass: 'text-yellow-300',
    icon: '🍾',
    subcategories: [],
  },
  brandy: {
    label: 'Brandy & Cognac',
    tagline: 'Aged to quiet perfection — decades in the making',
    from: '#2e1065', via: '#170530', to: '#0d0020',
    accent: '#C084FC', accentClass: 'text-purple-400',
    icon: '🥃',
    subcategories: [],
  },
  beer: {
    label: 'Beer',
    tagline: 'From craft ales to lager classics — every pour counts',
    from: '#3f2000', via: '#1c0e00', to: '#0c0600',
    accent: '#FCD34D', accentClass: 'text-yellow-300',
    icon: '🍺',
    subcategories: [
      { label: 'Craft Beer', slug: 'craft beer' },
      { label: 'Lager', slug: 'lager' },
      { label: 'Stout', slug: 'stout' },
      { label: 'Ale', slug: 'ale' },
      { label: 'IPA', slug: 'ipa' },
    ],
  },
  cider: {
    label: 'Cider',
    tagline: 'Crisp apple harvests — orchard to glass',
    from: '#14300a', via: '#091804', to: '#040b02',
    accent: '#BEF264', accentClass: 'text-lime-300',
    icon: '🍎',
    subcategories: [],
  },
  liqueur: {
    label: 'Liqueurs',
    tagline: 'Sweet complexity — amaretto, cream, and everything between',
    from: '#500724', via: '#2a0412', to: '#15020a',
    accent: '#F9A8D4', accentClass: 'text-pink-300',
    icon: '🍬',
    subcategories: [],
  },
  spirits: {
    label: 'Spirits',
    tagline: "The world's finest distilled — explore the full range",
    from: '#18181b', via: '#0f0f12', to: '#060608',
    accent: '#D4D4D8', accentClass: 'text-zinc-300',
    icon: '🍶',
    subcategories: [
      { label: 'Whisky', slug: 'whisky' },
      { label: 'Vodka', slug: 'vodka' },
      { label: 'Gin', slug: 'gin' },
      { label: 'Rum', slug: 'rum' },
      { label: 'Tequila', slug: 'tequila' },
    ],
  },
  'non-alcoholic': {
    label: 'Non-Alcoholic',
    tagline: 'Premium alcohol-free — full flavour, zero compromise',
    from: '#0c2d3d', via: '#061824', to: '#020c12',
    accent: '#67E8F9', accentClass: 'text-cyan-300',
    icon: '🫗',
    subcategories: [],
  },
  'gift-sets': {
    label: 'Gift Sets',
    tagline: 'Curated for moments that deserve more than words',
    from: '#4a0d1e', via: '#250612', to: '#110308',
    accent: '#FDA4AF', accentClass: 'text-rose-300',
    icon: '🎁',
    subcategories: [],
  },
  sake: {
    label: 'Sake',
    tagline: 'The quiet art of Japanese rice wine',
    from: '#0f2233', via: '#06121c', to: '#02070e',
    accent: '#BAE6FD', accentClass: 'text-sky-200',
    icon: '🍶',
    subcategories: [],
  },
  port: {
    label: 'Port & Fortified',
    tagline: 'Centuries of craft from the Douro Valley',
    from: '#3b0c1e', via: '#1c060f', to: '#0d0207',
    accent: '#FDA4AF', accentClass: 'text-rose-300',
    icon: '🍷',
    subcategories: [],
  },
  bitters: {
    label: 'Bitters',
    tagline: 'Complexity in every drop — cocktail-ready aperitivo',
    from: '#1a2e05', via: '#0a1a03', to: '#050d01',
    accent: '#86EFAC', accentClass: 'text-green-300',
    icon: '🫙',
    subcategories: [],
  },
  mixers: {
    label: 'Mixers & Sodas',
    tagline: 'The perfect complement — premium tonics and sodas',
    from: '#0c2740', via: '#061522', to: '#020a0f',
    accent: '#7DD3FC', accentClass: 'text-sky-300',
    icon: '🥤',
    subcategories: [],
  },
};

// ─── Subcategory-to-parent mapping for subcat-only pages ─────────────────────

const SUBCAT_PARENT: Record<string, string> = {
  'single-malt': 'whisky', 'single malt': 'whisky',
  'blended': 'whisky', 'bourbon': 'whisky',
  'irish whiskey': 'whisky', 'japanese whisky': 'whisky', 'rye': 'whisky',
  'red wine': 'wine', 'white wine': 'wine', 'rosé': 'wine', 'rose': 'wine',
  'sparkling': 'wine', 'dessert wine': 'wine',
  'dark rum': 'rum', 'white rum': 'rum', 'spiced rum': 'rum',
  'london dry': 'gin', 'craft gin': 'gin', 'flavoured gin': 'gin',
  'premium vodka': 'vodka', 'flavoured vodka': 'vodka',
  'craft beer': 'beer', 'lager': 'beer', 'stout': 'beer', 'ale': 'beer', 'ipa': 'beer',
};

// ─── Subcategory label overrides ──────────────────────────────────────────────

const SUBCAT_LABELS: Record<string, { label: string; tagline: string }> = {
  'single-malt': { label: 'Single Malt', tagline: 'One distillery, one grain, one truth' },
  'single malt': { label: 'Single Malt', tagline: 'One distillery, one grain, one truth' },
  blended: { label: 'Blended Whisky', tagline: "The master blender's art — consistency and depth" },
  bourbon: { label: 'Bourbon', tagline: 'American oak, caramel and vanilla — the original spirit' },
  'irish whiskey': { label: 'Irish Whiskey', tagline: 'Triple-distilled, effortlessly smooth' },
  'japanese whisky': { label: 'Japanese Whisky', tagline: 'Precision, balance, and decades of patience' },
  rye: { label: 'Rye Whiskey', tagline: 'Spicy, bold, and unapologetically assertive' },
  'red wine': { label: 'Red Wine', tagline: 'Cabernet, Merlot, Pinot Noir and beyond' },
  'white wine': { label: 'White Wine', tagline: 'Crisp, elegant, and endlessly food-friendly' },
  'rosé': { label: 'Rosé', tagline: 'The blush of summer — dry, fresh, and versatile' },
  rose: { label: 'Rosé', tagline: 'The blush of summer — dry, fresh, and versatile' },
  sparkling: { label: 'Sparkling Wine', tagline: 'Bubbles for every celebration' },
  'dessert wine': { label: 'Dessert Wine', tagline: 'Concentrated sweetness — sip slowly' },
  'dark rum': { label: 'Dark Rum', tagline: 'Molasses-rich, aged in oak' },
  'white rum': { label: 'White Rum', tagline: 'Clean, light, cocktail-ready' },
  'spiced rum': { label: 'Spiced Rum', tagline: 'Vanilla, cinnamon, and the warmth of the Caribbean' },
  'london dry': { label: 'London Dry Gin', tagline: 'Classic juniper — the original benchmark' },
  'craft gin': { label: 'Craft Gin', tagline: 'Small-batch botanical complexity' },
  'flavoured gin': { label: 'Flavoured Gin', tagline: 'Pink, citrus, and every fruit in between' },
  'premium vodka': { label: 'Premium Vodka', tagline: 'Grey Goose, Belvedere, Ketel One — the best of the best' },
  'flavoured vodka': { label: 'Flavoured Vodka', tagline: 'Cîroc and beyond — flavour without compromise' },
  'craft beer': { label: 'Craft Beer', tagline: 'Small-batch, big character' },
  lager: { label: 'Lager', tagline: 'Crisp, cold, and endlessly refreshing' },
  stout: { label: 'Stout', tagline: 'Dark, roasted, and complex — Guinness and beyond' },
  ale: { label: 'Ale', tagline: "From pale to porter — Britain's finest" },
  ipa: { label: 'IPA', tagline: 'Hop-forward, aromatic, and beautifully bitter' },
};

// ─── Default banner (no active category/subcategory) ─────────────────────────

const DEFAULT_CHIPS = [
  { label: 'Whisky', slug: 'whisky', icon: '🥃' },
  { label: 'Wine', slug: 'wine', icon: '🍷' },
  { label: 'Cognac', slug: 'cognac', icon: '🍾' },
  { label: 'Vodka', slug: 'vodka', icon: '🍸' },
  { label: 'Gin', slug: 'gin', icon: '🌿' },
  { label: 'Rum', slug: 'rum', icon: '🍹' },
  { label: 'Beer', slug: 'beer', icon: '🍺' },
  { label: 'Champagne', slug: 'champagne', icon: '🥂' },
  { label: 'Tequila', slug: 'tequila', icon: '🌵' },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface ShopHeroBannerProps {
  category?: string | null;
  subcategory?: string | null;
  brand?: string | null;
  totalProducts?: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ShopHeroBanner({
  category,
  subcategory,
  brand,
  totalProducts,
}: ShopHeroBannerProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Resolve which config to use
  const { config, activeCat, activeSub } = useMemo(() => {
    // Normalize
    const cat = typeof category === 'string' ? category.toLowerCase() : null;
    const sub = typeof subcategory === 'string' ? subcategory.toLowerCase() : null;

    // Subcategory overrides category for config lookup (use parent cat config)
    const parentCat = sub ? (SUBCAT_PARENT[sub] ?? cat) : cat;
    const cfg = (parentCat && CONFIGS[parentCat]) ? CONFIGS[parentCat] : null;

    return { config: cfg, activeCat: parentCat, activeSub: sub };
  }, [category, subcategory]);

  // Build subcategory pill URL (toggles subcategory param)
  const makeSubUrl = (slug: string | null) => {
    const p = new URLSearchParams(searchParams.toString());
    if (!slug) {
      p.delete('subcategory');
    } else {
      p.set('subcategory', slug);
    }
    const qs = p.toString();
    return `${pathname}${qs ? `?${qs}` : ''}`;
  };

  const makeCategoryUrl = (slug: string) => {
    const p = new URLSearchParams();
    p.set('category', slug);
    return `${pathname}?${p.toString()}`;
  };

  // ── Determine display values ──────────────────────────────────────────────
  const subcatInfo = activeSub ? SUBCAT_LABELS[activeSub] : null;

  const displayLabel  = subcatInfo?.label  ?? config?.label  ?? 'All Drinks';
  const displayTagline = subcatInfo?.tagline ?? config?.tagline ?? "Nigeria's widest premium selection — wines, spirits, beers and more";
  const displayIcon   = config?.icon ?? '🥂';

  const from    = config?.from    ?? '#111827';
  const via     = config?.via     ?? '#060912';
  const to      = config?.to      ?? '#020408';
  const accent  = config?.accent  ?? '#E5E7EB';
  const accentClass = config?.accentClass ?? 'text-gray-300';

  const eyebrow = activeSub
    ? (config?.label?.toUpperCase() ?? 'SPIRITS')
    : (config ? 'CATEGORY' : 'ALL DRINKS');

  // Subcategory chips: from config, or default category chips
  const subchips = config?.subcategories ?? [];
  const isDefault = !config;

  // ── Brand header when only brand is set ──────────────────────────────────
  const brandLabel = brand ? brand.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : null;

  return (
    <div className="w-full">
      {/* ── Main banner ─────────────────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${from} 0%, ${via} 55%, ${to} 100%)`,
        }}
      >
        {/* Ambient glow in top-right */}
        <div
          className="pointer-events-none absolute -top-16 -right-16 w-80 h-80 rounded-full blur-3xl opacity-25"
          style={{ background: accent }}
        />

        {/* Large decorative icon — right side, atmospheric */}
        <div
          className="pointer-events-none absolute right-0 top-0 bottom-0 flex items-center pr-6 sm:pr-10 select-none"
          aria-hidden="true"
          style={{ opacity: 0.12 }}
        >
          <span style={{ fontSize: 'clamp(100px, 18vw, 180px)', lineHeight: 1 }}>
            {displayIcon}
          </span>
        </div>

        {/* Content */}
        <div className="relative z-10 container mx-auto px-4 py-6 sm:py-8 max-w-[70%] sm:max-w-[60%]">
          {/* Eyebrow */}
          <p
            className={`text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em] mb-1.5 ${accentClass}`}
          >
            {brandLabel ? `${eyebrow} · ${brandLabel}` : eyebrow}
          </p>

          {/* Headline */}
          <h1 className="text-white font-black leading-none mb-2" style={{ fontSize: 'clamp(24px, 5vw, 52px)' }}>
            {brandLabel && !config ? brandLabel : displayLabel}
          </h1>

          {/* Tagline */}
          <p className="text-white/55 text-xs sm:text-sm font-medium leading-snug">
            {displayTagline}
          </p>

          {/* Product count */}
          {typeof totalProducts === 'number' && totalProducts > 0 && (
            <div className="mt-3 sm:mt-4">
              <span
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full"
                style={{ background: `${accent}18`, color: accent, border: `1px solid ${accent}35` }}
              >
                <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor" aria-hidden="true">
                  <circle cx="4" cy="4" r="4" />
                </svg>
                {totalProducts.toLocaleString()} product{totalProducts !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Subcategory / category chip rail ──────────────────────────────────── */}
      {(subchips.length > 0 || isDefault) && (
        <div
          className="overflow-x-auto no-scrollbar border-b"
          style={{
            background: `${from}0d`,
            borderColor: `${accent}20`,
          }}
        >
          <div className="flex items-center gap-1.5 px-4 py-2.5 w-max">
            {isDefault ? (
              /* Default: show top-level category chips */
              DEFAULT_CHIPS.map((chip) => (
                <Link
                  key={chip.slug}
                  href={makeCategoryUrl(chip.slug)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all hover:scale-105"
                  style={{
                    background: '#ffffff12',
                    color: '#fff',
                    border: '1px solid #ffffff18',
                  }}
                >
                  <span>{chip.icon}</span>
                  <span>{chip.label}</span>
                </Link>
              ))
            ) : (
              /* Category: "All" reset chip + subcategory chips */
              <>
                <Link
                  href={makeSubUrl(null)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all"
                  style={
                    !activeSub
                      ? { background: accent, color: '#000', border: `1px solid ${accent}` }
                      : { background: `${accent}15`, color: accent, border: `1px solid ${accent}35` }
                  }
                >
                  All {config?.label}
                </Link>

                {subchips.map((chip) => {
                  const isActive = activeSub === chip.slug || activeSub === chip.slug.replace(/-/g, ' ');
                  return (
                    <Link
                      key={chip.slug}
                      href={makeSubUrl(chip.slug)}
                      className="flex items-center px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all"
                      style={
                        isActive
                          ? { background: accent, color: '#000', border: `1px solid ${accent}` }
                          : { background: `${accent}15`, color: accent, border: `1px solid ${accent}35` }
                      }
                    >
                      {chip.label}
                    </Link>
                  );
                })}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
