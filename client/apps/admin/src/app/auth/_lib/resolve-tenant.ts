import { headers } from 'next/headers';
import type { AdminTenantData } from '@/context/TenantContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

// DrinksHarbour brand red — the same family used by the sign-in / POS lock screen.
export const BRAND_RED = '#b20202';

async function fetchTenantBySlug(
  slug: string
): Promise<AdminTenantData | null> {
  try {
    const res = await fetch(`${API_URL}/api/tenants/slug/${slug}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: { tenant?: AdminTenantData } };
    return json?.data?.tenant ?? null;
  } catch {
    return null;
  }
}

/**
 * Resolve the active tenant for a public auth page, mirroring the logic in
 * `app/signin/page.tsx`:
 *   1. `x-tenant-slug` header injected by middleware (subdomain visits)
 *   2. the `*.drinksharbour.com` host header (unauthenticated subdomain visits)
 *   3. local dev fallback via `?_tenant=acme`
 */
export async function resolveTenant(
  tenantParam?: string
): Promise<AdminTenantData | null> {
  const headersList = await headers();

  let tenantSlug: string | null = headersList.get('x-tenant-slug');

  if (!tenantSlug) {
    const host = (headersList.get('host') || '').split(':')[0];
    const match = host.match(/^([a-z0-9-]+)\.drinksharbour\.com$/i);
    if (match && !['admin', 'www'].includes(match[1])) {
      tenantSlug = match[1];
    }
  }

  if (!tenantSlug && tenantParam) {
    tenantSlug = tenantParam;
  }

  return tenantSlug ? fetchTenantBySlug(tenantSlug) : null;
}
