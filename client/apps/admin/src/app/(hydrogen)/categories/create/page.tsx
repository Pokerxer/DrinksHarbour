// @ts-nocheck
import CreateCategoryClient from './create-category-client';
import PageHeader from '@/app/shared/page-header';
import EcommercePageHeader from '@/app/shared/ecommerce/ecommerce-page-header';
import { routes } from '@/config/routes';
import { metaObject } from '@/config/site.config';

export const metadata = {
  ...metaObject('Create Category'),
};

const pageHeader = {
  title: 'Create Category',
  breadcrumb: [
    { href: routes.eCommerce.dashboard, name: 'E-Commerce' },
    { href: routes.eCommerce.categories, name: 'Categories' },
    { name: 'Create' },
  ],
};

export default function CreateCategoryPage() {
  return (
    <>
      <EcommercePageHeader hideHero />
      <div className="mt-4">
        <PageHeader
          title={pageHeader.title}
          breadcrumb={pageHeader.breadcrumb}
        />
        <CreateCategoryClient />
      </div>
    </>
  );
}