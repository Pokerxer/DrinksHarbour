import { metaObject } from '@/config/site.config';
import InventoryMovementsBrowser from '@/app/shared/inventory/inventory-movements-browser';

export const metadata = { ...metaObject('Inventory - Moves History') };

export default function InventoryMovesHistoryPage() {
  return <InventoryMovementsBrowser preset="moves" />;
}
