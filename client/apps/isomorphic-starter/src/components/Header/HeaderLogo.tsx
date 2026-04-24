"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";

interface Tenant {
  name: string;
  subdomain?: string;
  logo?: string;
  branding?: {
    primaryColor?: string;
    secondaryColor?: string;
  };
}

interface HeaderLogoProps {
  tenant?: Tenant;
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

  const tenantLogo = !isMainSite && tenant?.logo;

  return (
    <Link href="/" className="flex items-center">
      {tenantLogo ? (
        <Image
          src={tenantLogo}
          alt={displayName}
          width={160}
          height={48}
          className="h-10 md:h-12 w-auto object-contain"
          priority
        />
      ) : (
        <Image
          src="/images/logo.png"
          alt="DrinksHarbour"
          width={180}
          height={54}
          className={`h-10 md:h-12 w-auto object-contain transition-all duration-300 ${
            variant === "transparent" && !isScrolled ? "brightness-0 invert" : ""
          }`}
          priority
        />
      )}
    </Link>
  );
};
