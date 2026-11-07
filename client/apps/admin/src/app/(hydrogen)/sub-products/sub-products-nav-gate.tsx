'use client';

/**
 * Chooses the module chrome for /sub-products/*:
 * - ?from=pos leaves the header to the page, which renders the full
 *   POSNavHeader (the POS module's own tabs) — prevents double headers.
 * - otherwise renders ModuleNavHeader with every destination of the module,
 *   so list, create, detail and edit pages all share the POS-style chrome.
 *
 * useSearchParams needs a Suspense boundary above it (CSR bailout rule).
 */

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import ModuleNavHeader from '@/app/shared/module-nav-header';
import { routes } from '@/config/routes';
import { PiPackageDuotone, PiPlusCircleDuotone } from 'react-icons/pi';

const TABS = [
  {
    label: 'My Sub-Products',
    href: routes.eCommerce.subProducts,
    icon: <PiPackageDuotone />,
  },
  {
    label: 'Add Sub-Product',
    href: routes.eCommerce.createSubProduct,
    icon: <PiPlusCircleDuotone />,
  },
];

function SubProductsNavHeader() {
  const searchParams = useSearchParams();
  if (searchParams.get('from') === 'pos') return null;
  return (
    <ModuleNavHeader
      brand="Sub-Products"
      brandHref={routes.eCommerce.subProducts}
      tabs={TABS}
    />
  );
}

export default function SubProductsNavGate() {
  return (
    <Suspense fallback={null}>
      <SubProductsNavHeader />
    </Suspense>
  );
}
