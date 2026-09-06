'use client';

/**
 * LinkableBanner — a full-width 2:1 clickable banner for entity detail pages.
 *
 * Brand / Category / SubCategory records carry an admin-set storefront hero
 * image (`bannerImage`) plus a click-through destination (`bannerLink`) and
 * an open-in-new-tab flag (`bannerLinkType`). When both the image and a link
 * are present this renders them as a single full-width banner that navigates
 * on the whole surface when tapped — the same pattern the homepage hero and
 * ShopHeroBanner use. With a link but no image, or image but no link, it
 * either degrades to the plain image or renders nothing.
 *
 * Analytics: when `entityType` and `entityId` are passed (brand / category /
 * subcategory), this component tracks impressions via IntersectionObserver and
 * clicks via onClick, both fire-and-forget to the banner analytics endpoint.
 */

import Link from 'next/link';
import Image from 'next/image';
import { PiArrowUpRight } from 'react-icons/pi';
import {
  useEntityBannerTracking,
  type EntityBannerType,
} from './entity-banner-analytics';

export interface LinkableBannerProps {
  /** Full storefront hero image URL (bannerImage, usually 2:1). */
  image?: string;
  /** Click-through destination; empty/null = not clickable. */
  link?: string | null;
  /** 'external' opens in a new tab; anything else uses client routing. */
  linkType?: string;
  /** Accessible label / alt text. Defaults to a generic banner label. */
  alt?: string;
  className?: string;
  /** Entity type for analytics (brand | category | subcategory). */
  entityType?: EntityBannerType;
  /** Entity document _id for analytics. */
  entityId?: string;
}

export default function LinkableBanner({
  image,
  link,
  linkType,
  alt = 'Promotional banner',
  className = '',
  entityType,
  entityId,
}: LinkableBannerProps) {
  const { ref: wrapperRef, trackClick: handleClick } =
    useEntityBannerTracking<HTMLDivElement>(entityType, entityId);

  // Nothing to show without an image.
  if (!image) return null;

  const external = linkType === 'external';
  const href = link?.trim() || null;

  const frame = (
    <div ref={wrapperRef} className={`relative flex w-full items-stretch overflow-hidden ${className}`}>
      <div className="relative aspect-[2/1] w-full">
        <Image
          src={image}
          alt={href ? `${alt} — view offer` : alt}
          fill
          sizes="100vw"
          priority
          className="object-cover object-center"
        />
        {href && (
          <span className="pointer-events-none absolute bottom-4 right-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-gray-900 shadow-md">
            <PiArrowUpRight className="h-5 w-5" aria-hidden="true" />
          </span>
        )}
      </div>
    </div>
  );

  if (href && external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${alt} — view offer`}
        className="block"
        onClick={handleClick}
      >
        {frame}
      </a>
    );
  }

  if (href) {
    return (
      <Link href={href} aria-label={`${alt} — view offer`} className="block" onClick={handleClick}>
        {frame}
      </Link>
    );
  }

  return frame;
}
