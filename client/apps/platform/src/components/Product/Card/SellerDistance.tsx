import SellerProximity from '@/components/ShoppingLocation/SellerProximity';
import type { ShoppingOffer } from '@/utils/representativeOffer';
export default function SellerDistance({ product }: { product: {
  shoppingOffer?: ShoppingOffer | null;
  availableAt?: Array<{ _id?: string; tenant?: { name?: string } }>;
} }) {
  const selected = product.shoppingOffer;
  const seller = product.availableAt?.find(row => String(row._id) === selected?.subProductId);
  if (!selected || !seller) return null;
  return <div className="mt-2 border-t border-zinc-100 pt-2">
    <p className="truncate text-xs font-medium text-zinc-700">{seller.tenant?.name}</p>
    <SellerProximity distanceKm={selected.distanceKm} nearest />
  </div>;
}
