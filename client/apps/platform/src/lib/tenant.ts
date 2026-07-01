/**
 * Server-side tenant resolution for the platform storefront.
 *
 * Reads the `x-tenant-slug` header (set by middleware.ts) and fetches
 * tenant data from the backend. Used by Server Components to determine
 * whether the current request is for a tenant storefront or the main
 * marketplace.
 *
 * Usage in a Server Component:
 *   import { resolveTenant } from '@/lib/tenant';
 *   const { tenant, isMainSite } = await resolveTenant();
 *   if (!isMainSite) { /* render tenant storefront *\/ }
 */

import { headers } from 'next/headers';
import { API_URL } from './api';
import type { TenantData } from '@/context/TenantContext';

interface TenantResolution {
  tenant: TenantData | null;
  isMainSite: boolean;
  tenantSlug: string | null;
}

/**
 * Resolve the current tenant from the request headers.
 * On the server only — do not call from client components.
 */
export async function resolveTenant(): Promise<TenantResolution> {
  const headersList = await headers();
  const tenantSlug = headersList.get('x-tenant-slug');

  if (!tenantSlug) {
    return { tenant: null, isMainSite: true, tenantSlug: null };
  }

  try {
    const res = await fetch(`${API_URL}/api/tenants/slug/${tenantSlug}`, {
      next: { revalidate: 300 }, // cache for 5 minutes
    });

    if (!res.ok) {
      return { tenant: null, isMainSite: true, tenantSlug };
    }

    const data = await res.json();
    const tenant = data?.data?.tenant as TenantData | undefined;

    if (!tenant) {
      return { tenant: null, isMainSite: true, tenantSlug };
    }

    return {
      tenant,
      isMainSite: false,
      tenantSlug: tenant.slug,
    };
  } catch {
    // Network error or backend unavailable — treat as main site
    return { tenant: null, isMainSite: true, tenantSlug };
  }
}

/**
 * Build API headers including the tenant slug if available.
 * Use when making authenticated API calls from Server Components.
 */
export async function buildTenantHeaders(): Promise<Record<string, string>> {
  const headersList = await headers();
  const tenantSlug = headersList.get('x-tenant-slug');
  const isTenantSite = headersList.get('x-is-tenant-site');

  const result: Record<string, string> = {};
  if (tenantSlug) result['x-tenant-slug'] = tenantSlug;
  if (isTenantSite) result['x-is-tenant-site'] = isTenantSite;
  return result;
}