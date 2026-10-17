export function searchPrice(product: {
  shoppingOffer?: { price: number } | null;
  priceRange?: { min: number; max: number };
}) {
  return { price: product.shoppingOffer?.price ?? product.priceRange?.min ?? 0, original: undefined };
}
