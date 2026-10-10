interface Artwork { url?: string; width?: number; height?: number }
interface BannerEntity {
  bannerImage?: Artwork;
  featuredImage?: Artwork;
  bannerLink?: string;
  bannerLinkType?: string;
}

export function resolveShopArtwork(entities: Array<BannerEntity | null | undefined>) {
  for (const entity of entities) {
    // Featured images belong to category cards; only dedicated banner artwork
    // can replace the main shop carousel.
    const image = entity?.bannerImage?.url?.trim() ? entity.bannerImage : undefined;
    if (image?.url) return { entity, image };
  }
  return null;
}
