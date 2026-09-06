'use client';

/**
 * Entity banner analytics — the impression + click beacons for the admin-set
 * storefront banner a Brand / Category / SubCategory record carries
 * (`bannerImage` + `bannerLink`).
 *
 * Two surfaces render that banner: <LinkableBanner/> — the standalone 2:1
 * banner on category and subcategory pages — and <EntityBannerOverlay/>, which
 * hands the same click-through to the brand page hero rather than painting the
 * artwork a second time above it. Both must report to the same endpoint, so
 * the beacon lives here instead of being copied into each.
 */

import { useCallback, useEffect, useRef } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || '';

export type EntityBannerType = 'brand' | 'category' | 'subcategory';

export type EntityBannerEvent = 'impression' | 'click';

export function fireEntityBeacon(
  entityType: EntityBannerType | undefined,
  entityId: string | undefined,
  event: EntityBannerEvent
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

/**
 * Attach `ref` to the element that stands in for the banner on screen and call
 * `trackClick` from its onClick. The impression fires once, the first time 30%
 * of that element is in view; passing no entityType/entityId disables both.
 */
export function useEntityBannerTracking<T extends Element>(
  entityType?: EntityBannerType,
  entityId?: string
) {
  const ref = useRef<T | null>(null);
  const hasTrackedImpression = useRef(false);

  useEffect(() => {
    if (!entityType || !entityId || !ref.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasTrackedImpression.current) {
          hasTrackedImpression.current = true;
          fireEntityBeacon(entityType, entityId, 'impression');
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [entityType, entityId]);

  const trackClick = useCallback(() => {
    fireEntityBeacon(entityType, entityId, 'click');
  }, [entityType, entityId]);

  return { ref, trackClick };
}
