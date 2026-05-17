import { metaObject } from '@/config/site.config';
import POSLogin from '@/app/shared/point-of-sale/pos-login';

export const metadata = { ...metaObject('POS Login') };

export default function POSLoginPage() {
  return <POSLogin />;
}
