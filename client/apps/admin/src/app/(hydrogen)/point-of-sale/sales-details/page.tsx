import { metaObject } from '@/config/site.config';
import POSSalesDetails from '@/app/shared/point-of-sale/pos-sales-details';

export const metadata = { ...metaObject('POS - Sales Details') };

export default function POSSalesDetailsPage() {
  return <POSSalesDetails />;
}
