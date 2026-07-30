/**
 * Quantity-triggered pack pricing, resolved in one place.
 *
 * The product page, the quickview modal and the size cards all have to agree on
 * three questions: is there a pack offer worth showing, is it unlocked at the
 * current quantity, and what does the shopper actually pay. Deriving that inline
 * per surface is how the modal ended up ignoring pack pricing entirely.
 *
 * Two rules the UI must never break:
 *  - A size already on sale does NOT also get pack pricing. Stacking a sale and
 *    a pack discount over-discounts the item.
 *  - An offer the shopper cannot reach is not an offer. When stock (or the
 *    per-order cap) is short of one full pack, the offer is hidden rather than
 *    dangled as an unreachable nudge.
 */

export interface PackPricingInput {
  packUnitPrice?: number | null;
  packThreshold?: number | null;
  packSavingsPct?: number | null;
  /** Per-unit price the shopper pays without pack pricing (sale price included). */
  unitPrice: number;
  /** Units currently selected. */
  quantity: number;
  /** Units the seller can fulfil for this size. `null`/`undefined` = unknown, not zero. */
  stock?: number | null;
  /** Per-order cap, when the seller sets one. */
  maxOrderQuantity?: number | null;
  /** True when the size already carries a sale/discount. */
  onSale?: boolean;
}

export interface PackPricing {
  /** A reachable, cheaper pack offer exists for this size. */
  hasPackPricing: boolean;
  /** The offer exists AND the current quantity unlocks it. */
  packRateActive: boolean;
  /** Offer fields, non-null only while `hasPackPricing`. */
  packUnitPrice: number | null;
  packThreshold: number | null;
  packSavingsPct: number | null;
  /** What one unit costs right now. */
  effectiveUnitPrice: number;
  /** What the whole selection costs right now. */
  effectiveTotal: number;
  /** Units still needed to unlock the pack rate (0 once unlocked or unavailable). */
  thresholdRemaining: number;
  /** Naira saved versus paying the normal unit price for the same quantity. */
  totalSavings: number;
}

/** Largest quantity a shopper could actually buy, or `null` when unconstrained. */
const buyableQuantity = (
  stock?: number | null,
  maxOrderQuantity?: number | null,
): number | null => {
  const caps = [stock, maxOrderQuantity].filter(
    (v): v is number => typeof v === 'number' && Number.isFinite(v),
  );
  return caps.length ? Math.min(...caps) : null;
};

export const resolvePackPricing = ({
  packUnitPrice,
  packThreshold,
  packSavingsPct,
  unitPrice,
  quantity,
  stock,
  maxOrderQuantity,
  onSale = false,
}: PackPricingInput): PackPricing => {
  const qty = Math.max(1, quantity || 1);
  const normalUnitPrice = unitPrice || 0;
  const buyable = buyableQuantity(stock, maxOrderQuantity);

  const hasPackPricing = !!(
    packUnitPrice &&
    packThreshold &&
    packThreshold > 0 &&
    packUnitPrice < normalUnitPrice &&
    !onSale &&
    (buyable === null || buyable >= packThreshold)
  );

  if (!hasPackPricing) {
    return {
      hasPackPricing: false,
      packRateActive: false,
      packUnitPrice: null,
      packThreshold: null,
      packSavingsPct: null,
      effectiveUnitPrice: normalUnitPrice,
      effectiveTotal: normalUnitPrice * qty,
      thresholdRemaining: 0,
      totalSavings: 0,
    };
  }

  const threshold = packThreshold as number;
  const packPrice = packUnitPrice as number;
  const packRateActive = qty >= threshold;
  const effectiveUnitPrice = packRateActive ? packPrice : normalUnitPrice;

  return {
    hasPackPricing: true,
    packRateActive,
    packUnitPrice: packPrice,
    packThreshold: threshold,
    packSavingsPct: packSavingsPct ?? null,
    effectiveUnitPrice,
    effectiveTotal: effectiveUnitPrice * qty,
    thresholdRemaining: Math.max(0, threshold - qty),
    totalSavings: (normalUnitPrice - effectiveUnitPrice) * qty,
  };
};
