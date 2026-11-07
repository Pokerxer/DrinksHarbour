import ModuleNavHeader from '@/app/shared/module-nav-header';
import {
  PiSquaresFourDuotone,
  PiCashRegisterDuotone,
  PiChartBarDuotone,
} from 'react-icons/pi';
import { routes } from '@/config/routes';

/**
 * POS-style module chrome: nav header + content canvas. Responsive rules
 * (label hiding / wrapping) live in ModuleNavHeader.
 *
 * The price-checker dir already has a layout.tsx that only imports CSS (it
 * adds no chrome), and no page in this group rendered an equivalent module
 * nav before — the tools home and price-checker screens are bare content.
 * This layout is the missing app-level chrome; the nested
 * price-checker/layout.tsx stays as-is because module chrome inherits down.
 *
 * /retail-tools sits behind the tenant-admin/manager route gate (route-roles
 * MANAGER_PATHS); the header renders the group destinations only.
 */
const TOOLS_HOME_HREF = routes.retailTools;

export default function RetailToolsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="-mx-4 -mt-2 flex flex-col md:-mx-5 lg:-mx-6 3xl:-mx-8">
      <div className="px-4 md:px-5 lg:px-6 3xl:px-8">
        <ModuleNavHeader
          brand="Retail tools"
          brandHref={TOOLS_HOME_HREF}
          tabs={[
            {
              label: 'Tools home',
              href: TOOLS_HOME_HREF,
              icon: <PiSquaresFourDuotone />,
            },
            {
              label: 'Kiosks',
              href: routes.priceChecker.list,
              icon: <PiCashRegisterDuotone />,
            },
            {
              label: 'Scan analytics',
              href: routes.priceChecker.analytics,
              icon: <PiChartBarDuotone />,
            },
          ]}
        />
      </div>
      <div className="flex-1 px-4 pb-10 pt-6 md:px-10 lg:px-14">{children}</div>
    </div>
  );
}
