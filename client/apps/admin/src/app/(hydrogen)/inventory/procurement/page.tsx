import { metaObject } from '@/config/site.config';
import InventoryProcurement from '@/app/shared/inventory/inventory-procurement';

export const metadata = { ...metaObject('Inventory - Procurement') };

export default function InventoryProcurementPage() {
  return <InventoryProcurement />;
}
