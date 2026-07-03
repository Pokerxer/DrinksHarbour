import { metaObject } from '@/config/site.config';
import InventoryMovementsBrowser from '@/app/shared/inventory/inventory-movements-browser';

export const metadata = { ...metaObject('Inventory - Adjustments') };

export default function InventoryAdjustmentsPage() {
  return <InventoryMovementsBrowser preset="adjustments" />;
}
