import { metaObject } from '@/config/site.config';
import InventoryConfigPlaceholder from '@/app/shared/inventory/inventory-config-placeholder';

export const metadata = { ...metaObject('Inventory - Putaway Rules') };

export default function PutawayRulesPage() {
  return (
    <InventoryConfigPlaceholder
      title="Putaway Rules"
      description="Route incoming stock to the right location automatically the moment it is received."
      capabilities={[
        'Per-product or per-category destination rules',
        'Storage-category aware routing with capacity checks',
        'Fallback locations when the preferred spot is full',
      ]}
      links={[
        { label: 'Receipts', href: '/inventory/receipts' },
        { label: 'Warehouse settings', href: '/settings#warehouses' },
      ]}
    />
  );
}
