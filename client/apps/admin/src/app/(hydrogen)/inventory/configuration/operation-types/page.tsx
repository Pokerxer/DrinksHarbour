import { metaObject } from '@/config/site.config';
import InventoryConfigPlaceholder from '@/app/shared/inventory/inventory-config-placeholder';

export const metadata = { ...metaObject('Inventory - Operation Types') };

export default function OperationTypesPage() {
  return (
    <InventoryConfigPlaceholder
      title="Operation Types"
      description="Define how each kind of stock operation behaves — receipts, deliveries, internal transfers and returns."
      capabilities={[
        'Reference prefixes per operation (e.g. WH/IN, WH/OUT)',
        'One-, two- or three-step receipt and delivery flows',
        'Default source and destination locations per operation',
        'Approval requirements per operation type',
      ]}
      links={[
        { label: 'Warehouse settings', href: '/settings#warehouses' },
        { label: 'Transfers', href: '/inventory/transfers' },
      ]}
    />
  );
}
