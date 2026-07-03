import { metaObject } from '@/config/site.config';
import InventoryMovementsBrowser from '@/app/shared/inventory/inventory-movements-browser';

export const metadata = { ...metaObject('Inventory - Deliveries') };

export default function InventoryDeliveriesPage() {
  return <InventoryMovementsBrowser preset="deliveries" />;
}
