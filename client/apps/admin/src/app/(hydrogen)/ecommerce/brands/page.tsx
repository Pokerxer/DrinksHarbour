// @ts-nocheck
import { routes } from '@/config/routes';
import BrandTable from '@/app/shared/ecommerce/brand/brand-list/table';
import BrandPageHeader from './brand-page-header';
import { metaObject } from '@/config/site.config';

export const metadata = {
  ...metaObject('Brands'),
};

const pageHeader = {
  title: 'Brands',
  breadcrumb: [
    {
      href: routes.eCommerce.dashboard,
      name: 'E-Commerce',
    },
    {
      href: routes.eCommerce.brands,
      name: 'Brands',
    },
    {
      name: 'List',
    },
  ],
};

export default function BrandsPage() {
  return (
    <>
      <BrandPageHeader
        title={pageHeader.title}
        breadcrumb={pageHeader.breadcrumb}
      />
      <BrandTable />
    </>
  );
}
