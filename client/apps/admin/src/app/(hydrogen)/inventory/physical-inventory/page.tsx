import { metaObject } from '@/config/site.config';
import InventoryStockBrowser from '@/app/shared/inventory/inventory-stock-browser';

export const metadata = { ...metaObject('Inventory - Physical Inventory') };

export default function InventoryPhysicalPage() {
  return <InventoryStockBrowser mode="count" />;
}
