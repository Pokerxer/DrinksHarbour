// @ts-nocheck
import { routes } from '@/config/routes';
import SubCategoryTable from '@/app/shared/ecommerce/subcategory/subcategory-list/table';
import SubCategoryPageHeader from './category-page-header';
import EcommercePageHeader from '@/app/shared/ecommerce/ecommerce-page-header';
import { metaObject } from '@/config/site.config';

export const metadata = {
  ...metaObject('SubCategories'),
};

const pageHeader = {
  title: 'SubCategories',
  breadcrumb: [
    {
      href: routes.eCommerce.dashboard,
      name: 'E-Commerce',
    },
    {
      href: routes.eCommerce.subCategories,
      name: 'SubCategories',
    },
    {
      name: 'List',
    },
  ],
};

export default function SubCategoriesPage() {
  return (
    <>
      <EcommercePageHeader hideHero />
      <div className="mt-4">
        <SubCategoryPageHeader
          title={pageHeader.title}
          breadcrumb={pageHeader.breadcrumb}
        />
        <SubCategoryTable />
      </div>
    </>
  );
}
