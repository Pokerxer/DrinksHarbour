import { cache } from 'react';
import type { Metadata } from 'next';
import { routes } from '@/config/routes';
import PageHeader from '@/app/shared/page-header';
import OrderView from '@/app/shared/ecommerce/order/order-view';
import { metaObject } from '@/config/site.config';
import { getAuthenticatedUser } from '@/lib/server-auth';
import { orderService, type Order } from '@/services/order.service';

type Props = { params: Promise<{ id: string }> };

// cache() keeps generateMetadata and the page render to a single round-trip.
const fetchOrder = cache(async (id: string): Promise<Order | null> => {
  try {
    const user = await getAuthenticatedUser();
    if (!user?.token) return null;
    return await orderService.getOrder(user.token, id);
  } catch {
    // OrderView renders the error state from a null order
    return null;
  }
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = (await params).id;
  const order = await fetchOrder(id);
  return metaObject(order?.orderNumber ? `Order #${order.orderNumber}` : 'Order Details');
}

export default async function OrderDetailsPage({ params }: Props) {
  const id = (await params).id;

  // Fetch on the server — data arrives with the initial HTML, no client waterfall.
  // Next dedupes this against the identical call in generateMetadata.
  const order = await fetchOrder(id);

  const pageHeader = {
    title: order?.orderNumber ? `Order #${order.orderNumber}` : 'Order Details',
    breadcrumb: [
      { href: routes.eCommerce.dashboard, name: 'E-Commerce' },
      { href: routes.eCommerce.orders, name: 'Orders' },
      { name: order?.orderNumber ?? id },
    ],
  };

  return (
    <>
      {/*
        No "Edit Order" action: the order edit form under this route is unwired
        template code (it console.logs the payload and redirects to a DUMMY_ID),
        so the button promised an edit that never reached the API. Real state
        changes — status, payment, refunds — happen inside OrderView against
        the live endpoints.
      */}
      <PageHeader title={pageHeader.title} breadcrumb={pageHeader.breadcrumb} />
      <OrderView orderId={id} initialOrder={order} />
    </>
  );
}
