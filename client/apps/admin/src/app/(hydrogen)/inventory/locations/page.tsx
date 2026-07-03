import { metaObject } from '@/config/site.config';
import InventoryLocations from '@/app/shared/inventory/inventory-locations';

export const metadata = { ...metaObject('Inventory - Locations') };

export default function InventoryLocationsPage() {
  return <InventoryLocations />;
}
