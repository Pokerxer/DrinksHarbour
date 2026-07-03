import { metaObject } from '@/config/site.config';
import InventoryConfigPlaceholder from '@/app/shared/inventory/inventory-config-placeholder';

export const metadata = { ...metaObject('Inventory - Package Types') };

export default function PackageTypesPage() {
  return (
    <InventoryConfigPlaceholder
      title="Package Types"
      description="Standardise the boxes, crates and pallets stock ships in, with dimensions and weight limits."
      capabilities={[
        'Package dimensions, tare weight and max load',
        'Barcoded packages for scan-driven receiving and delivery',
        'Used by storage categories to cap location capacity',
      ]}
      links={[{ label: 'Warehouse settings', href: '/settings#warehouses' }]}
    />
  );
}
