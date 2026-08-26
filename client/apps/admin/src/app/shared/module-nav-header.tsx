// @ts-nocheck
'use client';

/**
 * Generic POS-style navigation header for modules that had none.
 *
 * Same chrome as pos-nav-header/catalog-nav-header: app launcher, logo +
 * brand block, flat tabs with the red active underline.
 *
 * Responsive behaviour (shared rules across ALL module headers):
 * - brand text hides below ~480px (logo stays)
 * - tab labels hide below md (icons stay)
 * - the tab strip wraps onto extra rows instead of clipping
 */

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { LauncherButton } from '@/layouts/hydrogen/app-launcher';

export interface ModuleNavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

export default function ModuleNavHeader({
  brand,
  brandHref,
  tabs,
}: {
  brand: string;
  brandHref?: string;
  tabs: ModuleNavItem[];
}) {
  const pathname = usePathname();
  const home = brandHref ?? tabs[0]?.href ?? '/';

  const isActive = (href: string) =>
    pathname === href || pathname?.startsWith(`${href}/`);

  return (
    <nav className="relative mb-0 flex flex-wrap items-center border-b border-gray-200 bg-white">
      {/* App launcher toggle */}
      <LauncherButton className="me-1 ms-3 shadow-none" />

      {/* Brand */}
      <Link
        href={home}
        className="flex shrink-0 items-center gap-2.5 border-r border-gray-200 py-2 pr-5"
      >
        <Image
          src="/logo-short.svg"
          alt="DrinksHarbour"
          width={30}
          height={30}
          className="rounded-full"
        />
        <span className="hidden min-[480px]:inline text-sm font-semibold text-gray-900">
          {brand}
        </span>
      </Link>

      {/* Tabs — wrap on narrow screens, never clip */}
      <div className="flex min-w-0 flex-1 flex-wrap items-center pl-2">
        {tabs.map((tab) => {
          const active = isActive(tab.href);
          return (
            <Link
              key={tab.label}
              href={tab.href}
              className={`relative flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-3 text-sm transition-colors md:px-4 ${
                active
                  ? 'font-semibold text-[#b20202] after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:bg-[#b20202]'
                  : 'font-normal text-gray-600 hover:text-gray-900'
              }`}
            >
              <span className="[&>svg]:h-[18px] [&>svg]:w-[18px]">
                {tab.icon}
              </span>
              <span className="hidden md:inline">{tab.label}</span>
              <span className="md:hidden">{active ? tab.label : ''}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
