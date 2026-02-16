// @ts-nocheck
import { routes } from '@/config/routes';
import PageHeader from '@/app/shared/page-header';
import SubProductDetails from '@/app/shared/ecommerce/sub-product/product-details';
import { metaObject } from '@/config/site.config';

export const metadata = {
  ...metaObject('Sub Product Details'),
};

export default async function SubProductDetailsPage({ params }: any) {
  const slug = (await params).slug;

  const pageHeader = {
    title: 'Sub Product Details',
    breadcrumb: [
      {
        href: routes.eCommerce.dashboard,
        name: 'E-Commerce',
      },
      {
        href: routes.eCommerce.subProducts,
        name: 'Sub Products',
      },
      {
        name: slug,
      },
    ],
  };

  return (
    <>
      <PageHeader title={pageHeader.title} breadcrumb={pageHeader.breadcrumb} />
      <SubProductDetails />
    </>
  );
}
