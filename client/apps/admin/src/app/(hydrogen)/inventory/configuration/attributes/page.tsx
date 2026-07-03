import { metaObject } from '@/config/site.config';
import InventoryConfigPlaceholder from '@/app/shared/inventory/inventory-config-placeholder';

export const metadata = { ...metaObject('Inventory - Attributes') };

export default function AttributesPage() {
  return (
    <InventoryConfigPlaceholder
      title="Attributes"
      description="Define reusable product attributes — volume, vintage, ABV bands — to drive variants and filtering."
      capabilities={[
        'Attribute definitions with fixed value lists',
        'Variant generation from attribute combinations',
        'Attribute-based storefront filters',
      ]}
      links={[
        { label: 'Products', href: '/sub-products' },
        { label: 'Categories', href: '/categories' },
      ]}
    />
  );
}
