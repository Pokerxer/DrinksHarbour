import { metaObject } from '@/config/site.config';
import CustomerReturns from '@/app/shared/inventory/customer-returns';
export const metadata = { ...metaObject('Inventory - Customer Returns') };
export default async function InventoryReturnsPage({
  searchParams,
}: {
  searchParams: Promise<{ invoice?: string }>;
}) {
  const query = await searchParams;
  return (
    <CustomerReturns
      invoiceId={typeof query.invoice === 'string' ? query.invoice : undefined}
    />
  );
}
