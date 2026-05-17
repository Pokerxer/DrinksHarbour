import { metaObject } from '@/config/site.config';
import POSDashboard from '@/app/shared/point-of-sale/pos-dashboard';

export const metadata = { ...metaObject('Point of Sale') };

export default function PointOfSalePage() {
  return <POSDashboard />;
}
