import { metaObject } from '@/config/site.config';
import POSOrderAnalysis from '@/app/shared/point-of-sale/pos-order-analysis';

export const metadata = { ...metaObject('POS - Order Analysis') };

export default function POSOrderAnalysisPage() {
  return <POSOrderAnalysis />;
}
