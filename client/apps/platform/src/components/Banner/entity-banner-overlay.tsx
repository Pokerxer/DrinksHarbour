'use client';

/**
 * EntityBannerOverlay — makes the surface it is dropped into *be* the entity's
 * banner, instead of stacking a second banner above it.
 *
 * The brand page already paints the admin-set `bannerImage` as its hero
 * backdrop, so the standalone <LinkableBanner/> that used to sit above the hero
 * showed the very same artwork twice, back to back. This keeps everything that
 * banner actually contributed — the `bannerLink` click-through, the affordance
 * arrow, and the impression/click beacons — and gives it to the hero.
 *
 * Usage: drop it as the LAST child of a `relative` wrapper. It stretches over
 * that whole wrapper at z-20, so any control inside that must stay clickable
 * (the breadcrumb, the Shop CTA) needs `relative z-30`. With no link it renders
 * an inert sentinel that still records the impression — the same thing the old
 * banner did for an image with no destination.
 */

import Link from 'next/link';
import { PiArrowUpRight } from 'react-icons/pi';
import {
  useEntityBannerTracking,
  type EntityBannerType,
} from './entity-banner-analytics';

export interface EntityBannerOverlayProps {
  /** Click-through destination; empty/null = tracked but not clickable. */
  link?: string | null;
  /** 'external' opens in a new tab; anything else uses client routing. */
  linkType?: string;
  /** Entity name, used to build the accessible label. */
  label: string;
  /** Entity type for analytics (brand | category | subcategory). */
  entityType?: EntityBannerType;
  /** Entity document _id for analytics. */
  entityId?: string;
}

export default function EntityBannerOverlay({
  link,
  linkType,
  label,
  entityType,
  entityId,
}: EntityBannerOverlayProps) {
  const { ref, trackClick } = useEntityBannerTracking<HTMLElement>(
    entityType,
    entityId
  );

  const href = link?.trim() || null;
  const external = linkType === 'external';
  const ariaLabel = `${label} — view offer`;
  const stretched = 'absolute inset-0 z-20';

  // Top-right, not bottom-right: the floating WhatsApp/chat buttons and the
  // mobile bottom nav own the bottom-right corner and would bury it there.
  const affordance = (
    <span className="pointer-events-none absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-gray-900 shadow-md">
      <PiArrowUpRight className="h-5 w-5" aria-hidden="true" />
    </span>
  );

  if (!href) {
    return (
      <span
        ref={ref}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
      />
    );
  }

  if (external) {
    return (
      <a
        ref={ref as React.RefObject<HTMLAnchorElement | null>}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={ariaLabel}
        className={stretched}
        onClick={trackClick}
      >
        {affordance}
      </a>
    );
  }

  return (
    <Link
      ref={ref as React.RefObject<HTMLAnchorElement | null>}
      href={href}
      aria-label={ariaLabel}
      className={stretched}
      onClick={trackClick}
    >
      {affordance}
    </Link>
  );
}
