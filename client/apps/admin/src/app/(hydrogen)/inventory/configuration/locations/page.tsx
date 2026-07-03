import { metaObject } from '@/config/site.config';
import InventoryConfigPlaceholder from '@/app/shared/inventory/inventory-config-placeholder';

export const metadata = { ...metaObject('Inventory - Locations') };

export default function ConfigLocationsPage() {
  return (
    <InventoryConfigPlaceholder
      title="Locations"
      description="Structure each warehouse into internal locations — zones, aisles, shelves and bins — so every unit has an exact place."
      capabilities={[
        'Zone / aisle / shelf / bin hierarchy per warehouse (stock lines already carry these fields)',
        'Location types: internal, input, output, quality control',
        'Barcode per location for scan-driven putaway and picking',
      ]}
      links={[
        { label: 'Warehouses', href: '/warehouses' },
        { label: 'Stock report', href: '/inventory/stock' },
      ]}
    />
  );
}
