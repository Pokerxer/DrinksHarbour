import { metaObject } from '@/config/site.config';
import InventoryReplenishment from '@/app/shared/inventory/inventory-replenishment';

export const metadata = { ...metaObject('Inventory - Replenishment') };

export default function InventoryReplenishmentPage() {
  return <InventoryReplenishment />;
}
