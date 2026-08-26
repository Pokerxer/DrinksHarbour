'use client';

/**
 * Shared whole-banner click-through helpers.
 *
 * A banner is clickable when it has a `ctaLink` and `imageClickable !== false`
 * (the flag defaults to true server-side, so legacy docs without the field
 * stay clickable). Internal links use next/link; external ones open a new tab.
 * Every navigation fires the /click tracking beacon.
 */

import Link from 'next/link';

export interface ClickableBannerData {
  _id?: string;
  ctaLink?: string;
  linkType?: string;
  imageClickable?: boolean;
  title?: string;
}

/** True when clicking anywhere on the banner should navigate to ctaLink. */
export function isImageClickable(
  banner?: ClickableBannerData | null
): boolean {
  return Boolean(banner?.ctaLink) && banner?.imageClickable !== false;
}

function trackClick(id?: string) {
  if (!id) return;
  fetch(`/api/banners/${id}/click`, { method: 'POST' }).catch(() => {});
}

interface Props {
  banner: ClickableBannerData;
  /** Slot for the banner content (image, overlay, text…). */
  children: React.ReactNode;
  className?: string;
  /** Accessible label when the banner has no visible text. */
  ariaLabel?: string;
}

/**
 * Wraps banner media in the CTA link when the banner is clickable.
 * Renders children unchanged otherwise.
 * Note: the wrapped element must NOT contain its own <a>/<Link> CTA button —
 * nested anchors are invalid HTML. For banners that show a CTA button, layer
 * this component UNDER the content instead (see HeroBanner/PlacementBanner).
 */
export function BannerClickArea({
  banner,
  children,
  className = '',
  ariaLabel,
}: Props) {
  const external = banner.linkType === 'external';
  return (
    <Link
      href={banner.ctaLink || '#'}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      onClick={() => trackClick(banner._id)}
      aria-label={ariaLabel || banner.title || undefined}
      className={className}
    >
      {children}
    </Link>
  );
}

/**
 * Invisible full-area link layer for image-dominant banners whose text/CTA
 * content must stay separately interactive. Place it above the image but
 * BELOW the content layer (content needs relative z-10).
 */
export function BannerClickLayer({
  banner,
  ariaLabel,
}: {
  banner: ClickableBannerData;
  ariaLabel?: string;
}) {
  if (!isImageClickable(banner)) return null;
  const external = banner.linkType === 'external';
  return (
    <Link
      href={banner.ctaLink || '#'}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      onClick={() => trackClick(banner._id)}
      aria-label={
        ariaLabel || banner.title || 'Open banner link'
      }
      className="absolute inset-0 z-[5] cursor-pointer"
    />
  );
}
