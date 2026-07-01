// @ts-nocheck
import CreateTenant from '@/app/shared/ecommerce/tenant/create-tenant';
import PageHeader from '@/app/shared/page-header';
import { routes } from '@/config/routes';
import { metaObject } from '@/config/site.config';

export const metadata = {
  ...metaObject('Create Tenant'),
};

const pageHeader = {
  title: 'Create Tenant',
  breadcrumb: [
    { href: routes.eCommerce.dashboard, name: 'E-Commerce' },
    { href: routes.eCommerce.tenants, name: 'Tenants' },
    { name: 'Create' },
  ],
};

export default function CreateTenantPage() {
  return (
    <>
      <PageHeader title={pageHeader.title} breadcrumb={pageHeader.breadcrumb} />
      <CreateTenant isModalView={false} />
    </>
  );
}
