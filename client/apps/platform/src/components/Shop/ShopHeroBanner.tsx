'use client';

import React, { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import * as Icon from 'react-icons/pi';
import {
  fetchAllCategories,
  fetchAllSubCategories,
  getRootCategories,
  getSubcategories,
  type Category,
  type SubCategory,
} from '@/lib/categories';

// ─── Category config ──────────────────────────────────────────────────────────

interface CategoryConfig {
  label: string;
  subtitle: string;
  description: string;
  ctaText: string;
  // CSS gradient colours
  dark: string;   // left/base dark
  mid: string;    // mid tone
  glow: string;   // radial glow accent (hex, no alpha)
  // Chip rail accent
  accent: string;
  subcategories: Array<{ label: string; slug: string }>;
}

const CONFIGS: Record<string, CategoryConfig> = {
  whisky: {
    label: 'Whisky',
    subtitle: 'Single Malts · Blends · Bourbon',
    description: "From the peaty shores of Islay to the rolling hills of Speyside — we carry the world's finest drams, delivered to your door across Nigeria.",
    ctaText: 'Explore Whisky',
    dark: '#1a0900', mid: '#2d1200', glow: '#F59E0B',
    accent: '#F59E0B',
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
    subtitle: 'American · Irish · Tennessee',
    description: "Bold, rich, and unapologetically American — from Jim Beam's century-old recipe to Jameson's triple-distilled smoothness.",
    ctaText: 'Explore Whiskey',
    dark: '#1a0900', mid: '#2d1500', glow: '#FB923C',
    accent: '#FB923C',
    subcategories: [
      { label: 'Bourbon', slug: 'bourbon' },
      { label: 'Irish', slug: 'irish whiskey' },
      { label: 'Rye', slug: 'rye' },
    ],
  },
  scotch: {
    label: 'Scotch Whisky',
    subtitle: 'Highland · Speyside · Islay',
    description: 'Scotland distilled — from Glenfiddich\'s fruity Speyside to Ardbeg\'s medicinal Islay peat. Every bottle tells the story of its land.',
    ctaText: 'Explore Scotch',
    dark: '#1a0c00', mid: '#2d1800', glow: '#FCD34D',
    accent: '#FCD34D',
    subcategories: [
      { label: 'Single Malt', slug: 'single-malt' },
      { label: 'Blended', slug: 'blended' },
      { label: 'Peated', slug: 'peaty' },
    ],
  },
  'scotch-whisky': {
    label: 'Scotch Whisky',
    subtitle: 'Highland · Speyside · Islay',
    description: 'Scotland distilled — from Glenfiddich\'s fruity Speyside to Ardbeg\'s medicinal Islay peat. Every bottle tells the story of its land.',
    ctaText: 'Explore Scotch',
    dark: '#1a0c00', mid: '#2d1800', glow: '#FCD34D',
    accent: '#FCD34D',
    subcategories: [
      { label: 'Single Malt', slug: 'single-malt' },
      { label: 'Blended', slug: 'blended' },
    ],
  },
  wine: {
    label: 'Wine',
    subtitle: 'Red · White · Rosé · Sparkling',
    description: 'A world of vintages at your fingertips — Bordeaux reds, Burgundy whites, Provençal rosés, and sparkling celebrations from every corner of the globe.',
    ctaText: 'Explore Wines',
    dark: '#0d0020', mid: '#1e0040', glow: '#A78BFA',
    accent: '#A78BFA',
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
    subtitle: 'Moët · Veuve Clicquot · Dom Pérignon',
    description: 'Every bubble tells a story of chalk soil and patient cellaring. From the iconic Yellow Label to rare prestige cuvées — delivered across Nigeria.',
    ctaText: 'Explore Champagne',
    dark: '#0c0600', mid: '#1c1000', glow: '#FCD34D',
    accent: '#FCD34D',
    subcategories: [],
  },
  vodka: {
    label: 'Vodka',
    subtitle: 'Premium · Flavoured · Craft',
    description: "Crystal clear and endlessly versatile — from Grey Goose's French wheat elegance to Cîroc's grape-distilled smoothness.",
    ctaText: 'Explore Vodka',
    dark: '#020810', mid: '#050e20', glow: '#93C5FD',
    accent: '#93C5FD',
    subcategories: [
      { label: 'Premium', slug: 'premium vodka' },
      { label: 'Flavoured', slug: 'flavoured vodka' },
    ],
  },
  gin: {
    label: 'Gin',
    subtitle: 'London Dry · Craft · Flavoured',
    description: "Juniper-forward journeys through botanical landscapes — from Hendrick's garden-fresh cucumber to Monkey 47's 47-ingredient complexity.",
    ctaText: 'Explore Gin',
    dark: '#000f07', mid: '#011f0e', glow: '#34D399',
    accent: '#34D399',
    subcategories: [
      { label: 'London Dry', slug: 'london dry' },
      { label: 'Craft Gin', slug: 'craft gin' },
      { label: 'Flavoured', slug: 'flavoured gin' },
    ],
  },
  rum: {
    label: 'Rum',
    subtitle: 'Dark · White · Spiced',
    description: 'Sun-soaked sugar cane, Caribbean sea salt, and generations of craft — dark Diplomatico, spiced Captain Morgan, and clean Bacardi for every cocktail.',
    ctaText: 'Explore Rum',
    dark: '#0c0000', mid: '#1c0404', glow: '#FB923C',
    accent: '#FB923C',
    subcategories: [
      { label: 'Dark Rum', slug: 'dark rum' },
      { label: 'White Rum', slug: 'white rum' },
      { label: 'Spiced Rum', slug: 'spiced rum' },
    ],
  },
  tequila: {
    label: 'Tequila',
    subtitle: 'Blanco · Reposado · Añejo',
    description: 'Blue agave from the volcanic highlands of Jalisco — from Patrón\'s ultra-premium Silver to Don Julio\'s barrel-aged complexity.',
    ctaText: 'Explore Tequila',
    dark: '#060e01', mid: '#0c1a02', glow: '#A3E635',
    accent: '#A3E635',
    subcategories: [],
  },
  mezcal: {
    label: 'Mezcal',
    subtitle: 'Artisanal · Small-Batch',
    description: 'Hand-roasted agave hearts, wild yeast, and open-air fermentation — mezcal is the soul of Oaxaca in a bottle.',
    ctaText: 'Explore Mezcal',
    dark: '#050403', mid: '#0c0a09', glow: '#D6D3D1',
    accent: '#D6D3D1',
    subcategories: [],
  },
  cognac: {
    label: 'Cognac',
    subtitle: 'VS · VSOP · XO',
    description: "The measured art of French distillation — Hennessy's legendary VS, Rémy Martin's VSOP, and Martell's centuries-old mastery of oak and Charentais grapes.",
    ctaText: 'Explore Cognac',
    dark: '#0c0500', mid: '#1c0d00', glow: '#FCD34D',
    accent: '#FCD34D',
    subcategories: [],
  },
  brandy: {
    label: 'Brandy & Cognac',
    subtitle: 'French · Spanish · South African',
    description: 'Aged to quiet perfection — decades of oak-resting transform simple grape spirit into liquid history.',
    ctaText: 'Explore Brandy',
    dark: '#0d0020', mid: '#170530', glow: '#C084FC',
    accent: '#C084FC',
    subcategories: [],
  },
  beer: {
    label: 'Beer',
    subtitle: 'Craft · Lager · Stout · Ale',
    description: 'From barrel-aged craft stouts to ice-cold European lagers — imported beers and local favourites, delivered cold-chain fresh.',
    ctaText: 'Explore Beer',
    dark: '#0c0600', mid: '#1c0e00', glow: '#FCD34D',
    accent: '#FCD34D',
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
    subtitle: 'Apple · Fruit · Premium',
    description: 'Crisp orchard harvests from Savanna to Strongbow — refreshing alternatives with real fruit character.',
    ctaText: 'Explore Cider',
    dark: '#040b02', mid: '#091804', glow: '#BEF264',
    accent: '#BEF264',
    subcategories: [],
  },
  liqueur: {
    label: 'Liqueurs',
    subtitle: "Baileys · Amarula · Disaronno",
    description: "Sweet complexity in every pour — cream, amaretto, triple sec, and coffee liqueurs that finish cocktails and stand alone beautifully.",
    ctaText: 'Explore Liqueurs',
    dark: '#15020a', mid: '#2a0412', glow: '#F9A8D4',
    accent: '#F9A8D4',
    subcategories: [],
  },
  spirits: {
    label: 'Spirits',
    subtitle: 'Whisky · Vodka · Gin · Rum · Tequila',
    description: "Nigeria's most comprehensive spirits selection — every category, every price point, every occasion covered.",
    ctaText: 'Browse All Spirits',
    dark: '#060608', mid: '#0f0f12', glow: '#D4D4D8',
    accent: '#D4D4D8',
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
    subtitle: 'Seedlip · Sparkling · Mocktail',
    description: 'Premium alcohol-free — full flavour, zero compromise. From sophisticated Seedlip blends to sparkling grape juice and premium mocktail mixers.',
    ctaText: 'Explore Non-Alcoholic',
    dark: '#020c12', mid: '#061824', glow: '#67E8F9',
    accent: '#67E8F9',
    subcategories: [],
  },
  'gift-sets': {
    label: 'Gift Sets',
    subtitle: 'Premium · Corporate · Celebration',
    description: 'Curated for moments that deserve more than words — hand-picked whisky hampers, wine collections, and custom celebration boxes.',
    ctaText: 'Explore Gift Sets',
    dark: '#110308', mid: '#250612', glow: '#FDA4AF',
    accent: '#FDA4AF',
    subcategories: [],
  },
  sake: {
    label: 'Sake',
    subtitle: 'Japanese · Premium · Craft',
    description: 'The quiet art of Japanese rice wine — from dry junmai to fragrant ginjo expressions.',
    ctaText: 'Explore Sake',
    dark: '#02070e', mid: '#06121c', glow: '#BAE6FD',
    accent: '#BAE6FD',
    subcategories: [],
  },
  port: {
    label: 'Port & Fortified',
    subtitle: 'Tawny · Ruby · Vintage',
    description: "Centuries of craft from Portugal's Douro Valley — rich Tawny ports, vibrant Ruby expressions, and rare Vintage bottles.",
    ctaText: 'Explore Port',
    dark: '#0d0207', mid: '#1c060f', glow: '#FDA4AF',
    accent: '#FDA4AF',
    subcategories: [],
  },
  bitters: {
    label: 'Bitters',
    subtitle: 'Angostura · Aperol · Campari',
    description: 'The soul of every great cocktail — bitter, herbaceous, and endlessly complex. Essential aperitivo for the home bar.',
    ctaText: 'Explore Bitters',
    dark: '#050d01', mid: '#0a1a03', glow: '#86EFAC',
    accent: '#86EFAC',
    subcategories: [],
  },
  mixers: {
    label: 'Mixers & Sodas',
    subtitle: 'Fever-Tree · Premium · Tonic',
    description: "Fever-Tree tonic, Fentimans ginger beer, premium soda water — the perfect backdrop to let your spirits shine.",
    ctaText: 'Explore Mixers',
    dark: '#020a0f', mid: '#061522', glow: '#7DD3FC',
    accent: '#7DD3FC',
    subcategories: [],
  },
};

// ─── Subcategory → parent category map ───────────────────────────────────────

const SUBCAT_PARENT: Record<string, string> = {
  'single-malt': 'whisky', 'single malt': 'whisky',
  blended: 'whisky', bourbon: 'whisky',
  'irish whiskey': 'whisky', 'japanese whisky': 'whisky', rye: 'whisky',
  'red wine': 'wine', 'white wine': 'wine', 'rosé': 'wine', rose: 'wine',
  sparkling: 'wine', 'dessert wine': 'wine',
  'dark rum': 'rum', 'white rum': 'rum', 'spiced rum': 'rum',
  'london dry': 'gin', 'craft gin': 'gin', 'flavoured gin': 'gin',
  'premium vodka': 'vodka', 'flavoured vodka': 'vodka',
  'craft beer': 'beer', lager: 'beer', stout: 'beer', ale: 'beer', ipa: 'beer',
};

// ─── Subcategory display overrides ───────────────────────────────────────────

const SUBCAT_LABELS: Record<string, { label: string; subtitle: string; description: string }> = {
  'single-malt': { label: 'Single Malt Whisky', subtitle: 'One distillery · One grain · One truth', description: "The purest expression of the distiller's craft — every bottle traces back to a single Scottish distillery and a single malted grain." },
  'single malt': { label: 'Single Malt Whisky', subtitle: 'One distillery · One grain · One truth', description: "The purest expression of the distiller's craft — every bottle traces back to a single Scottish distillery and a single malted grain." },
  blended: { label: 'Blended Whisky', subtitle: "The master blender's art", description: 'Consistency, depth, and approachability — blended whiskies like Johnnie Walker and Chivas Regal are the result of decades of skilled blending craft.' },
  bourbon: { label: 'Bourbon Whiskey', subtitle: 'American oak · Caramel · Vanilla', description: "Born in Kentucky, built on corn — America's native spirit carries warm vanilla, caramel, and oak in every pour." },
  'irish whiskey': { label: 'Irish Whiskey', subtitle: 'Triple-distilled · Smooth · Approachable', description: 'Triple distillation gives Irish whiskey its signature silky smoothness — Jameson, Bushmills, and Redbreast lead the way.' },
  'japanese whisky': { label: 'Japanese Whisky', subtitle: 'Precision · Balance · Patience', description: 'Decades of patient aging and meticulous blending produce some of the world\'s most refined whiskies — Suntory, Nikka, and beyond.' },
  rye: { label: 'Rye Whiskey', subtitle: 'Spicy · Bold · Assertive', description: 'High-rye mashbills produce the spicy, peppery character that defined American whiskey before Prohibition — now enjoying a full revival.' },
  'red wine': { label: 'Red Wine', subtitle: 'Cabernet · Merlot · Pinot Noir · Shiraz', description: 'Bold Bordeaux, elegant Burgundy, and rich New World reds from Australia and South Africa — every red wine occasion covered.' },
  'white wine': { label: 'White Wine', subtitle: 'Chardonnay · Sauvignon Blanc · Riesling', description: 'Crisp and food-friendly — from mineral Chablis to tropical Marlborough Sauvignon Blanc and oaky Napa Chardonnay.' },
  'rosé': { label: 'Rosé Wine', subtitle: 'Provence · Dry · Fresh', description: 'Pale, dry, and endlessly versatile — Provençal rosé at its finest, from Whispering Angel to Miraval.' },
  rose: { label: 'Rosé Wine', subtitle: 'Provence · Dry · Fresh', description: 'Pale, dry, and endlessly versatile — Provençal rosé at its finest, from Whispering Angel to Miraval.' },
  sparkling: { label: 'Sparkling Wine', subtitle: 'Prosecco · Cava · Crémant', description: 'Bubbles for every celebration — Italian Prosecco, Spanish Cava, and French Crémant at approachable prices.' },
  'dessert wine': { label: 'Dessert Wine', subtitle: 'Sauternes · Ice Wine · Port-Style', description: 'Concentrated sweetness from noble rot and late harvests — sip slowly and savour every drop.' },
  'dark rum': { label: 'Dark Rum', subtitle: 'Molasses · Oak · Caribbean', description: 'Rich and complex, aged in charred oak barrels — Diplomatico, Appleton Estate, and Mount Gay lead the way.' },
  'white rum': { label: 'White Rum', subtitle: 'Clean · Light · Cocktail-Ready', description: 'Neutral, clean, and versatile — the foundation of every great Mojito, Daiquiri, and Piña Colada.' },
  'spiced rum': { label: 'Spiced Rum', subtitle: 'Vanilla · Cinnamon · Warmth', description: "Captain Morgan's iconic blend of vanilla and warm spices defined a category — endlessly sippable and mixer-friendly." },
  'london dry': { label: 'London Dry Gin', subtitle: 'Classic · Juniper · Benchmark', description: "The original — Tanqueray, Beefeater, and Gordon's set the standard that every other gin style is measured against." },
  'craft gin': { label: 'Craft Gin', subtitle: 'Small-Batch · Botanical · Artisanal', description: "Hendrick's cucumber, Monkey 47's 47 ingredients, Roku's Japanese botanicals — craft gin rewards the curious palate." },
  'flavoured gin': { label: 'Flavoured Gin', subtitle: 'Pink · Citrus · Fruit-Forward', description: "Pink gin, citrus gin, elderflower gin — flavoured expressions that brought a new generation to the category." },
  'premium vodka': { label: 'Premium Vodka', subtitle: 'Grey Goose · Belvedere · Ketel One', description: 'When the base spirit is the hero — premium vodkas distilled from the finest grains and filtered to crystalline perfection.' },
  'flavoured vodka': { label: 'Flavoured Vodka', subtitle: "Cîroc · Absolut · Smirnoff", description: "Fruit-infused and fruit-distilled expressions that opened vodka to a whole new audience — from peach to watermelon." },
  'craft beer': { label: 'Craft Beer', subtitle: 'Small-Batch · Character · Artisanal', description: "Independent breweries pushing flavour boundaries — IPAs, stouts, sours, and lagers with real personality." },
  lager: { label: 'Lager', subtitle: 'Heineken · Corona · Stella Artois', description: 'Crisp, cold, and endlessly refreshing — the world\'s most beloved beer style from Europe\'s finest breweries.' },
  stout: { label: 'Stout', subtitle: 'Guinness · Dark · Roasted', description: "Roasted barley, dark chocolate, and creamy mouthfeel — Guinness Foreign Extra and premium imported stouts." },
  ale: { label: 'Ale', subtitle: 'Pale Ale · IPA · Porter', description: "Britain's finest brewing tradition — ales that range from refreshing golden pales to rich dark porters." },
  ipa: { label: 'IPA', subtitle: 'Hop-Forward · Aromatic · Bitter', description: 'India Pale Ales — hop-forward, aromatic, and beautifully bitter. The craft beer world\'s most exciting category.' },
};

// ─── Default (no category selected) ──────────────────────────────────────────

const DEFAULT_CONFIG: CategoryConfig = {
  label: 'All Drinks',
  subtitle: 'Wines · Spirits · Beer · Non-Alcoholic',
  description: "Nigeria's widest premium drinks selection — thousands of bottles, every style, every occasion. From whisky connoisseur collections to everyday wines, delivered fast from Abuja.",
  ctaText: 'Browse All Drinks',
  dark: '#060608', mid: '#0f0f18', glow: '#6366F1',
  accent: '#E5E7EB',
  subcategories: [
    { label: 'Whisky', slug: 'whisky' },
    { label: 'Wine', slug: 'wine' },
    { label: 'Cognac', slug: 'cognac' },
    { label: 'Vodka', slug: 'vodka' },
    { label: 'Gin', slug: 'gin' },
    { label: 'Rum', slug: 'rum' },
    { label: 'Beer', slug: 'beer' },
    { label: 'Champagne', slug: 'champagne' },
    { label: 'Tequila', slug: 'tequila' },
  ],
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface ShopHeroBannerProps {
  category?: string | string[] | null;
  subcategory?: string | string[] | null;
  brand?: string | string[] | null;
  totalProducts?: number;
  // Server-computed keyword-matching heading/description. Used as the terminal
  // fallback so the initial (crawlable) <h1> matches the page <title> for filters
  // this component doesn't statically curate (origin, flavor, DB-only categories)
  // and for the default shop — instead of the generic "All Drinks".
  seed?: { label: string; description?: string } | null;
}

// ─── Animation variants ───────────────────────────────────────────────────────

const containerVariants = {
  initial: { opacity: 1 },
  animate: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.15 } },
};

