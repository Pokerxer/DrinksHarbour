/**
 * Stock status — a direct port of the web `<StockStatus>` component's logic
 * (apps/platform/src/components/StockStatus/StockStatus.tsx).
 *
 * The thresholds are the product decision, not a styling detail: "Selling Fast"
 * at 70% sold is a claim the two apps must make at the same moment. Only the
 * derivation lives here; the RN component is pure layout.
 */

export type StockTone = 'out' | 'almost' | 'fast' | 'limited' | 'in';

export interface StockStatusView {
  tone: StockTone;
  /** What the row says. Overridden by "Only N left" at 5 or fewer. */
  text: string;
  /** Percent of the bar still filled — the web renders `100 - soldPercentage`. */
  remainingPct: number;
}

export interface StockStatusInput {
  stock?: number;
  totalStock?: number;
  availableStock?: number;
  inStock?: boolean;
}

/**
 * `totalStock` defaults to 100 exactly as the web prop default does, so a card
 * that knows only `stock` still lands on a sensible band instead of 0%.
 */
export function toStockStatusView({
  stock,
  totalStock = 100,
  availableStock,
  inStock = true,
}: StockStatusInput): StockStatusView {
  const effectiveStock = availableStock ?? stock ?? totalStock;
  const soldPercentage = ((totalStock - effectiveStock) / totalStock) * 100;
  const remainingPct = Math.min(100, Math.max(0, 100 - soldPercentage));

  // "Only N left" wins over the band label, as it does on the web.
  const lowCount = stock !== undefined && stock <= 5 && stock > 0 ? `Only ${stock} left` : null;

  if (!inStock || stock === 0) {
    return { tone: 'out', text: 'Out of Stock', remainingPct: 0 };
  }
  if (soldPercentage >= 90) {
    return { tone: 'almost', text: lowCount ?? 'Almost Gone', remainingPct };
  }
  if (soldPercentage >= 70) {
    return { tone: 'fast', text: lowCount ?? 'Selling Fast', remainingPct };
  }
  if (soldPercentage >= 50) {
    return { tone: 'limited', text: lowCount ?? 'Limited Stock', remainingPct };
  }
  return { tone: 'in', text: lowCount ?? 'In Stock', remainingPct };
}
