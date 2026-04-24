"use client";

import React, { createContext, useContext } from "react";

interface Tenant {
  name: string;
  subdomain?: string;
  logo?: string;
  branding?: {
    primaryColor?: string;
    secondaryColor?: string;
  };
}

interface TenantContextValue {
  tenant: Tenant | null;
  isMainSite: boolean;
}

const TenantContext = createContext<TenantContextValue>({
  tenant: null,
  isMainSite: true,
});

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // This is the main DrinksHarbour storefront — always isMainSite: true
  return (
    <TenantContext.Provider value={{ tenant: null, isMainSite: true }}>
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = () => useContext(TenantContext);

export default TenantContext;