const textVariants = {
  initial: { y: 28, opacity: 0, filter: 'blur(8px)' },
  animate: { y: 0, opacity: 1, filter: 'blur(0px)', transition: { duration: 0.75, ease: [0.16, 1, 0.3, 1] } },
};

const btnVariants = {
  initial: { scale: 0.88, opacity: 0, y: 14 },
  animate: { scale: 1, opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.34, 1.56, 0.64, 1] } },
};

// When the visitor prefers reduced motion we render everything in its final state
// (no transforms, no blur, no stagger) — this also lets the LCP <h1>/description
// paint immediately instead of tweening up from opacity 0.
const STATIC_VARIANTS = {
  initial: { opacity: 1 },
  animate: { opacity: 1, transition: { staggerChildren: 0, delayChildren: 0 } },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Normalize a possibly comma-joined param into a lowercase, trimmed slug list.
function toList(v?: string | string[] | null): string[] {
  if (!v) return [];
  const arr = Array.isArray(v) ? v : v.split(',');
  return arr.map((s) => s.trim().toLowerCase()).filter(Boolean);
}

// Darken a #rrggbb hex by mixing toward black. amount 0..1 (1 = black).
function darken(hex: string, amount: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return hex;
  const ch = (h: string) => Math.round(parseInt(h, 16) * (1 - amount));
  const to2 = (n: number) => n.toString(16).padStart(2, '0');
  return `#${to2(ch(m[1]))}${to2(ch(m[2]))}${to2(ch(m[3]))}`;
}

// Build a hero theme from a single DB category colour (fallback when no curated style).
function themeFromColor(color: string) {
  return { dark: darken(color, 0.9), mid: darken(color, 0.8), glow: color, accent: color };
}

// Strip HTML tags (brand/category descriptions may be rich text).
function stripHtml(html?: string): string {
  return String(html || '').replace(/<[^>]*>/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

// ─── Brand details (fetched when a single brand filter is active) ────────────

interface BrandDetails {
  _id: string;
  name: string;
  slug: string;
  tagline?: string;
  shortDescription?: string;
  description?: string;
  brandType?: string;
  primaryCategory?: string;
  countryOfOrigin?: string;
  brandColors?: { primary?: string; secondary?: string; accent?: string };
  logo?: { url?: string };
  featuredImage?: { url?: string };
  bannerImage?: { url?: string };
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
const _brandCache = new Map<string, BrandDetails | null>();

// The shop `brand` URL param carries the brand *name* — look it up via search
// and prefer an exact (case-insensitive) name match.
async function fetchBrandByName(name: string): Promise<BrandDetails | null> {
  const key = name.toLowerCase();
  if (_brandCache.has(key)) return _brandCache.get(key)!;
  try {
    const res = await fetch(
      `${API_BASE}/api/brands?search=${encodeURIComponent(name)}&limit=5&status=active`
    );
    const json = await res.json();
    const brands: BrandDetails[] = json?.data?.brands || json?.brands || [];
    const brand =
      brands.find((b) => b.name?.toLowerCase() === key) ?? brands[0] ?? null;
    _brandCache.set(key, brand);
    return brand;
  } catch {
    _brandCache.set(key, null);
    return null;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ShopHeroBanner({
  category,
  subcategory,
  brand,
  totalProducts,
  seed,
}: ShopHeroBannerProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const reduceMotion = useReducedMotion();

  // Swap the entrance animation for a static, final-state render when the visitor
  // has prefers-reduced-motion set.
  const cVar = reduceMotion ? STATIC_VARIANTS : containerVariants;
  const tVar = reduceMotion ? STATIC_VARIANTS : textVariants;
  const bVar = reduceMotion ? STATIC_VARIANTS : btnVariants;

  // ── DB-sourced categories/subcategories — the source of truth for chips + slugs ──
  const [allCats, setAllCats] = useState<Category[]>([]);
  const [allSubs, setAllSubs] = useState<SubCategory[]>([]);
  useEffect(() => {
    let alive = true;
    Promise.all([fetchAllCategories(), fetchAllSubCategories()]).then(([c, s]) => {
      if (!alive) return;
      setAllCats(c);
      setAllSubs(s);
    });
    return () => { alive = false; };
  }, []);

  // Active filter slugs from the URL (single or multi-select).
  const activeCats = useMemo(() => new Set(toList(category)), [category]);
  const activeSubs = useMemo(() => new Set(toList(subcategory)), [subcategory]);
  const catList = useMemo(() => [...activeCats], [activeCats]);
  const subList = useMemo(() => [...activeSubs], [activeSubs]);
  const brandList = useMemo(() => toList(brand), [brand]);

  // ── Brand details — fetched when exactly one brand is selected ──
  const [dbBrand, setDbBrand] = useState<BrandDetails | null>(null);
  useEffect(() => {
    let alive = true;
    if (brandList.length !== 1) {
      setDbBrand(null);
      return;
    }
    fetchBrandByName(brandList[0]).then((b) => {
      if (alive) setDbBrand(b);
    });
    return () => { alive = false; };
  }, [brandList]);

  // Resolve the active DB category: first selected category, else parent of first subcategory.
  const dbCat = useMemo<Category | null>(() => {
    if (catList[0]) return allCats.find((c) => c.slug === catList[0]) ?? null;
    if (subList[0]) {
      const sub = allSubs.find((s) => s.slug === subList[0]);
      if (sub) {
        const pid = typeof sub.parent === 'string' ? sub.parent : (sub.parent as any)?._id;
        return allCats.find((c) => c._id === pid) ?? null;
      }
    }
    return null;
  }, [catList, subList, allCats, allSubs]);

  // Copy source when exactly one subcategory is active.
  const dbSub = useMemo<SubCategory | null>(
    () => (subList.length === 1 ? allSubs.find((s) => s.slug === subList[0]) ?? null : null),
    [subList, allSubs],
  );

  // Chip data — always from the DB so every chip yields a valid product filter.
  const rootCats = useMemo(() => getRootCategories(allCats, allSubs), [allCats, allSubs]);
  const catSubs = useMemo(() => (dbCat ? getSubcategories(dbCat, allSubs) : []), [dbCat, allSubs]);

  const isDefault = catList.length === 0 && subList.length === 0;

  // Brand takes over the hero when it is the only active filter.
  const brandOnly = brandList.length > 0 && isDefault;

  // ── Visual theme: brand colour first, then curated look, then DB category colour ──
  const themeKey = dbCat?.slug ?? catList[0] ?? (subList[0] ? SUBCAT_PARENT[subList[0]] : undefined);
  // Footer/marketing URLs use plural umbrella slugs (?category=wines) that the
  // curated map keys as singulars — normalize before lookup.
  const CURATED_KEY_ALIASES: Record<string, string> = {
    wines: 'wine', beers: 'beer', ciders: 'cider', liqueurs: 'liqueur',
    whiskies: 'whisky', whiskeys: 'whisky', 'scotch-whisky': 'scotch',
    nonalcoholic: 'non-alcoholic',
  };
  const curatedKey = themeKey ? (CURATED_KEY_ALIASES[themeKey] ?? themeKey) : undefined;
  const curated = (curatedKey && CONFIGS[curatedKey]) || null;
  const curatedSub = subList.length === 1 ? SUBCAT_LABELS[subList[0]] : null;

  const brandColor = brandOnly ? dbBrand?.brandColors?.primary : undefined;
  const theme = brandColor
    ? themeFromColor(brandColor)
    : curated
      ? { dark: curated.dark, mid: curated.mid, glow: curated.glow, accent: curated.accent }
      : dbCat?.color
        ? themeFromColor(dbCat.color)
        : { dark: DEFAULT_CONFIG.dark, mid: DEFAULT_CONFIG.mid, glow: DEFAULT_CONFIG.glow, accent: DEFAULT_CONFIG.accent };

  // ── Count subtitle for multi-select ──
  const countSubtitle =
    catList.length > 1 ? `${catList.length} categories selected`
    : subList.length > 1 ? `${subList.length} styles selected`
    : brandOnly && brandList.length > 1 ? `${brandList.length} brands selected`
    : null;

  // ── Brand copy — DB brand details, slug-derived name as fallback ──
  const brandLabel = brandOnly && brandList.length === 1
    ? dbBrand?.name ?? brandList[0].replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : null;
  const prettify = (s?: string) => (s ? s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '');
  const brandSubtitle = brandLabel
    ? dbBrand?.tagline ||
      [prettify(dbBrand?.brandType), dbBrand?.countryOfOrigin].filter(Boolean).join(' · ') ||
      null
    : null;
  const brandDescription = brandLabel
    ? dbBrand?.shortDescription ||
      (dbBrand?.description ? stripHtml(dbBrand.description).slice(0, 320) : null)
    : null;

  // ── Display copy: brand first, then DB category/subcategory, curated fallback, generic last ──
  const displayLabel       = brandLabel ?? dbSub?.name ?? curatedSub?.label ?? dbCat?.name ?? curated?.label ?? seed?.label ?? DEFAULT_CONFIG.label;
  const displaySubtitle    = countSubtitle ?? brandSubtitle ?? dbSub?.tagline ?? curatedSub?.subtitle ?? dbCat?.tagline ?? curated?.subtitle ?? DEFAULT_CONFIG.subtitle;
  const displayDescription = stripHtml(
    brandDescription ?? dbSub?.description ?? curatedSub?.description ?? dbCat?.description ?? curated?.description ?? seed?.description ?? DEFAULT_CONFIG.description
  );

  const ctaText = brandLabel
    ? `Explore ${brandLabel}`
    : curated?.ctaText ?? (dbCat ? `Explore ${dbCat.name}` : DEFAULT_CONFIG.ctaText);

  // Featured image background — brand image first, then a single active
  // subcategory's image, else the category's.
  const heroImage =
    (brandOnly ? dbBrand?.bannerImage?.url ?? dbBrand?.featuredImage?.url : null) ??
    (subList.length === 1 ? dbSub?.featuredImage?.url ?? dbSub?.bannerImage?.url : null) ??
    dbCat?.featuredImage?.url ?? dbCat?.bannerImage?.url ?? null;

  // Build CTA URL (just clears subcategory, keeps category)
  const ctaUrl = useMemo(() => {
    const p = new URLSearchParams(searchParams.toString());
    p.delete('subcategory');
    const qs = p.toString();
    return `${pathname}${qs ? `?${qs}` : ''}`;
  }, [pathname, searchParams]);

  // Subcategory chip URL
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

  const makeCategoryUrl = (slug: string) => `${pathname}?category=${slug}`;

  const { dark, mid, glow, accent } = theme;

  return (
    <div className="w-full">
      {/* ── Full-height hero ────────────────────────────────────────────────── */}
      <div
        className="relative w-full overflow-hidden"
        style={{ height: 'clamp(336px, 52vh, 576px)' }}
      >
        {/* Featured image background */}
        {heroImage && (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url("${heroImage}")` }}
          />
        )}

        {/* Background gradient — opaque when no image, legibility scrim when an image is present */}
        <div
          className="absolute inset-0"
          style={{
            background: heroImage
              ? `linear-gradient(90deg, ${dark}f2 0%, ${dark}cc 35%, ${dark}55 65%, ${dark}22 100%)`
              : `linear-gradient(115deg, ${dark} 0%, ${mid} 45%, ${dark} 100%)`,
          }}
        />

        {/* Radial glow — top-right */}
        <div
          className="pointer-events-none absolute -top-20 -right-20 w-[500px] h-[500px] rounded-full blur-3xl"
          style={{ background: glow, opacity: 0.18 }}
        />

        {/* Secondary glow — bottom-left (warmth) */}
        <div
          className="pointer-events-none absolute -bottom-24 -left-24 w-72 h-72 rounded-full blur-3xl"
          style={{ background: glow, opacity: 0.08 }}
        />

        {/* Subtle noise-grain overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
            backgroundSize: '200px 200px',
          }}
        />

        {/* Bottom gradient fade — leads into chip rail */}
        <div
          className="pointer-events-none absolute bottom-0 inset-x-0 h-36"
          style={{ background: `linear-gradient(to top, ${dark}f0 0%, transparent 100%)` }}
        />

        {/* Content */}
        <div className="relative z-10 container mx-auto px-5 md:px-10 h-full flex items-center">
          <motion.div
            variants={cVar}
            initial="initial"
            animate="animate"
            className="max-w-2xl"
          >
            {/* Badge / subtitle */}
            <motion.div variants={tVar} className="mb-5">
              <span
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold border backdrop-blur-md"
                style={{
                  background: `${glow}18`,
                  borderColor: `${glow}35`,
                  color: accent,
                }}
              >
                <Icon.PiSparkleFill size={12} />
                {displaySubtitle}
              </span>
            </motion.div>

            {/* Headline — with brand logo when a single brand is active */}
            <motion.div variants={tVar} className="flex items-center gap-4 mb-4">
              {brandLabel && dbBrand?.logo?.url && (
                <img
                  src={dbBrand.logo.url}
                  alt=""
                  aria-hidden="true"
                  loading="eager"
                  decoding="async"
                  className="h-14 w-14 sm:h-20 sm:w-20 flex-shrink-0 rounded-2xl bg-white/90 object-contain p-1.5 shadow-lg"
                />
              )}
              <h1
                className="font-black text-white leading-[1.02] tracking-tight"
                style={{
                  fontSize: 'clamp(36px, 6vw, 72px)',
                  textShadow: '0 2px 24px rgba(0,0,0,0.5)',
                }}
              >
                {displayLabel}
              </h1>
            </motion.div>

            {/* Description */}
            <motion.p
              variants={tVar}
              className="text-white/70 mb-8 leading-relaxed max-w-xl"
              style={{ fontSize: 'clamp(14px, 1.5vw, 18px)' }}
            >
              {displayDescription}
            </motion.p>

            {/* CTAs */}
            <motion.div variants={bVar} className="flex items-center gap-3 flex-wrap">
              <Link
                href={ctaUrl}
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full font-bold text-sm transition-all duration-300 hover:scale-105"
                style={{
                  background: `linear-gradient(135deg, ${glow}cc, ${glow}99)`,
                  color: '#000',
                  boxShadow: `0 4px 20px ${glow}40`,
                }}
              >
                {ctaText}
                <Icon.PiArrowRight size={16} />
              </Link>

              <Link
                href={`${pathname}?sale=true${category ? `&category=${category}` : ''}`}
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full font-bold text-sm border transition-all duration-300 hover:scale-105 backdrop-blur-md"
                style={{
                  background: 'rgba(255,255,255,0.07)',
                  borderColor: 'rgba(255,255,255,0.18)',
                  color: '#fff',
                }}
              >
                <Icon.PiTagFill size={14} />
                View Deals
              </Link>
            </motion.div>

            {/* Trust pills */}
            <motion.div variants={tVar} className="flex flex-wrap gap-2.5 mt-8">
              {[
                { icon: <Icon.PiTruck size={12} />, label: 'Fast Delivery' },
                { icon: <Icon.PiSealCheck size={12} />, label: 'Authentic Products' },
                { icon: <Icon.PiLockKey size={12} />, label: 'Secure Checkout' },
              ].map(({ icon, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs text-white/80 border backdrop-blur-md"
                  style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)' }}
                >
                  <span style={{ color: accent }}>{icon}</span>
                  {label}
                </div>
              ))}
            </motion.div>

            {/* Product count */}
            {typeof totalProducts === 'number' && totalProducts > 0 && (
              <motion.p variants={tVar} className="mt-4 text-white/40 text-xs font-medium">
                {totalProducts.toLocaleString()} product{totalProducts !== 1 ? 's' : ''} available
              </motion.p>
            )}
          </motion.div>
        </div>
      </div>

      {/* ── Subcategory chip rail ─────────────────────────────────────────────── */}
      <nav
        aria-label={isDefault ? 'Browse drink categories' : `Filter ${displayLabel} by subcategory`}
        className="overflow-x-auto no-scrollbar border-b"
        style={{ background: `${dark}`, borderColor: `${glow}20` }}
      >
        <div className="flex items-center gap-1.5 px-4 sm:px-6 py-3 w-max">
          {isDefault ? (
            /* Default: top-level category shortcuts from the DB */
            <>
              {rootCats.map((cat) => {
                const isActive = activeCats.has(cat.slug);
                return (
                  <Link
                    key={cat._id}
                    href={makeCategoryUrl(cat.slug)}
                    className="px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all hover:scale-105"
                    style={
                      isActive
                        ? { background: accent, color: '#000', border: `1px solid ${accent}` }
                        : {
                            background: 'rgba(255,255,255,0.09)',
                            color: 'rgba(255,255,255,0.85)',
                            border: '1px solid rgba(255,255,255,0.15)',
                          }
                    }
                  >
                    {cat.name}
                  </Link>
                );
              })}
            </>
          ) : (
            /* Category / subcategory: "All" reset + per-subcategory chips from the DB */
            <>
              {catSubs.length > 0 && (
                <Link
                  href={makeSubUrl(null)}
                  className="px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all"
                  style={
                    activeSubs.size === 0
                      ? { background: accent, color: '#000', border: `1px solid ${accent}` }
                      : { background: `${glow}20`, color: accent, border: `1px solid ${glow}40` }
                  }
                >
                  All {dbCat?.name ?? displayLabel}
                </Link>
              )}
              {catSubs.map((sub) => {
                const isActive = activeSubs.has(sub.slug);
                return (
                  <Link
                    key={sub._id}
                    href={makeSubUrl(sub.slug)}
                    className="px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all"
                    style={
                      isActive
                        ? { background: accent, color: '#000', border: `1px solid ${accent}` }
                        : { background: `${glow}20`, color: accent, border: `1px solid ${glow}40` }
                    }
                  >
                    {sub.name}
                  </Link>
                );
              })}
            </>
          )}
        </div>
      </nav>
    </div>
  );
}
