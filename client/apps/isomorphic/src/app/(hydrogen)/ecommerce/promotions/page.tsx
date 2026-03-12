import { metaObject } from '@/config/site.config';
import PageHeader from '@/app/shared/page-header';
import { routes } from '@/config/routes';
import PromotionListTable from '@/app/shared/ecommerce/promotion/promotion-list/table';
import PromotionHeaderAction from '@/app/shared/ecommerce/promotion/promotion-list/header-action';

export const metadata = {
  ...metaObject('Promotions'),
};

const pageHeader = {
  title: 'Promotions',
  breadcrumb: [
    {
      href: routes.eCommerce.dashboard,
      name: 'E-Commerce',
    },
    {
      name: 'Promotions',
    },
  ],
};

export default function PromotionsPage() {
  return (
    <>
      <PageHeader title={pageHeader.title} breadcrumb={pageHeader.breadcrumb}>
        <div className="mt-4 flex items-center gap-3 @lg:mt-0">
          <PromotionHeaderAction />
        </div>
      </PageHeader>
      <PromotionListTable />
    </>
  );
}
