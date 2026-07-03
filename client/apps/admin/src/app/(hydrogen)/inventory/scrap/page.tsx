import { metaObject } from '@/config/site.config';
import InventoryMovementsBrowser from '@/app/shared/inventory/inventory-movements-browser';

export const metadata = { ...metaObject('Inventory - Scrap') };

export default function InventoryScrapPage() {
  return <InventoryMovementsBrowser preset="scrap" />;
}
