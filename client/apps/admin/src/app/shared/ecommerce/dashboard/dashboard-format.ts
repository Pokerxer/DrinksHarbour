// Shared formatting helpers for the e-commerce dashboard widgets.
// Kept co-located (see purchases-analytics-helpers.ts convention) so widgets
// don't each re-implement compact Naira abbreviation with slightly different
// rounding — which made the same figure render as ₦1.2M in one card and
// ₦1,234,567 in another.

/** Compact Naira for tight spaces: ₦950 · ₦45.3K · ₦1.2M · ₦3.4B */
export function formatCompactNaira(n: number): string {
  if (n >= 1_000_000_000) return compact(n / 1_000_000_000, 'B');
  if (n >= 1_000_000) return compact(n / 1_000_000, 'M');
  if (n >= 1_000) return compact(n / 1_000, 'K');
  return `₦${n.toLocaleString()}`;
}

function compact(value: number, suffix: string): string {
  const s = value.toFixed(1);
  return `₦${s.endsWith('.0') ? s.slice(0, -2) : s}${suffix}`;
}

/** Full Naira with thousands separators, no decimals: ₦12,500 */
export function formatNaira(n: number): string {
  return `₦${Math.round(n).toLocaleString()}`;
}

/** Percentage change vs a previous value, rounded to 1 decimal. */
export function percentChange(curr: number, prev: number): number {
  if (!prev) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 1000) / 10;
}
