import { metaObject } from '@/config/site.config';
import InventoryDashboard from '@/app/shared/inventory/inventory-dashboard';

export const metadata = { ...metaObject('Inventory') };

export default function InventoryPage() {
  return <InventoryDashboard />;
}
