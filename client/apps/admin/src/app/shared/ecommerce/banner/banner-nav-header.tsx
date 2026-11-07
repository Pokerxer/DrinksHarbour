// @ts-nocheck
'use client';

/**
 * Navigation header for the Banners module.
 * Composes the shared ModuleNavHeader so Banners gets the same chrome as
 * /point-of-sale and every other module: launcher, logo + brand block, flat
 * tabs with the red active underline, and the sub-`md` Menu button that opens
 * every destination (previously the tabs only wrapped — no mobile menu).
 * No dropdowns — Banners is a flat section.
 */

import { PiGaugeDuotone, PiPlusCircleDuotone, PiChartLineUpDuotone } from 'react-icons/pi';
import { routes } from '@/config/routes';
import ModuleNavHeader, { type ModuleNavItem } from '@/app/shared/module-nav-header';

const TABS: ModuleNavItem[] = [
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
  return (
    <ModuleNavHeader
      brand="Banners"
      brandHref={routes.eCommerce.banners}
      tabs={TABS}
    />
  );
}
