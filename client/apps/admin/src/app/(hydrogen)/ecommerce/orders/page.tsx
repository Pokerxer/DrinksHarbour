import { routes } from '@/config/routes';
import PageHeader from '@/app/shared/page-header';
import OrdersTable from '@/app/shared/ecommerce/order/order-list/table';
import { metaObject } from '@/config/site.config';

export const metadata = {
  ...metaObject('Orders'),
};

const pageHeader = {
  title: 'Orders',
  breadcrumb: [
    {
      href: routes.eCommerce.dashboard,
      name: 'E-Commerce',
    },
    {
      href: routes.eCommerce.orders,
      name: 'Orders',
    },
    {
      name: 'List',
    },
  ],
};

export default function OrdersPage() {
  return (
    <>
      {/*
        No "Add Order" action: orders originate from checkout or the POS till.
        The create/edit order form under this route is unwired template code
        (it console.logs and redirects to a DUMMY_ID), so linking to it here
        only offered admins a way to think they had created an order.
        Export lives inside the table, where the active filters are known.
      */}
      <PageHeader title={pageHeader.title} breadcrumb={pageHeader.breadcrumb} />

      <OrdersTable />
    </>
  );
}
