/**
 * Banner shaping for the hero and the `home_secondary` strip.
 *
 * Ports `Banner/HeroBanner.tsx` (fallback slides, content position, CTA style)
 * and `Banner/PlacementBanner.tsx` (position map, CTA map, per-placement aspect
 * ratio). The web expresses these as Tailwind class strings; RN needs the
 * flexbox values themselves, so each map returns a style object.
 */

export interface BannerView {
  _id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  ctaText: string | null;
  ctaLink: string | null;
  ctaStyle: string;
  linkType: string | null;
  backgroundColor: string;
  textColor: string | null;
  /** 0-100, as the API stores it. */
  overlayOpacity: number;
  textAlignment: string;
  contentPosition: string;
  imageUrl: string | null;
  mobileImageUrl: string | null;
  priority: string | null;
  autoplayInterval: number;
  /** Fallback slides must never be counted as impressions or clicks. */
  isFallback: boolean;
}

export const HERO_DEFAULT_BACKGROUND = '#1A1A2E';
export const HERO_AUTOPLAY_MS = 6000;

/**
 * Shown when `/api/banners/placement/home_hero` has nothing. Same two slides,
 * same copy, same colours as HeroBanner.tsx:41-68 — a mobile user and a web
 * user must not see a different "empty" store.
 */
export const FALLBACK_HERO_SLIDES: BannerView[] = [
  {
    _id: 'fallback-1',
    title: 'Premium Spirits, Delivered',
    subtitle: 'New Arrivals',
    description:
      'Explore our curated selection of world-class whiskeys, wines, and more — straight to your door.',
    ctaText: 'Shop Now',
    ctaLink: '/shop',
    ctaStyle: 'primary',
    linkType: null,
    backgroundColor: '#1A1A2E',
    textColor: null,
    overlayOpacity: 0,
    textAlignment: 'left',
    contentPosition: 'center',
    imageUrl: null,
    mobileImageUrl: null,
    priority: null,
    autoplayInterval: HERO_AUTOPLAY_MS,
    isFallback: true,
  },
  {
    _id: 'fallback-2',
    title: 'Weekend Flash Sale',
    subtitle: 'Up to 40% Off',
    description: "Limited time deals on premium bottles. Stock up before they're gone.",
    ctaText: 'View Deals',
    ctaLink: '/deals',
    ctaStyle: 'primary',
    linkType: null,
    backgroundColor: '#7C1D1D',
    textColor: null,
    overlayOpacity: 0,
    textAlignment: 'left',
    contentPosition: 'center',
    imageUrl: null,
    mobileImageUrl: null,
    priority: null,
    autoplayInterval: HERO_AUTOPLAY_MS,
    isFallback: true,
  },
];

type Justify = 'flex-start' | 'center' | 'flex-end';
type Align = 'flex-start' | 'center' | 'flex-end';
export type TextAlign = 'left' | 'center' | 'right';

/**
 * The web writes `items-* justify-*` on a ROW flex container, so `items-` is the
 * vertical axis and `justify-` the horizontal. RN's default is a COLUMN, so the
 * two swap: `justifyContent` becomes vertical and `alignItems` horizontal.
 */
const POSITIONS: Record<string, { vertical: Justify; horizontal: Align }> = {
  'top-left': { vertical: 'flex-start', horizontal: 'flex-start' },
  'top-center': { vertical: 'flex-start', horizontal: 'center' },
  'top-right': { vertical: 'flex-start', horizontal: 'flex-end' },
  'center-left': { vertical: 'center', horizontal: 'flex-start' },
  center: { vertical: 'center', horizontal: 'center' },
  'center-right': { vertical: 'center', horizontal: 'flex-end' },
  'bottom-left': { vertical: 'flex-end', horizontal: 'flex-start' },
  'bottom-center': { vertical: 'flex-end', horizontal: 'center' },
  'bottom-right': { vertical: 'flex-end', horizontal: 'flex-end' },
};

export function contentPosition(position = 'center'): {
  justifyContent: Justify;
  alignItems: Align;
} {
  const resolved = POSITIONS[position] ?? POSITIONS.center;
  return { justifyContent: resolved.vertical, alignItems: resolved.horizontal };
}

/** `PlacementBanner`'s POSITION_CLS also pins the text alignment to the slot. */
const PLACEMENT_TEXT_ALIGN: Record<string, TextAlign> = {
  'top-left': 'left',
  'top-center': 'center',
  'top-right': 'right',
  'center-left': 'left',
  center: 'center',
  'center-right': 'right',
  'bottom-left': 'left',
  'bottom-center': 'center',
  'bottom-right': 'right',
};

export function placementTextAlign(position = 'center'): TextAlign {
  return PLACEMENT_TEXT_ALIGN[position] ?? 'center';
}

export function textAlignOf(alignment = 'center'): TextAlign {
  if (alignment === 'left' || alignment === 'right') return alignment;
  return 'center';
}

/** `home_secondary` is a shorter strip; every other slot is the 21:9 hero shape. */
const PLACEMENT_ASPECT: Record<string, number> = {
  home_hero: 21 / 9,
  home_secondary: 3 / 1,
  category_top: 21 / 9,
  product_page: 21 / 9,
};

export function placementAspectRatio(placement: string): number {
  return PLACEMENT_ASPECT[placement] ?? 21 / 9;
}

export interface CtaSkin {
  backgroundColor: string;
  textColor: string;
  borderColor?: string;
  borderWidth?: number;
  underline?: boolean;
}

/** `PlacementBanner`'s CTA_CLS. */
export function placementCtaSkin(style = 'primary'): CtaSkin {
  switch (style) {
    case 'secondary':
      return { backgroundColor: '#ffffff', textColor: '#111111', borderColor: 'rgba(255,255,255,0.3)', borderWidth: 1 };
    case 'outline':
      return { backgroundColor: 'transparent', textColor: '#ffffff', borderColor: '#ffffff', borderWidth: 2 };
    case 'text':
      return { backgroundColor: 'transparent', textColor: '#ffffff', underline: true };
    case 'custom':
      return { backgroundColor: '#111111', textColor: '#ffffff' };
    default:
      // orange-500
      return { backgroundColor: '#f97316', textColor: '#ffffff' };
  }
}
