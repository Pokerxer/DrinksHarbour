import { metaObject } from '@/config/site.config';
import PageHeader from '@/app/shared/page-header';
import CreateEditPromotion from '@/app/shared/ecommerce/promotion/create-edit';
import { routes } from '@/config/routes';

export const metadata = {
  ...metaObject('Create Promotion'),
};

const pageHeader = {
  title: 'Create A Promotion',
  breadcrumb: [
    {
      href: routes.eCommerce.dashboard,
      name: 'E-Commerce',
    },
    {
      href: routes.eCommerce.promotions,
      name: 'Promotions',
    },
    {
      name: 'Create',
    },
  ],
};

export default function CreatePromotionPage() {
  return (
    <>
      <PageHeader title={pageHeader.title} breadcrumb={pageHeader.breadcrumb} />
      <CreateEditPromotion />
    </>
  );
}
