import { metaObject } from '@/config/site.config';
import InventoryStockBrowser from '@/app/shared/inventory/inventory-stock-browser';

export const metadata = { ...metaObject('Inventory - Stock') };

export default function InventoryStockPage() {
  return <InventoryStockBrowser mode="stock" />;
}
