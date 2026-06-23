// @ts-nocheck
import { Button } from 'rizzui/button';
import { routes } from '@/config/routes';
import PageHeader from '@/app/shared/page-header';
import Link from 'next/link';
import OrderView from '@/app/shared/ecommerce/order/order-view';
import { getAuthenticatedUser } from '@/lib/server-auth';
import { orderService } from '@/services/order.service';

export default async function OrderDetailsPage({ params }: any) {
  const id = (await params).id;

  // Fetch order on the server — data arrives with the initial HTML, no client waterfall
  let order = null;
  try {
    const user = await getAuthenticatedUser();
    if (user?.token) {
      order = await orderService.getOrder(user.token, id);
    }
  } catch {
    // order stays null; OrderView will show the error state
  }

  const displayTitle = order?.orderNumber
    ? `Order #${order.orderNumber}`
    : `Order #${id}`;

  const pageHeader = {
    title: displayTitle,
    breadcrumb: [
      { href: routes.eCommerce.dashboard, name: 'E-Commerce' },
      { href: routes.eCommerce.orders, name: 'Orders' },
      { name: order?.orderNumber ?? id },
    ],
  };

  return (
    <>
      <PageHeader title={pageHeader.title} breadcrumb={pageHeader.breadcrumb}>
        <Link
          href={routes.eCommerce.editOrder(id)}
          className="mt-4 w-full @lg:mt-0 @lg:w-auto"
        >
          <Button as="span" className="w-full @lg:w-auto">
            Edit Order
          </Button>
        </Link>
      </PageHeader>
      <OrderView orderId={id} initialOrder={order} />
    </>
  );
}
