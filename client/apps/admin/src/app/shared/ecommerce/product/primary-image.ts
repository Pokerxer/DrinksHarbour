export interface ProductGalleryImage {
  url: string;
  alt?: string;
  publicId?: string;
  isPrimary?: boolean;
}

export function getPrimaryImageIndex(images: readonly ProductGalleryImage[]) {
  const primary = images.findIndex((image) => image.url && image.isPrimary);
  return primary === -1 ? images.findIndex((image) => image.url) : primary;
}

export function normalizePrimaryImages<T extends ProductGalleryImage>(
  images: readonly T[],
  primaryIndex = getPrimaryImageIndex(images)
): T[] {
  return images.map((image, index) => ({
    ...image,
    isPrimary: index === primaryIndex,
  }));
}
