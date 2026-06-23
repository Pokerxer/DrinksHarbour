import { metaObject } from '@/config/site.config';
import POSSellOrders from '@/app/shared/point-of-sale/pos-sell-orders';

export const metadata = { ...metaObject('POS - Session Orders') };

export default function POSSellOrdersPage() {
  return <POSSellOrders />;
}
