import { metaObject } from '@/config/site.config';
import InventoryConfigPlaceholder from '@/app/shared/inventory/inventory-config-placeholder';

export const metadata = { ...metaObject('Inventory - Delivery Methods') };

export default function DeliveryMethodsPage() {
  return (
    <InventoryConfigPlaceholder
      title="Delivery Methods"
      description="Configure how orders leave the building — in-house riders, third-party carriers, customer pickup."
      capabilities={[
        'Carrier setup with pricing rules (flat, per-km, weight-based)',
        'Coverage zones and cut-off times per method',
        'Method availability by order value or destination',
      ]}
      links={[{ label: 'Shipments', href: '/logistics/shipments' }]}
    />
  );
}
