import { metaObject } from '@/config/site.config';
import POSSessions from '@/app/shared/point-of-sale/pos-sessions';

export const metadata = { ...metaObject('POS - Sessions') };

export default function POSSessionsPage() {
  return <POSSessions />;
}
