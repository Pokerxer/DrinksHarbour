// @ts-nocheck
import CreateCategory from '@/app/shared/ecommerce/category/create-category';
import PageHeader from '@/app/shared/page-header';
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
      <PageHeader title={pageHeader.title} breadcrumb={pageHeader.breadcrumb} />
      <CreateCategory isModalView={false} />
    </>
  );
}
