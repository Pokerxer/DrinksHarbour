// Brand palette for rendered PDF documents. Colors are plain hex — pdf-render
// converts them for jsPDF. Status hues mirror the old HTML chip map.

export const BRAND = {
  /** DrinksHarbour signature red used across the admin UI. */
  red: '#b20202',
  redDark: '#7d0202',
  /** Deepest red — the slanted document panel in the header band. */
  redInk: '#5c0101',
  /** Warm accent that keeps an all-red document from reading as a warning. */
  gold: '#c9a227',
  /** Barely-there red wash for party cards and the amount-in-words strip. */
  blush: '#fdf7f7',
  ink: '#111827',
  body: '#374151',
  muted: '#6b7280',
  faint: '#9ca3af',
  line: '#e5e7eb',
  zebra: '#f9fafb',
  panel: '#f3f4f6',
  green: '#16a34a',
  amber: '#b45309',
  blue: '#2563eb',
  redText: '#dc2626',
} as const;

export const STATUS_COLORS: Record<string, string> = {
  paid: '#16a34a',
  overdue: '#dc2626',
  partial: '#d97706',
  confirmed: '#2563eb',
  draft: '#6b7280',
  cancelled: '#6b7280',
  cancel: '#6b7280',
  received: '#16a34a',
  validated: '#16a34a',
  completed: '#16a34a',
  approved: '#16a34a',
  refunded: '#059669',
  shipped: '#0891b2',
  in_transit: '#7c3aed',
  requested: '#2563eb',
  quoted: '#2563eb',
  sent: '#2563eb',
  pending: '#d97706',
  rejected: '#dc2626',
  expired: '#b45309',
  processing: '#d97706',
  partially_received: '#d97706',
};

/** Mix a hex color toward white by `amount` (0 = unchanged, 1 = white). */
export function tint(hex: string, amount: number): [number, number, number] {
  return mix(hex, '#ffffff', amount);
}

/**
 * Blend two hex colors. `amount` is how far to travel from `from` to `to`.
 * Needed for text that sits *on* the red band: tinting toward white there
 * produces plain white, so the muted lines must be mixed toward the band.
 */
export function mix(
  from: string,
  to: string,
  amount: number
): [number, number, number] {
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  return [
    Math.round(a[0] + (b[0] - a[0]) * amount),
    Math.round(a[1] + (b[1] - a[1]) * amount),
    Math.round(a[2] + (b[2] - a[2]) * amount),
  ];
}

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
