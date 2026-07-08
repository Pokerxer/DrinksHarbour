'use client';

import { usePathname } from 'next/navigation';
import { routes } from '@/config/routes';
import EcommerceNavHeader from '@/app/shared/ecommerce/ecommerce-nav-header';
import EcommerceHero from '@/app/shared/ecommerce/ecommerce-hero';

/**
 * Shared chrome for every /ecommerce/* route: the POS-style nav bar plus the
 * brand-red hero strip. Mirrors the /employees and /warehouses layouts.
 *
 * The negative margins break out of the (hydrogen) content padding so the nav
 * bar and the full-bleed hero reach the container edges; the inner wrapper
 * restores horizontal padding for the nav itself.
 *
 * The hero is suppressed on dashboard routes (/ecommerce and /) because those
 * pages render their own hero inside the DashboardProvider so it can access
 * today's sales stats. On every other ecommerce route the hero renders here
 * and gracefully shows only the brand block + date (no DashboardContext).
 */
const DASHBOARD_PATHS = [routes.eCommerce.dashboard, '/'];

export default function EcommercePageHeader({
  hideHero = false,
}: {
  hideHero?: boolean;
}) {
  const pathname = usePathname();
  const isDashboard = DASHBOARD_PATHS.includes(pathname);

  return (
    <div className="-mx-4 -mt-2 flex flex-col md:-mx-5 lg:-mx-6 3xl:-mx-8 4xl:-mx-10">
      <div className="px-4 md:px-5 lg:px-6 3xl:px-8 4xl:px-10">
        <EcommerceNavHeader />
      </div>
      {isDashboard || hideHero ? null : <EcommerceHero />}
    </div>
  );
}
