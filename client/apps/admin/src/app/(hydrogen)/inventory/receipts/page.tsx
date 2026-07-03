import { metaObject } from '@/config/site.config';
import InventoryReceipts from '@/app/shared/inventory/inventory-receipts';

export const metadata = { ...metaObject('Inventory - Receipts') };

export default function InventoryReceiptsPage() {
  return <InventoryReceipts />;
}
