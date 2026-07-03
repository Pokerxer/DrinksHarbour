import { metaObject } from '@/config/site.config';
import InventoryConfigPlaceholder from '@/app/shared/inventory/inventory-config-placeholder';

export const metadata = { ...metaObject('Inventory - Storage Categories') };

export default function StorageCategoriesPage() {
  return (
    <InventoryConfigPlaceholder
      title="Storage Categories"
      description="Group locations by what they can hold — chilled, ambient, high-value cage — and cap their capacity."
      capabilities={[
        'Capacity limits by weight, units or package type',
        'Allowed product groups per category (e.g. chilled-only)',
        'Used by putaway rules to pick a valid destination automatically',
      ]}
      links={[{ label: 'Warehouses', href: '/warehouses' }]}
    />
  );
}
