'use client';

/**
 * Navigation header for the Merchandising module.
 * Composes the shared ModuleNavHeader — same chrome as the Banners module:
 * launcher, logo + brand block, flat tabs with the red active underline.
 */

import { PiPathDuotone, PiPlusCircleDuotone } from 'react-icons/pi';
import { routes } from '@/config/routes';
import ModuleNavHeader, { type ModuleNavItem } from '@/app/shared/module-nav-header';

const TABS: ModuleNavItem[] = [
  { label: 'Pairings', href: routes.eCommerce.merchandising, icon: <PiPathDuotone /> },
  {
    label: 'New pairing',
    href: routes.eCommerce.createPairing,
    icon: <PiPlusCircleDuotone />,
  },
];

export default function MerchandisingNavHeader() {
  return (
    <ModuleNavHeader
      brand="Merchandising"
      brandHref={routes.eCommerce.merchandising}
      tabs={TABS}
    />
  );
}
