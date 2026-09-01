// Typed models for the POS pricelists module.
export interface SizeLite {
  _id?: string;
  size?: string;
  displayName?: string;
  costPrice?: number;
  wholesalePrice?: number;
  sellingPrice?: number;
  isDefault?: boolean;
  unitsPerPack?: number;
}

export interface SubProductLite {
  _id: string;
  sku?: string;
  product?: { _id?: string; name?: string } | string;
  baseSellingPrice?: number;
  costPrice?: number;
  isOnSale?: boolean;
  saleType?: 'percentage' | 'fixed';
  saleDiscountValue?: number;
  flashSale?: { isActive?: boolean; discountPercentage?: number };
  bundleDeals?: unknown[];
  /** Populated size variants (each Size may carry a wholesalePrice). */
  sizes?: SizeLite[];
}

/** The price basis a `formula` (markup) rule applies the markup to. */
export type MarkupBase = 'cost' | 'wholesale';

/** Representative wholesale price for a SubProduct: the default size's
 *  wholesalePrice, falling back to the first size that has one. 0 when none. */
export function subproductWholesalePrice(
  p: SubProductLite | undefined
): number {
  if (!p?.sizes?.length) return 0;
  const sizes = p.sizes;
  const def = sizes.find((s) => s.isDefault) || sizes[0];
  const wp = Number(def?.wholesalePrice) || 0;
  if (wp > 0) return wp;
  const first = sizes.find((s) => Number(s.wholesalePrice) > 0);
  return Number(first?.wholesalePrice) || 0;
}

/** True when the product has a usable wholesale price on any size. */
export function hasWholesalePrice(p: SubProductLite | undefined): boolean {
  return subproductWholesalePrice(p) > 0;
}

/** Representative pack size (units per pack) for a SubProduct: the default
 *  size's unitsPerPack, falling back to the first size with a pack size > 1.
 *  0 when no size carries a meaningful (>1) pack size. */
export function subproductPackSize(p: SubProductLite | undefined): number {
  if (!p?.sizes?.length) return 0;
  const sizes = p.sizes;
  const def = sizes.find((s) => s.isDefault) || sizes[0];
  const up = Number(def?.unitsPerPack) || 0;
  if (up > 1) return up;
  const first = sizes.find((s) => Number(s.unitsPerPack) > 1);
  return Number(first?.unitsPerPack) || 0;
}

/** True when the product has a size with a meaningful (>1) pack size. */
export function hasPackSize(p: SubProductLite | undefined): boolean {
  return subproductPackSize(p) > 1;
}

/** How many catalogue products can actually satisfy a given markup basis. */
export interface BasisCoverage {
  total: number;
  withWholesale: number;
  withoutWholesale: number;
  withPack: number;
  withoutPack: number;
}

/**
 * Coverage of the wholesale / pack bases across the catalogue.
 *
 * An "all products" rule with `markupBase: 'wholesale'` is silently inert on
 * every product whose sizes carry no wholesale price — both this client and
 * `pricelistPricing.service` leave such a line at its current price. Since the
 * rule form only knows a basis value for a *selected* product, an all-products
 * rule could previously be saved with no signal at all that it would do
 * nothing. This measures the real catalogue so the form can say so up front.
 */
export function basisCoverage(
  products: SubProductLite[] | undefined
): BasisCoverage {
  const list = Array.isArray(products) ? products : [];
  const withWholesale = list.filter((p) => hasWholesalePrice(p)).length;
  const withPack = list.filter((p) => hasPackSize(p)).length;
  return {
    total: list.length,
    withWholesale,
    withoutWholesale: list.length - withWholesale,
    withPack,
    withoutPack: list.length - withPack,
  };
}

export type PriceRuleType =
  | 'discount'
  | 'flash_sale'
  | 'fixed'
  | 'formula'
  | 'bundle'
  | 'cart_threshold';

export interface PricelistRule {
  _id: string;
  subProduct?: SubProductLite | string;
  appliedOn?: string;
  priceType: PriceRuleType;
  discountType?: 'percentage' | 'fixed';
  discountPercentage?: number;
  discountAmount?: number;
  fixedPrice?: number;
  markupPercentage?: number;
  /** Formula-rule markup base: 'cost' (default) or 'wholesale' when the
   *  product's size has a wholesale price. */
  markupBase?: MarkupBase;
  flashSalePercentage?: number;
  flashSaleQty?: number;
  bundleName?: string;
  bundleQuantity?: number;
  bundleDiscount?: number;
  bundleDiscountType?:
    | 'percentage'
    | 'fixed'
    | 'markup_on_cost'
    | 'no_discount';
  /** Markup basis when bundleDiscountType is 'markup_on_cost'. */
  bundleMarkupBase?: MarkupBase;
  /** 'manual' = use bundleQuantity; 'pack' = use size's unitsPerPack at runtime. */
  bundleUnitsMode?: 'manual' | 'pack';
  bundleTargetSubProduct?: SubProductLite | string;
  thresholdAmount?: number;
  minQuantity?: number;
  startDate?: string;
  endDate?: string;
  /** Priority: lower applies first. Server-owned — assigned on add, rewritten
   *  by PATCH /:id/rules/reorder. Both pricing engines stack rules in this
   *  order; the stored array order is NOT authoritative. */
  sequence?: number;
}

