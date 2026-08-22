import type { ReactNode } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import type { StyleProp, ViewStyle } from 'react-native';

/**
 * Tailwind gradients, for React Native.
 *
 * NativeWind has no `bg-gradient-*` utility — the class is silently dropped and
 * the element paints nothing. Every gradient on the platform homepage is
 * therefore restated here as an explicit stop list, resolved from Tailwind's
 * default palette (which is what `apps/platform/tailwind.config.ts` redeclares).
 *
 * The names are the web class they replace, so a change on either side is
 * greppable from the other.
 */

type Direction = 'r' | 'l' | 'b' | 't' | 'br' | 'bl' | 'tr' | 'tl';

const VECTORS: Record<Direction, { start: { x: number; y: number }; end: { x: number; y: number } }> = {
  r: { start: { x: 0, y: 0.5 }, end: { x: 1, y: 0.5 } },
  l: { start: { x: 1, y: 0.5 }, end: { x: 0, y: 0.5 } },
  b: { start: { x: 0.5, y: 0 }, end: { x: 0.5, y: 1 } },
  t: { start: { x: 0.5, y: 1 }, end: { x: 0.5, y: 0 } },
  br: { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } },
  bl: { start: { x: 1, y: 0 }, end: { x: 0, y: 1 } },
  tr: { start: { x: 0, y: 1 }, end: { x: 1, y: 0 } },
  tl: { start: { x: 1, y: 1 }, end: { x: 0, y: 0 } },
};

export interface GradientSpec {
  colors: readonly [string, string, ...string[]];
  direction: Direction;
  /** Only set when the web gradient names an explicit `via-` midpoint. */
  locations?: readonly [number, number, ...number[]];
}

export const GRADIENTS = {
  /** FlashSale section — `from-red-500 via-orange-500 to-red-500` */
  flashSaleSection: { colors: ['#ef4444', '#f97316', '#ef4444'], direction: 'r' },
  /** FlashSale card badge — `from-orange-500 to-red-600` */
  badgeFlash: { colors: ['#f97316', '#dc2626'], direction: 'br' },
  /** `from-emerald-500 to-teal-600` */
  badgeFixed: { colors: ['#10b981', '#0d9488'], direction: 'br' },
  /** `from-red-500 to-pink-600` */
  badgePercent: { colors: ['#ef4444', '#db2777'], direction: 'br' },
  /** Deal card badges — `from-orange-500 to-red-500` */
  dealBadgeFlash: { colors: ['#f97316', '#ef4444'], direction: 'r' },
  /** `from-emerald-500 to-teal-500` */
  dealBadgeFixed: { colors: ['#10b981', '#14b8a6'], direction: 'r' },
  /** `from-red-500 to-pink-500` */
  dealBadgePercent: { colors: ['#ef4444', '#ec4899'], direction: 'r' },
  /** Card image plate — `from-gray-50 to-gray-100` */
  imagePlate: { colors: ['#f9fafb', '#f3f4f6'], direction: 'br' },
  /** Broken-image plate — `from-gray-100 to-gray-50` */
  imageBroken: { colors: ['#f3f4f6', '#f9fafb'], direction: 'br' },
  /** Featured "Premium Selection" pill + stat circles — `from-amber-100 to-yellow-100` */
  amberPill: { colors: ['#fef3c7', '#fef9c3'], direction: 'r' },
  /** Featured ribbon — `from-amber-400 to-yellow-500` */
  featuredRibbon: { colors: ['#fbbf24', '#eab308'], direction: 'r' },
  /** Featured CTA — `from-amber-500 to-yellow-500` */
  featuredCta: { colors: ['#f59e0b', '#eab308'], direction: 'r' },
  /** Featured section backdrop — `from-white via-amber-50/20 to-white` */
  featuredSection: { colors: ['#ffffff', 'rgba(255,251,235,0.2)', '#ffffff'], direction: 'b' },
  /** Benefit backdrop — `from-gray-50 via-white to-red-50/30` */
  benefitSection: { colors: ['#f9fafb', '#ffffff', 'rgba(254,242,242,0.3)'], direction: 'br' },
  /** Benefit CTA — `from-red-600 via-rose-600 to-amber-500` */
  benefitCta: { colors: ['#dc2626', '#e11d48', '#f59e0b'], direction: 'r' },
  /** Hero primary CTA — `from-red-700 to-red-800` */
  heroCta: { colors: ['#b91c1c', '#991b1b'], direction: 'r' },
  /** Hero autoplay progress — `from-amber-500 via-amber-400 to-red-500` */
  heroProgress: { colors: ['#f59e0b', '#fbbf24', '#ef4444'], direction: 'r' },
  /** Header accent hairline — `from-red-600 via-orange-400 to-red-600` */
  headerAccent: { colors: ['#dc2626', '#fb923c', '#dc2626'], direction: 'r' },
  /** Empty-drawer prompt plate — `from-orange-50 to-amber-50` */
  drawerPrompt: { colors: ['#fff7ed', '#fffbeb'], direction: 'br' },
} as const satisfies Record<string, GradientSpec>;

export type GradientName = keyof typeof GRADIENTS;

export function Gradient({
  name,
  className,
  style,
  children,
  pointerEvents,
}: {
  name: GradientName;
  className?: string;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  pointerEvents?: 'none' | 'auto' | 'box-none';
}) {
  // Widened to the shared shape: `as const` above narrows each entry to its own
  // literal type, and only some of them carry `locations`.
  const spec: GradientSpec = GRADIENTS[name];
  const vector = VECTORS[spec.direction];

  return (
    <LinearGradient
      colors={spec.colors}
      locations={spec.locations}
      start={vector.start}
      end={vector.end}
      className={className}
      style={style}
      pointerEvents={pointerEvents}
    >
      {children}
    </LinearGradient>
  );
}

/**
 * A free-form gradient, for the hero's per-slide overlay — its stop colours come
 * from `banner.backgroundColor`, so they cannot be a named constant.
 */
export function CustomGradient({
  colors,
  direction = 'b',
  locations,
  className,
  style,
  children,
  pointerEvents,
}: {
  colors: readonly [string, string, ...string[]];
  direction?: Direction;
  locations?: readonly [number, number, ...number[]];
  className?: string;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  pointerEvents?: 'none' | 'auto' | 'box-none';
}) {
  const vector = VECTORS[direction];

  return (
    <LinearGradient
      colors={colors}
      locations={locations}
      start={vector.start}
      end={vector.end}
      className={className}
      style={style}
      pointerEvents={pointerEvents}
    >
      {children}
    </LinearGradient>
  );
}
