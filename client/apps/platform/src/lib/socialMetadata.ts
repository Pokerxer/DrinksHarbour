import type { Metadata } from 'next';

/** Next replaces nested metadata objects; each page needs its own social image. */
export function withSocialMetadata(metadata: Metadata): Metadata {
  const title = typeof metadata.title === 'string'
    ? metadata.title
    : metadata.title && 'absolute' in metadata.title
      ? metadata.title.absolute
      : 'DrinksHarbour';
  const description = metadata.description || undefined;
  const canonical = metadata.alternates?.canonical;
  const url = typeof canonical === 'string' || canonical instanceof URL ? canonical : undefined;
  const image = { url: '/og-default.jpg', width: 1200, height: 630, alt: 'DrinksHarbour' };
  const twitterImages = metadata.twitter && 'images' in metadata.twitter
    ? metadata.twitter.images
    : undefined;

  return {
    ...metadata,
    openGraph: {
      type: 'website', siteName: 'DrinksHarbour', title, description, url,
      ...metadata.openGraph,
      images: metadata.openGraph?.images || [image],
    },
    twitter: {
      card: 'summary_large_image', title, description,
      ...metadata.twitter,
      images: twitterImages || ['/og-default.jpg'],
    },
  };
}
