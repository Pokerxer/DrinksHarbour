/** Published brands remain discoverable even when their cached stock count is zero. */
export function displayableBrands<T extends { name?: string; slug?: string }>(brands: T[]): T[] {
  return brands.filter(brand => Boolean(brand?.name && brand?.slug));
}
