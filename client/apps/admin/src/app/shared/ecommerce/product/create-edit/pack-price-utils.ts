/**
 * Pack-pricing helpers for the "Review Sub-Product" drawer.
 *
 * The server (`server/utils/pricing.js` → `calculateSizePricing`) publishes a
 * `packUnitPrice` only when the computed pack price genuinely beats the normal
 * platform price. Two clamps in `calcPlatformSellingPrice` — round-up-to-₦100
 * and the undercut-below-the-tenant's-own-store-price rule — are applied to the
 * normal price AND the pack price alike, so whenever the tenant's store price
 * sits close to the platform's cost basis both prices collapse onto the SAME
 * ₦100 step and the pack offer is suppressed. As of 2026-09-01 that is 468 of
 * the 491 sizes with no pack price, including every listing created that day.
 *
 * `packPlatformCostPrice` is still published in that case ("exposed above for
 * admin insight"), and the approve endpoint accepts a per-size `packUnitPrice`
 * override for any pack-eligible size. So the admin CAN set a pack rate — the
 * drawer just has to show the control. These helpers decide when to show it and
 * what price to propose.
 *
 * Pure functions only: admin vitest runs with `environment: 'node'`, so logic
 * that needs a test cannot live inside the component.
 */

export interface PackPricingInputs {
  /** Platform cost on the normal (non-pack) tenant rate. */
  platformCostPrice?: number | null;
  /** Normal platform selling price, after rounding + undercut. */
  platformSellingPrice?: number | null;
  /** Platform cost on the tenant's reduced pack rate. */
  packPlatformCostPrice?: number | null;
  /** Published pack price — null when the server suppressed the offer. */
  packUnitPrice?: number | null;
  /** Published pack threshold — null alongside a suppressed packUnitPrice. */
  packThreshold?: number | null;
}

/** Platform prices are always clean hundreds. */
const roundUpTo100 = (price: number) => Math.ceil(price / 100) * 100;

/**
 * A size is pack-eligible when the server priced a pack cost basis for it. That
 * happens exactly when `unitsPerPack >= tenant.packRateMinUnits`, the threshold
 * is reachable, a normal price exists and no product sale is running — i.e. the
 * conditions under which a pack rate may be published at all.
 *
 * Deliberately independent of `packUnitPrice`: a suppressed offer is still an
 * eligible pack, and is precisely the case the admin needs to act on.
 */
export const isPackEligible = (pricing?: PackPricingInputs | null): boolean =>
  (pricing?.packPlatformCostPrice ?? 0) > 0;

/**
 * The pack price to propose when the server published none.
 *
 * Rule: keep the effective platform markup the normal price actually realised
 * (post-rounding, post-undercut) and apply it to the lower pack cost. That
 * passes the tenant's pack discount through to the customer without eroding the
 * platform's realised margin ratio, and it mirrors how an approved override is
 * stored — as `packPlatformMarkupOverridePct`, a markup over the pack cost.
 *
 * Returns null when the inputs are incomplete or the pack rate buys no room
 * under the normal price.
 */
export const suggestPackUnitPrice = (
  pricing?: PackPricingInputs | null
): number | null => {
  const platformCost = pricing?.platformCostPrice ?? 0;
  const platformSelling = pricing?.platformSellingPrice ?? 0;
  const packCost = pricing?.packPlatformCostPrice ?? 0;
  if (!(platformCost > 0) || !(platformSelling > 0) || !(packCost > 0)) {
    return null;
  }

  const effectiveMarkup = platformSelling / platformCost;
  const suggestion = roundUpTo100(packCost * effectiveMarkup);

  // A pack price that does not beat the normal price is not an offer, and one
  // at or below the pack cost is a loss.
  if (suggestion >= platformSelling || suggestion <= packCost) return null;
  return suggestion;
};

/** The discount a customer earns at the threshold, or null when there is none. */
export const packSavingsPct = (
  packPrice?: number | null,
  normalPrice?: number | null
): number | null => {
  if (!(packPrice! > 0) || !(normalPrice! > 0)) return null;
  if (packPrice! >= normalPrice!) return null;
  return Math.round(((normalPrice! - packPrice!) / normalPrice!) * 100);
};

/**
 * The platform markup a given pack price actually realises over the pack cost.
 *
 * The pack card draws its pipeline as `packCost ×(1+x%) → packSelling`, so x has
 * to be derived from the price on screen — the product's default markup is only
 * correct when neither the undercut clamp nor an admin edit moved the price.
 */
export const effectivePlatformMarkupPct = (
  price?: number | null,
  cost?: number | null
): number | null => {
  if (!(price! > 0) || !(cost! > 0)) return null;
  return Math.round((price! / cost! - 1) * 100);
};

/**
 * The quantity at which the pack price kicks in. The server publishes it only
 * alongside a published pack price; otherwise it is the size's own pack size.
 */
export const resolvePackThreshold = (
  pricing?: PackPricingInputs | null,
  unitsPerPack?: number | null
): number | null => {
  if ((pricing?.packThreshold ?? 0) > 0) return pricing!.packThreshold!;
  if ((unitsPerPack ?? 1) > 1) return unitsPerPack!;
  return null;
};
