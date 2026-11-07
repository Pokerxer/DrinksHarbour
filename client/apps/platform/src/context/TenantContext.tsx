"use client";

import React, { createContext, useContext } from "react";

export interface TenantData {
  _id: string;
  name: string;
  slug: string;
  logo?: { url: string; alt?: string };
  primaryColor?: string;
  plan?: string;
  subscriptionStatus?: string;
  status?: string;
  isSystemTenant?: boolean;
  enforceAgeVerification?: boolean;
  contactEmail?: string;
  contactPhone?: string;
  country?: string;
  defaultCurrency?: string;
}

interface TenantContextValue {
  tenant: TenantData | null;
  isMainSite: boolean;
  tenantSlug: string | null;
}

const TenantContext = createContext<TenantContextValue>({
  tenant: null,
  isMainSite: true,
  tenantSlug: null,
});

export const TenantProvider: React.FC<{
  children: React.ReactNode;
  initialTenant?: TenantData | null;
}> = ({ children, initialTenant }) => {
  const tenant = initialTenant ?? null;
  const isMainSite = !tenant;
  const tenantSlug = tenant?.slug ?? null;

  return (
    <TenantContext.Provider value={{ tenant, isMainSite, tenantSlug }}>
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = () => useContext(TenantContext);

/**
 * DRI-9: hostname→tenant-site rule, mirroring middleware.ts extractTenantSlug
 * verbatim. Client-side escape hatch for providers (e.g. CompareProvider)
 * that sit OUTSIDE the layout's tenant-aware TenantProvider and therefore
 * cannot see its context — the provider chain in app/GlobalProvider.tsx wraps
 * a tenant-default TenantProvider outermost, so useTenant() there always
 * reports the main site. SSR callers must not rely on this — no `headers()`
 * here, direct imports from client code only (window access stays in the
 * caller).
 */
export function isTenantHost(hostname: string): boolean {
  const RESERVED_SUBDOMAINS = ['www', 'drinksharbour', 'admin', 'platform', 'api', 'localhost', '127'];
  const host = hostname.split(':')[0].toLowerCase();
  if (RESERVED_SUBDOMAINS.some((r) => host === r || host.startsWith(`${r}.`))) return false;
  const match = host.match(/^([a-z0-9-]+)\.(?:drinksharbour\.com|localhost)$/);
  return !!(match && !RESERVED_SUBDOMAINS.includes(match[1]));
}

export default TenantContext;
