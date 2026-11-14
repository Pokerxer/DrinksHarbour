type PriceInput = number | string | null;

interface PricingSize {
  _id?: string;
  size?: string | null;
  isDefault?: boolean;
  costPrice?: PriceInput;
  basePrice?: PriceInput;
}

interface ProductPricing {
  costPrice?: PriceInput;
  baseSellingPrice?: PriceInput;
  sellWithoutSizeVariants?: boolean;
  defaultSize?: string;
  sizes?: PricingSize[];
}

/** Resolve required API base prices without changing the editable form defaults. */
export function resolveSubProductPricing(product: ProductPricing) {
  const selected = product.sellWithoutSizeVariants
    ? []
    : (product.sizes ?? []).filter((variant) => variant.size?.trim());
  const defaultSize =
    selected.find((variant) => variant.isDefault) ??
    selected.find(
      (variant) =>
        product.defaultSize &&
        (variant._id === product.defaultSize ||
          variant.size === product.defaultSize)
    ) ??
    selected[0];

  return {
    costPrice: Number(product.costPrice) || Number(defaultSize?.costPrice) || 0,
    baseSellingPrice:
      Number(product.baseSellingPrice) || Number(defaultSize?.basePrice) || 0,
  };
}

/**
 * Card / toolbar price stat from SIZE rows: when the listing carries priced
 * size variants, the displayed price(s) come FROM THE SIZES — a sized listing
 * has no meaningful single base price. An active size sale (`isOnSale` with a
 * positive `salePrice`) overrides that row's selling price, mirroring the
 * storefront rule. Falls back to the listing base price only when no size
 * carries a positive price. `priceMax` is omitted when every priced size
 * agrees (single figure) or when it does not exceed the minimum.
 *
 * Rows come in two shapes — server Size docs carry `sellingPrice`, form rows
 * carry `basePrice` — plus unrelated metadata (`_id`, stock…), so the input is
 * intentionally loose and narrowed below.
 */
export type SizedPriceVariant = {
  sellingPrice?: PriceInput;
  basePrice?: PriceInput;
  salePrice?: PriceInput;
  isOnSale?: boolean | null;
};

export function resolveSizePrices(
  variants: ReadonlyArray<unknown> | null | undefined,
  fallback: PriceInput = 0
): { price: number; priceMax?: number } {
  const prices: number[] = [];
  for (const variant of variants ?? []) {
    if (!variant || typeof variant !== 'object') continue;
    const row = variant as SizedPriceVariant;
    const sale = Number(row.salePrice);
    const effective =
      Number.isFinite(sale) && sale > 0 && !!row.isOnSale
        ? sale
        : Number(row.basePrice ?? row.sellingPrice);
    if (Number.isFinite(effective) && effective > 0) prices.push(effective);
  }
  if (prices.length > 0) {
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    return max > min ? { price: min, priceMax: max } : { price: min };
  }
  const base = Number(fallback);
  return { price: Number.isFinite(base) ? base : 0 };
}

/** Edit-form toolbar stat: rows price themselves via `basePrice`. */
export function resolveToolbarPrice(
  product: ProductPricing
): { price: number; priceMax?: number } {
  return resolveSizePrices(
    product.sellWithoutSizeVariants ? [] : product.sizes,
    product.baseSellingPrice
  );
}
