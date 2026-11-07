'use client';

import { sizeVariantLabel } from '@/utils/size-variant-label';
import type { POSSize } from '../types';

/**
 * Industry-variant support for the POS till (2026-11-02 catalogue-scope
 * round): a Size can now carry `colorName` + `colorHexCode` (fashion et al.),
 * so two rows such as "m / Amber" and "m / Red" must stay distinguishable in
 * the till. Renders the size name with a color swatch dot whose title carries
 * the color name — subtle by design (these chips live on a touch screen).
 * Sizes without color data render exactly as before.
 *
 * Swatch edge (contrast pass): a fixed faint border cannot separate stars of
 * both extremes on both chip states (mid-yellow #ffcc00 vanishes on white,
 * midnight navy vanishes on the #b20202 accent), so the 1px edge is chosen
 * from the swatch's own luminance — light swatches get a dark edge, dark
 * swatches a white halo. One rule, constant cost, no chip-state prop.
 */
export const HEX_PATTERN = /^#[0-9A-F]{6}$/i;

/** Light swatches (alias to white chip bg) get a dark edge; the rest a white halo. */
const LIGHT_EDGE = 'rgba(0,0,0,0.25)';
const DARK_EDGE = 'rgba(255,255,255,0.55)';

// Per-validated-hex memo: the till grid re-renders on every search keystroke,
// so the dot must never re-derive luminance for a color it already classified.
const edgeByHex = new Map<string, string>();

function dotEdgeColor(hex: string): string {
  const cached = edgeByHex.get(hex);
  if (cached) return cached;
  const lin = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const lum =
    0.2126 * lin(parseInt(hex.slice(1, 3), 16) / 255) +
    0.7152 * lin(parseInt(hex.slice(3, 5), 16) / 255) +
    0.0722 * lin(parseInt(hex.slice(5, 7), 16) / 255);
  const edge = lum >= 0.45 ? LIGHT_EDGE : DARK_EDGE;
  edgeByHex.set(hex, edge);
  return edge;
}

export function POSColorDot({ size }: { size: POSSize }) {
  if (!size.colorHexCode || !HEX_PATTERN.test(size.colorHexCode)) return null;
  return (
    <span
      aria-hidden="true"
      title={size.colorName || undefined}
      style={{
        backgroundColor: size.colorHexCode,
        borderColor: dotEdgeColor(size.colorHexCode),
      }}
      className="inline-block h-2 w-2 shrink-0 rounded-full border"
    />
  );
}

export function variantLabel(
  size?: Partial<Pick<POSSize, 'displayName' | 'colorName' | 'optionName'>> | null
): string {
  return size ? sizeVariantLabel(size) : '';
}
