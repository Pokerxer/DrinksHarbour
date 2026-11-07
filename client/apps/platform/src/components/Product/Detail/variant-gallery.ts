type Photo = { url: string; alt?: string };
type VariantPhoto = { colorName?: string; optionName?: string; imageScope?: 'variant' | 'color' | 'option'; image?: Photo | null };
const colorKey = (value?: string) => value?.trim().toLowerCase() || '';

export function resolveVariantGallery(
  selected: VariantPhoto | null,
  variants: readonly VariantPhoto[],
  listingImages: readonly Photo[],
  productImages: readonly Photo[]
): Photo[] {
  const color = colorKey(selected?.colorName);
  const matchingColorImage = color
    ? variants.find(variant => variant.imageScope === 'color' && colorKey(variant.colorName) === color && variant.image?.url)?.image
    : undefined;
  const option = colorKey(selected?.optionName);
  const matchingOptionImage = option
    ? variants.find(variant => variant.imageScope === 'option' && colorKey(variant.optionName) === option && variant.image?.url)?.image
    : undefined;
  const image = selected?.image?.url ? selected.image : matchingColorImage || matchingOptionImage;
  const gallery = listingImages.some(photo => photo?.url) ? listingImages : productImages;
  return [...new Map([...(image ? [image] : []), ...gallery]
    .filter(photo => photo?.url)
    .map(photo => [photo.url, photo])).values()];
}
