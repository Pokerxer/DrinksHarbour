import { metaObject } from '@/config/site.config';
import InventoryStockBrowser from '@/app/shared/inventory/inventory-stock-browser';

export const metadata = {
  ...metaObject(
    'Inventory - Stock',
    undefined,
    'Stock on hand per warehouse and product — select lines to print a customer pricelist.'
  ),
};

export default function InventoryStockPage() {
  return <InventoryStockBrowser mode="stock" />;
}