export interface Pricelist {
  _id: string;
  name: string;
  currency?: string;
  website?: string;
  isSelectable?: boolean;
  isDefault?: boolean;
  shops?: string[];
  warehouses?: Array<string | { _id?: string; name?: string }>;
  customerTags?: string[];
  countryGroups?: string[];
  rules?: PricelistRule[];
}

/** True when a selected pricelist still has to be fetched through GET /:id to
 *  get its rules. The list endpoint projects `rules` away, so a row clicked in
 *  the table has `rules: undefined` — which is NOT the same as `rules: []` from
 *  the detail endpoint. Conflating the two renders the "No price rules yet"
 *  empty state over a pricelist that actually has rules. */
export function needsRuleHydration(pl: Pricelist | null | undefined): boolean {
  return !!pl && !Array.isArray(pl.rules);
}

/**
 * Rules in the order they are actually applied: ascending `sequence`.
 *
 * The stored array order is not the priority order. `PATCH /:id/rules/reorder`
 * rewrites `sequence` without touching the array, so a reordered pricelist
 * comes back from `GET /:id` looking untouched — while both pricing engines
 * (`findMatchingPricelistRules` here, `findMatchingPriceRules` on the server)
 * sort by `sequence` before stacking. Displaying raw array order therefore
 * makes the `#n` badge lie, and lets a ↑/↓ swap renumber every rule from an
 * order that was already wrong — silently repricing the pricelist.
 *
 * Ties break on `_id` so that duplicate sequences (reachable via the old
 * `sequence = rules.length` on add) still order deterministically across
 * refetches instead of shuffling with the array.
 */
export function sortRulesBySequence(
  rules: PricelistRule[] | undefined | null
): PricelistRule[] {
  if (!Array.isArray(rules)) return [];
  return [...rules].sort((a, b) => {
    const seqDiff = (Number(a.sequence) || 0) - (Number(b.sequence) || 0);
    if (seqDiff !== 0) return seqDiff;
    return String(a._id).localeCompare(String(b._id));
  });
}

/**
 * Short label explaining why a rule sits where it does in the list.
 *
 * Priority is derived, not dragged — the ranking itself is single-sourced on
 * the server (`services/pricelistPriority.service`), which owns `sequence`
 * because both pricing engines read it off the stored document. This is only
 * the card's presentation of that ranking; the server has its own, longer
 * wording for backfill output.
 *
 * The distinction that matters: `fixed`/`formula` assign the price outright in
 * `applyPriceRules`, so they must run before anything that merely adjusts it.
 */
export function priorityReason(rule: PricelistRule): string {
  const qty = Number(rule.minQuantity) || 0;
  const tier = qty > 0 ? ` · qty ${qty}+` : '';
  const scoped = (label: string) =>
    rule.subProduct
      ? `Specific product · ${label.charAt(0).toLowerCase()}${label.slice(1)}${tier}`
      : `${label}${tier}`;

  switch (rule.priceType) {
    case 'fixed':
    case 'formula':
      return scoped('Sets the price');
    case 'discount':
    case 'flash_sale':
      return scoped('Adjusts the price');
    case 'bundle':
      return scoped('Bundle');
    case 'cart_threshold':
      return rule.subProduct ? 'Specific product · whole cart' : 'Whole cart';
    default:
      return rule.subProduct ? 'Specific product' : 'All products';
  }
}

/** Name of a possibly-unpopulated product reference (populated object vs id string). */
export function refName(
  ref: { name?: string } | string | undefined
): string | undefined {
  return typeof ref === 'string' ? undefined : ref?.name;
}

/** Loose shape of the rule form while editing — all values strings for controlled inputs. */
export interface RuleFormValues {
  applyTo: 'product' | 'all';
  subProduct: string;
  appliedOn: string;
  priceType: PriceRuleType;
  fixedPrice: string;
  markupPercentage: string;
  markupBase: MarkupBase;
  discountType: 'percentage' | 'fixed';
  discountPercentage: string;
  discountAmount: string;
  flashSalePercentage: string;
  flashSaleQty: string;
  bundleName: string;
  bundleQuantity: string;
  bundleDiscount: string;
  bundleDiscountType: 'percentage' | 'fixed' | 'markup_on_cost' | 'no_discount';
  bundleMarkupBase: MarkupBase;
  bundleUnitsMode: 'manual' | 'pack';
  bundleTargetSubProduct: string;
  bundleTargetName: string;
  thresholdAmount: string;
  minQuantity: string;
  startDate: string;
  endDate: string;
}
