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
