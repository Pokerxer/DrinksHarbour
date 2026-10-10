import Link from 'next/link';
import { routes } from '@/config/routes';

export default function ReturnAllProductsLink({
  purchaseOrderId,
  billId,
}: {
  purchaseOrderId: string;
  billId?: string;
}) {
  const query = new URLSearchParams({ po: purchaseOrderId, all: '1' });
  if (billId) query.set('bill', billId);
  return (
    <Link
      href={`${routes.eCommerce.createVendorReturn}?${query}`}
      className="flex items-center gap-1.5 rounded-lg border border-orange-300 px-3 py-2 text-sm font-medium text-orange-700 hover:bg-orange-50"
    >
      Return all products
    </Link>
  );
}
