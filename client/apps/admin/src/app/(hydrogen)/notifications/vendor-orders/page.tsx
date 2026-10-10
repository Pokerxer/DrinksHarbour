import { metaObject } from '@/config/site.config';
import RestockPage from '@/app/shared/notifications/restock/restock-page';
export const metadata = { ...metaObject('Vendor order plans') };
export default function Page() {
  return <RestockPage vendorOrders />;
}
