import { metaObject } from '@/config/site.config';
import POSOrders from '@/app/shared/point-of-sale/pos-orders';

export const metadata = { ...metaObject('POS - Orders') };

export default function POSOrdersPage() {
  return <POSOrders />;
}
