import { metaObject } from '@/config/site.config';
import POSHistory from '@/app/shared/point-of-sale/pos-history';

export const metadata = { ...metaObject('POS - Orders') };

export default function POSOrdersPage() {
  return <POSHistory />;
}
