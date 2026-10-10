import { metaObject } from '@/config/site.config';
import WarehousePage from '@/app/shared/notifications/warehouses/warehouse-page';
export const metadata = { ...metaObject('Warehouse alerts') };
export default function Page() {
  return <WarehousePage />;
}
