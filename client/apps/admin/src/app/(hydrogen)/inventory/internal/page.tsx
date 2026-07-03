import { metaObject } from '@/config/site.config';
import InventoryMovementsBrowser from '@/app/shared/inventory/inventory-movements-browser';

export const metadata = { ...metaObject('Inventory - Internal') };

export default function InventoryInternalPage() {
  return <InventoryMovementsBrowser preset="internal" />;
}
