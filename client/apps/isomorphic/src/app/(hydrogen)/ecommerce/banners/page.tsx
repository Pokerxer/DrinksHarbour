// @ts-nocheck
import Link from 'next/link';
import { PiPlusBold } from 'react-icons/pi';
import { routes } from '@/config/routes';
import { Button } from 'rizzui/button';
import PageHeader from '@/app/shared/page-header';
import BannersTable from '@/app/shared/ecommerce/banner/banner-list/table';
import { metaObject } from '@/config/site.config';

export const metadata = {
  ...metaObject('Banners'),
};

const pageHeader = {
  title: 'Banners',
  breadcrumb: [
    {
      href: routes.eCommerce.dashboard,
      name: 'E-Commerce',
    },
    {
      name: 'Banners',
    },
    {
      name: 'List',
    },
  ],
};

export default function BannersPage() {
  return (
    <>
      <PageHeader title={pageHeader.title} breadcrumb={pageHeader.breadcrumb}>
        <div className="mt-4 flex items-center gap-3 @lg:mt-0">
          <Link href={routes.eCommerce.createBanner} className="w-full @lg:w-auto">
            <Button as="span" className="w-full @lg:w-auto">
              <PiPlusBold className="me-1.5 h-[17px] w-[17px]" />
              Add Banner
            </Button>
          </Link>
        </div>
      </PageHeader>

      <BannersTable pageSize={20} />
    </>
  );
}
