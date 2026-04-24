// @ts-nocheck
import { routes } from '@/config/routes';
import PageHeader from '@/app/shared/page-header';
import CreateEditBanner from '@/app/shared/ecommerce/banner/create-edit';
import { metaObject } from '@/config/site.config';
import { use } from 'react';

export const metadata = {
  ...metaObject('Edit Banner'),
};

export default async function EditBannerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const pageHeader = {
    title: 'Edit Banner',
    breadcrumb: [
      {
        href: routes.eCommerce.dashboard,
        name: 'E-Commerce',
      },
      {
        href: routes.eCommerce.banners,
        name: 'Banners',
      },
      {
        name: 'Edit',
      },
    ],
  };

  return (
    <>
      <PageHeader title={pageHeader.title} breadcrumb={pageHeader.breadcrumb} />
      <CreateEditBanner bannerId={id} />
    </>
  );
}
