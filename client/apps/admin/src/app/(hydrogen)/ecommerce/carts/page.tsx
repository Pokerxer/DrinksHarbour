import { routes } from '@/config/routes';
import PageHeader from '@/app/shared/page-header';
import CartTable from '@/app/shared/ecommerce/cart-list/table';
import { metaObject } from '@/config/site.config';

export const metadata = {
  ...metaObject('Live Carts'),
};

const pageHeader = {
  title: 'Live Carts',
  breadcrumb: [
    {
      href: routes.eCommerce.dashboard,
      name: 'E-Commerce',
    },
    {
      href: routes.eCommerce.carts,
      name: 'Live Carts',
    },
    {
      name: 'List',
    },
  ],
};

export default function LiveCartsPage() {
  return (
    <>
      {/*
        The half of the funnel that hasn't converted: what shoppers are holding
        in their marketplace basket right now. Read-only — staff act on a cart
        by starting a quotation, which reprices every line against the tenant's
        own pricelist rather than the marketplace snapshot shown here.

        Not to be confused with /ecommerce/cart (singular), which is unwired
        Hydrogen template code.
      */}
      <PageHeader title={pageHeader.title} breadcrumb={pageHeader.breadcrumb} />

      <CartTable />
    </>
  );
}
