import { metaObject } from '@/config/site.config';
import POSPricelists from '@/app/shared/point-of-sale/pos-pricelists';

export const metadata = { ...metaObject('POS – Pricelists') };

export default function POSPricelistsPage() {
  return <POSPricelists />;
}
