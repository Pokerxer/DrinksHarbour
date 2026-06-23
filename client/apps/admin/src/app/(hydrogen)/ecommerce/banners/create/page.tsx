// @ts-nocheck
import { routes } from '@/config/routes';
import PageHeader from '@/app/shared/page-header';
import CreateEditBanner from '@/app/shared/ecommerce/banner/create-edit';
import { metaObject } from '@/config/site.config';

export const metadata = {
  ...metaObject('Create Banner'),
};

const pageHeader = {
  title: 'Create Banner',
  breadcrumb: [
    { href: routes.eCommerce.dashboard, name: 'E-Commerce' },
    { href: routes.eCommerce.banners, name: 'Banners' },
    { name: 'Create' },
  ],
};

export default function CreateBannerPage() {
  return (
    <>
      <PageHeader title={pageHeader.title} breadcrumb={pageHeader.breadcrumb} />
      <CreateEditBanner />
    </>
  );
}
