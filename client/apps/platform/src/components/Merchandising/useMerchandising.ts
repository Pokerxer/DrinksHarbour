// client/apps/platform/src/components/Merchandising/useMerchandising.ts
'use client';

import { useEffect, useRef, useState } from 'react';
import { useTenant } from '@/context/TenantContext';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export interface MerchandisingProduct {
  _id: string;
  name: string;
  slug: string;
  type?: string;
  abv?: number;
  images?: { url: string }[];
  price?: number;                       // tenant storefront retail price
  priceRange?: { min: number; max: number };
  averageSellingPrice?: number;
  tenantCount?: number;
  source?: string;
  /** Present on paid placements (source === 'sponsored') — drives the CPC click. */
  adCampaignId?: string;
}

export interface MerchandisingData {
  productId: string;
  context: string;
  boughtTogether: MerchandisingProduct[];
  crossSells: MerchandisingProduct[];
  upSells: MerchandisingProduct[];
}

export type MerchandisingContext = 'pdp' | 'cart';

// ─── Sponsored-placement click attribution (Task 10) ─────────────────────────
// Clicks go through the dedicated ads endpoint (Task 9), never a generic
// handler. The visitor key is a stable localStorage uuid — not identity, just
// the dedupe key the click pipeline expects (docs: adClick.service.js).

const AD_VISITOR_KEY = 'dh_ad_visitor';

const adVisitorKey = (): string => {
  try {
    const existing = window.localStorage.getItem(AD_VISITOR_KEY);
    if (existing) return existing;
    const uuid =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `vh-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(AD_VISITOR_KEY, uuid);
    return uuid;
  } catch {
    return ''; // storage blocked — attribution is best-effort, never required
  }
};

/**
 * Fires the CPC click endpoint for a sponsored card. Fire-and-forget: a
 * failed attribution call must never break quick-add or navigation.
 */
export function fireSponsoredClick(campaignId?: string | null): void {
  if (!campaignId) return;
  const visitorKey = adVisitorKey();
  if (!visitorKey) return;
  try {
    void fetch(`${API_BASE}/api/ads/clicks/${campaignId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitorKey }),
    }).catch(() => {}); // ignore failures — billing happens server-side anyway
  } catch {
    /* attribution must never break the UI */
  }
}

/** Display price precedence: tenant retail → range floor → platform average. */
export const cardPrice = (p: MerchandisingProduct): number | null => {
  if (typeof p.price === 'number') return p.price;
  if (typeof p.priceRange?.min === 'number') return p.priceRange.min;
  if (typeof p.averageSellingPrice === 'number') return p.averageSellingPrice;
  return null;
};

/**
 * Fetches the batched merchandising endpoint. Non-blocking: a failure or
 * empty payload surfaces as `data === null` and the UI section hides itself.
 */
export function useMerchandising(
  productId?: string,
  context: MerchandisingContext = 'pdp'
) {
  const { tenantSlug } = useTenant();
  const [data, setData] = useState<MerchandisingData | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!productId) {
      setData(null);
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const params = new URLSearchParams({ context });
    setLoading(true);
    fetch(`${API_BASE}/api/products/${productId}/merchandising?${params.toString()}`, {
      signal: controller.signal,
      headers: {
        // DRI-9 storefront flags — mirrors what platform middleware.ts injects
        // for same-origin traffic; sent explicitly because the API base may be
        // cross-origin. Public published-catalog data only.
        'x-is-tenant-site': tenantSlug ? 'true' : 'false',
        ...(tenantSlug ? { 'x-tenant-slug': tenantSlug } : {}),
      },
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((json) => setData(json?.data ?? null))
      .catch(() => {
        if (!controller.signal.aborted) setData(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [productId, context, tenantSlug]);

  return { data, loading };
}
