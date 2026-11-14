import Link from 'next/link';
import { PiWhatsappLogoDuotone } from 'react-icons/pi';
import { getAuthenticatedUser } from '@/lib/server-auth';
import { roleCanAccessRoute } from '@/config/route-roles';
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

export default async function OrdersPage() {
  const user = await getAuthenticatedUser();
  return (
    <>
      {/*
        No "Add Order" action: orders originate from checkout or the POS till.
        The create/edit order form under this route is unwired template code
        (it console.logs and redirects to a DUMMY_ID), so linking to it here
        only offered admins a way to think they had created an order.
        Export lives inside the table, where the active filters are known.
      */}
      <PageHeader title={pageHeader.title} breadcrumb={pageHeader.breadcrumb}>
        {roleCanAccessRoute(routes.whatsappOrders.list, user?.role) && (
          <Link
            href={routes.whatsappOrders.list}
            className="mt-3 inline-flex w-fit items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-100 @lg:mt-0"
          >
            <PiWhatsappLogoDuotone className="h-5 w-5" aria-hidden />
            WhatsApp Orders
          </Link>
        )}
      </PageHeader>

      {/* The other half of this funnel — carts that haven't converted yet —
          lives at /ecommerce/carts. */}
      <OrdersTable />
    </>
  );
}
