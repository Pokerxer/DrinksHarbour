'use client';

/**
 * Notifications module chrome: permission-filtered tabs inside the shared
 * ModuleNavHeader (same responsive rules as every other POS-style module
 * header — brand text hides below 480px, single Menu button below md, tab
 * strip wraps at md+). The gated tab filtering (notification-pages config)
 * is preserved so a user never sees a tab their role/plan can't open.
 */

import { useSession } from 'next-auth/react';
import {
  notificationPages,
  canOpenNotificationPage,
} from '@/config/notification-pages';
import { useEffectivePermissions } from '@/hooks/use-effective-permissions';
import ModuleNavHeader from '@/app/shared/module-nav-header';
import {
  PiTrayDuotone,
  PiPackageDuotone,
  PiWarehouseDuotone,
  PiChartLineUpDuotone,
  PiChartBarDuotone,
  PiShoppingCartDuotone,
  PiInvoiceDuotone,
  PiTagDuotone,
  PiMegaphoneDuotone,
  PiCalendarDuotone,
} from 'react-icons/pi';

const PAGE_ICONS: Record<string, React.ReactNode> = {
  '/notifications': <PiTrayDuotone />,
  '/notifications/stock': <PiPackageDuotone />,
  '/notifications/warehouses': <PiWarehouseDuotone />,
  '/notifications/performance': <PiChartLineUpDuotone />,
  '/notifications/forecasts': <PiChartBarDuotone />,
  '/notifications/restock': <PiShoppingCartDuotone />,
  '/notifications/vendor-orders': <PiInvoiceDuotone />,
  '/notifications/products': <PiTagDuotone />,
  '/notifications/promotions': <PiMegaphoneDuotone />,
  '/notifications/expiry': <PiCalendarDuotone />,
};

export default function NotificationsSectionNav() {
  const { data: session } = useSession();
  const permissions = useEffectivePermissions(session?.user?.token);

  const tabs = notificationPages
    .filter((p) =>
      canOpenNotificationPage(
        p.href,
        session?.user?.role,
        permissions?.customPermissions || []
      )
    )
    .map((p) => ({
      label: p.label,
      href: p.href,
      icon: PAGE_ICONS[p.href] ?? <PiTrayDuotone />,
    }));

  return (
    <ModuleNavHeader brand="Notifications" brandHref="/notifications" tabs={tabs} />
  );
}
