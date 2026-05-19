import { metaObject } from '@/config/site.config';
import POSSell from '@/app/shared/point-of-sale/pos-sell';

export const metadata = { ...metaObject('POS - Sell') };

export default function POSSellPage() {
  return <POSSell />;
}
