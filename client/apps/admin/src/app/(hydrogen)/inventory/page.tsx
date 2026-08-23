import { metaObject } from '@/config/site.config';
import InventoryDashboard from '@/app/shared/inventory/inventory-dashboard';

export const metadata = {
  ...metaObject(
    'Inventory',
    undefined,
    'Live stock health, valuation, and warehouse operations across your tenant locations.'
  ),
};

export default function InventoryPage() {
  return <InventoryDashboard />;
}
