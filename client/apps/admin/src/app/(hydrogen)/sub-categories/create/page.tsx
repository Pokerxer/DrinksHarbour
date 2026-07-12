// @ts-nocheck
import CreateSubCategory from '@/app/shared/ecommerce/subcategory/create-subcategory';
import PageHeader from '@/app/shared/page-header';
import EcommercePageHeader from '@/app/shared/ecommerce/ecommerce-page-header';
import { routes } from '@/config/routes';
import { metaObject } from '@/config/site.config';

export const metadata = {
  ...metaObject('Create SubCategory'),
};

const pageHeader = {
  title: 'Create SubCategory',
  breadcrumb: [
    { href: routes.eCommerce.dashboard, name: 'E-Commerce' },
    { href: routes.eCommerce.subCategories, name: 'SubCategories' },
    { name: 'Create' },
  ],
};

export default function CreateSubCategoryPage() {
  return (
    <>
      <EcommercePageHeader hideHero />
      <div className="mt-4">
        <PageHeader
          title={pageHeader.title}
          breadcrumb={pageHeader.breadcrumb}
        />
        <CreateSubCategory isModalView={false} />
      </div>
    </>
  );
}
