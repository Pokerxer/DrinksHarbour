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

import { useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { PiArrowUpRight } from 'react-icons/pi';

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
  entityType?: 'brand' | 'category' | 'subcategory';
  /** Entity document _id for analytics. */
  entityId?: string;
}

const API = process.env.NEXT_PUBLIC_API_URL || '';

function fireEntityBeacon(
  entityType: string | undefined,
  entityId: string | undefined,
  event: 'impression' | 'click'
) {
  if (!entityType || !entityId || !API) return;
  try {
    fetch(`${API}/api/banners/entity/${entityType}/${entityId}/${event}`, {
      method: 'POST',
      keepalive: true,
    });
  } catch {
    // fire-and-forget
  }
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
  const wrapperRef = useRef<HTMLDivElement>(null);
  const hasTrackedImpression = useRef(false);

  // Track impression once when the banner scrolls into view.
  useEffect(() => {
    if (!entityType || !entityId || !wrapperRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasTrackedImpression.current) {
          hasTrackedImpression.current = true;
          fireEntityBeacon(entityType, entityId, 'impression');
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(wrapperRef.current);
    return () => observer.disconnect();
  }, [entityType, entityId]);

  const handleClick = useCallback(() => {
    fireEntityBeacon(entityType, entityId, 'click');
  }, [entityType, entityId]);

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
