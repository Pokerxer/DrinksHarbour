import { metaObject } from '@/config/site.config';
import PageHeader from '@/app/shared/page-header';
import CreateEditPromotion from '@/app/shared/ecommerce/promotion/create-edit';
import { routes } from '@/config/routes';

export const metadata = {
  ...metaObject('Edit Promotion'),
};

const pageHeader = {
  title: 'Edit Promotion',
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
      name: 'Edit',
    },
  ],
};

export default async function EditPromotionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <>
      <PageHeader title={pageHeader.title} breadcrumb={pageHeader.breadcrumb} />
      <CreateEditPromotion id={id} />
    </>
  );
}
