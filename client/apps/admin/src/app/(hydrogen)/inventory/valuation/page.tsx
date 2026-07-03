import { metaObject } from '@/config/site.config';
import InventoryStockBrowser from '@/app/shared/inventory/inventory-stock-browser';

export const metadata = { ...metaObject('Inventory - Valuation') };

export default function InventoryValuationPage() {
  return <InventoryStockBrowser mode="valuation" />;
}
