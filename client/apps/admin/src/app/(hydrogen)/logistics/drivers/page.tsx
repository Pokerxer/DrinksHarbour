import DriversPage from '@/app/shared/logistics/drivers';
import { metaObject } from '@/config/site.config';

export const metadata = {
  ...metaObject('Riders'),
};

export default function LogisticsDriversPage() {
  return <DriversPage />;
}
