// @ts-nocheck
import CreateBrand from '@/app/shared/ecommerce/brand/create-brand';
import PageHeader from '@/app/shared/page-header';
import { routes } from '@/config/routes';
import { metaObject } from '@/config/site.config';

export const metadata = {
  ...metaObject('Create Brand'),
};

const pageHeader = {
  title: 'Create Brand',
  breadcrumb: [
    { href: routes.eCommerce.dashboard, name: 'E-Commerce' },
    { href: routes.eCommerce.brands, name: 'Brands' },
    { name: 'Create' },
  ],
};

export default function CreateBrandPage() {
  return (
    <>
      <PageHeader title={pageHeader.title} breadcrumb={pageHeader.breadcrumb} />
      <CreateBrand isModalView={false} />
    </>
  );
}
