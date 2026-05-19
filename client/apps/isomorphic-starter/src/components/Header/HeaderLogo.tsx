"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { TenantData } from "@/context/TenantContext";

interface HeaderLogoProps {
  tenant?: TenantData | null;
  isMainSite: boolean;
  variant: "default" | "transparent" | "dark";
  isScrolled: boolean;
}

export const HeaderLogo: React.FC<HeaderLogoProps> = ({
  tenant,
  isMainSite,
  variant,
  isScrolled,
}) => {
  const displayName = isMainSite
    ? "DrinksHarbour"
    : tenant?.name || "DrinksHarbour";

  const tenantLogoUrl = !isMainSite && tenant?.logo?.url ? tenant.logo.url : null;
  const tenantLogoAlt = tenant?.logo?.alt || displayName;

  return (
    <Link href="/" className="flex items-center">
      {tenantLogoUrl ? (
        <Image
          src={tenantLogoUrl}
          alt={tenantLogoAlt}
          width={160}
          height={48}
          className="h-10 md:h-12 w-auto object-contain"
          priority
        />
      ) : (
        <Image
          src="/images/logo.svg"
          alt="DrinksHarbour"
          width={440}
          height={63}
          className="h-10 md:h-12 w-auto object-contain"
          priority
        />
      )}
    </Link>
  );
};
