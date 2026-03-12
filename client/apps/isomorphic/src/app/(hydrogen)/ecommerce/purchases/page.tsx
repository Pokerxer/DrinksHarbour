// @ts-nocheck
import Link from 'next/link';
import { PiPlusBold } from 'react-icons/pi';
import { routes } from '@/config/routes';
import { Button } from 'rizzui/button';
import PageHeader from '@/app/shared/page-header';
import PurchaseOrdersTable from '@/app/shared/ecommerce/purchase-order/purchase-order-list/table';
import { metaObject } from '@/config/site.config';

export const metadata = {
  ...metaObject('Purchase Orders'),
};

const pageHeader = {
  title: 'Purchase Orders',
  breadcrumb: [
    {
      href: routes.eCommerce.dashboard,
      name: 'E-Commerce',
    },
    {
      href: routes.eCommerce.purchases,
      name: 'Purchase Orders',
    },
    {
      name: 'List',
    },
  ],
};

export default function PurchaseOrdersPage() {
  return (
    <>
      <PageHeader title={pageHeader.title} breadcrumb={pageHeader.breadcrumb}>
        <div className="mt-4 flex items-center gap-3 @lg:mt-0">
          <Link
            href={routes.eCommerce.createPurchase}
            className="w-full @lg:w-auto"
          >
            <Button as="span" className="w-full @lg:w-auto">
              <PiPlusBold className="me-1.5 h-[17px] w-[17px]" />
              New Purchase Order
            </Button>
          </Link>
        </div>
      </PageHeader>

      <div className="mt-6">
        <PurchaseOrdersTable pageSize={10} />
      </div>
    </>
  );
}
