// @ts-nocheck
'use client';

/**
 * POS-style navigation header for the Banners module.
 * Mirrors pos-nav-header.tsx: launcher slot, logo + brand block, flat tabs
 * with the red active underline. No dropdowns — Banners is a flat section.
 */

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { PiGaugeDuotone, PiPlusCircleDuotone, PiChartLineUpDuotone } from 'react-icons/pi';
import { routes } from '@/config/routes';
import { LauncherButton } from '@/layouts/hydrogen/app-launcher';

const TABS = [
  { label: 'Banners', href: routes.eCommerce.banners, icon: <PiGaugeDuotone /> },
  {
    label: 'Create',
    href: routes.eCommerce.createBanner,
    icon: <PiPlusCircleDuotone />,
  },
  {
    label: 'Analytics',
    href: routes.eCommerce.bannerAnalytics,
    icon: <PiChartLineUpDuotone />,
  },
];

export default function BannerNavHeader() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === routes.eCommerce.banners)
      // list, create & detail routes are all "Banners"; analytics is its own tab
      return (
        pathname === href ||
        (/^\/banners\/[^/]+$/.test(pathname || '') &&
          !pathname?.startsWith(routes.eCommerce.bannerAnalytics))
      );
    if (href === routes.eCommerce.bannerAnalytics)
      return pathname?.startsWith(routes.eCommerce.bannerAnalytics);
    return pathname?.startsWith(href.replace(/\/create$/, '')) && pathname?.includes('/create');
  };

  return (
    <nav className="relative flex flex-wrap items-center border-b border-gray-200 bg-white">
      {/* App launcher toggle */}
      <LauncherButton className="me-1 ms-3 shadow-none" />

      {/* Brand */}
      <Link
        href={routes.eCommerce.banners}
        className="flex shrink-0 items-center gap-2.5 border-r border-gray-200 py-2 pr-5"
      >
        <Image
          src="/logo-short.svg"
          alt="DrinksHarbour"
          width={30}
          height={30}
          className="rounded-full"
        />
        <span className="hidden min-[480px]:inline text-sm font-semibold text-gray-900">Banners</span>
      </Link>

      {/* Tabs */}
      <div className="flex min-w-0 flex-1 flex-wrap items-center pl-2">
        {TABS.map((tab) => {
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
              <span className="[&>svg]:h-[18px] [&>svg]:w-[18px]">{tab.icon}</span>
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
