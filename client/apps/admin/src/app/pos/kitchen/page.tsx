import { metaObject } from '@/config/site.config';
import POSKitchenBoard from '@/app/shared/point-of-sale/components/pos-kitchen-board';

export const metadata = { ...metaObject('POS - Kitchen') };

export default function POSKitchenPage() {
  return <POSKitchenBoard />;
}
