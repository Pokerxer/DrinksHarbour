'use client';

/**
 * Navigation header for the Advertising module.
 * Composes the shared ModuleNavHeader — same chrome as the Merchandising
 * module: launcher, logo + brand block, flat tabs with the red active
 * underline.
 */

import { PiMegaphoneDuotone, PiPlusCircleDuotone } from 'react-icons/pi';
import { routes } from '@/config/routes';
import ModuleNavHeader, { type ModuleNavItem } from '@/app/shared/module-nav-header';

const TABS: ModuleNavItem[] = [
  { label: 'Campaigns', href: routes.eCommerce.advertising, icon: <PiMegaphoneDuotone /> },
  {
    label: 'New campaign',
    href: routes.eCommerce.createCampaign,
    icon: <PiPlusCircleDuotone />,
  },
];

export default function AdsNavHeader() {
  return (
    <ModuleNavHeader
      brand="Advertising"
      brandHref={routes.eCommerce.advertising}
      tabs={TABS}
    />
  );
}
