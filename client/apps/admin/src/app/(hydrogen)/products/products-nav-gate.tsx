'use client';

/**
 * Chooses the module chrome tabs for /products/*:
 * - "All Products" and "Add Product" for every role the server lets reach the
 *   route group at all.
 * - "Pending Approvals" (/products/pending) only for super_admin, mirroring
 *   roleCanAccessRoute so the nav never offers a link the route gate or the
 *   server would refuse (same rule as app-launcher and the sidebar).
 *
 * useSearchParams needs a Suspense boundary above it (CSR bailout rule).
 */

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import ModuleNavHeader from '@/app/shared/module-nav-header';
import { routes } from '@/config/routes';
import { roleCanAccessRoute } from '@/config/route-roles';
import { checkPlanAccess } from '@/config/plan-capabilities';
import {
  PiListBulletsDuotone,
  PiHourglassMediumDuotone,
  PiPlusCircleDuotone,
} from 'react-icons/pi';

const TABS = [
  {
    label: 'All Products',
    href: routes.eCommerce.products,
    icon: <PiListBulletsDuotone />,
  },
  {
    label: 'Pending Approvals',
    href: routes.eCommerce.pendingProducts,
    icon: <PiHourglassMediumDuotone />,
  },
  {
    label: 'Add Product',
    href: routes.eCommerce.createProduct,
    icon: <PiPlusCircleDuotone />,
  },
];

function ProductsNavHeader() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  // Hooks stay unconditional; the POS page 'from' branch only drops chrome.
  if (searchParams.get('from') === 'pos') return null;

  const user = session?.user as
    | { role?: string; plan?: string | null }
    | undefined;
  const role = user?.role;
  const plan = user?.plan ?? undefined;
  const tabs = TABS.filter(
    (tab) =>
      roleCanAccessRoute(tab.href, role) &&
      checkPlanAccess({ path: tab.href, role, plan }).allowed
  );

  return (
    <ModuleNavHeader
      brand="Products"
      brandHref={routes.eCommerce.products}
      tabs={tabs}
    />
  );
}

export default function ProductsNavGate() {
  return (
    <Suspense fallback={null}>
      <ProductsNavHeader />
    </Suspense>
  );
}
