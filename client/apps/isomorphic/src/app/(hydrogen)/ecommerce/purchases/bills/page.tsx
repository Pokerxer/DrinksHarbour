// @ts-nocheck
import Link from 'next/link';
import { PiPlusBold } from 'react-icons/pi';
import { routes } from '@/config/routes';
import { Button } from 'rizzui/button';
import PageHeader from '@/app/shared/page-header';
import VendorBillsTable from '@/app/shared/ecommerce/purchase-order/vendor-bills-list/table';
import { metaObject } from '@/config/site.config';

export const metadata = {
  ...metaObject('Vendor Bills'),
};

const pageHeader = {
  title: 'Vendor Bills',
  breadcrumb: [
    {
      href: routes.eCommerce.dashboard,
      name: 'E-Commerce',
    },
    {
      href: routes.eCommerce.purchases,
      name: 'Purchases',
    },
    {
      name: 'Bills',
    },
  ],
};

export default function VendorBillsPage() {
  return (
    <>
      <PageHeader title={pageHeader.title} breadcrumb={pageHeader.breadcrumb}>
        <div className="mt-4 flex items-center gap-3 @lg:mt-0">
          <Link
            href={routes.eCommerce.createVendorBill}
            className="w-full @lg:w-auto"
          >
            <Button as="span" className="w-full @lg:w-auto">
              <PiPlusBold className="me-1.5 h-[17px] w-[17px]" />
              New Vendor Bill
            </Button>
          </Link>
        </div>
      </PageHeader>

      <div className="mt-6">
        <VendorBillsTable pageSize={10} />
      </div>
    </>
  );
}
