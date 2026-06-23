// @ts-nocheck
import { routes } from '@/config/routes';
import TenantTable from '@/app/shared/ecommerce/tenant/tenant-list/table';
import TenantPageHeader from './tenant-page-header';
import { metaObject } from '@/config/site.config';

export const metadata = {
  ...metaObject('Tenants'),
};

const pageHeader = {
  title: 'Tenants',
  breadcrumb: [
    {
      href: routes.eCommerce.dashboard,
      name: 'E-Commerce',
    },
    {
      href: routes.eCommerce.tenants,
      name: 'Tenants',
    },
    {
      name: 'List',
    },
  ],
};

export default function TenantsPage() {
  return (
    <>
      <TenantPageHeader
        title={pageHeader.title}
        breadcrumb={pageHeader.breadcrumb}
      />
      <TenantTable />
    </>
  );
}
