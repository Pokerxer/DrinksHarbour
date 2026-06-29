'use client';

import React, { createContext, useContext } from 'react';

export interface AdminTenantData {
  _id: string;
  name: string;
  slug: string;
  logo?: { url: string; alt?: string };
  primaryColor?: string;
  plan?: string;
  subscriptionStatus?: string;
  status?: string;
  defaultCurrency?: string;
  country?: string;
  address?: {
    street?: string;
    city?: string;
    lga?: string;
    state?: string;
    country?: string;
    formatted?: string;
  };
  phone?: string;
  email?: string;
}

interface TenantContextValue {
  tenant: AdminTenantData | null;
  isMainSite: boolean; // true when no subdomain (platform admin view)
  tenantSlug: string | null;
}

const TenantContext = createContext<TenantContextValue>({
  tenant: null,
  isMainSite: true,
  tenantSlug: null,
});

export const TenantProvider: React.FC<{
  children: React.ReactNode;
  initialTenant?: AdminTenantData | null;
}> = ({ children, initialTenant }) => {
  const tenant = initialTenant ?? null;
  return (
    <TenantContext.Provider
      value={{
        tenant,
        isMainSite: !tenant,
        tenantSlug: tenant?.slug ?? null,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = () => useContext(TenantContext);
export default TenantContext;
