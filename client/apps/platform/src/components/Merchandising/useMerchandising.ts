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
}

export interface MerchandisingData {
  productId: string;
  context: string;
  boughtTogether: MerchandisingProduct[];
  crossSells: MerchandisingProduct[];
  upSells: MerchandisingProduct[];
}

export type MerchandisingContext = 'pdp' | 'cart';

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
