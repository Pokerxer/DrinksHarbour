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

export default TenantContext;
