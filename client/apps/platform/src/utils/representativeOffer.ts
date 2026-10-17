export interface ShoppingOffer {
  subProductId: string; sizeId: string; tenantId: string;
  distanceKm: number | null; price: number; currency: string;
}
export function representativeSelection<T extends {
  shoppingOffer?: ShoppingOffer | null;
  availableAt?: Array<{ _id?: string; tenant?: { _id?: string; name?: string }; sizes?: Array<{
    _id?: string; size?: string; stock?: number;
    pricing?: { websitePrice?: number; originalWebsitePrice?: number };
    discount?: unknown;
  }> }>;
}>(product: T) {
  const offer = product.availableAt?.find(row => String(row._id) === product.shoppingOffer?.subProductId);
  const size = offer?.sizes?.find(row => String(row._id) === product.shoppingOffer?.sizeId);
  return (offer && size ? { offer, size } : null) as {
    offer: NonNullable<T['availableAt']>[number];
    size: NonNullable<NonNullable<T['availableAt']>[number]['sizes']>[number];
  } | null;
}

export function resolveSellerChoice<T extends { _id?: string }>(
  offers: T[], explicitSubProductId?: string | null, representativeSubProductId?: string | null,
): T | null {
  if (explicitSubProductId) return offers.find(offer => String(offer._id) === explicitSubProductId) || null;
  return offers.find(offer => String(offer._id) === representativeSubProductId) || offers[0] || null;
}
