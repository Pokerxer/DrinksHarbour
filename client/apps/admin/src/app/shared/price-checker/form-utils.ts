import type { Kiosk, KioskInput, PricelistOption } from './types';
export function eligiblePricelists(
  lists: PricelistOption[],
  shop: string,
  location: string,
  currency: string
) {
  return lists.filter((list) => {
    if ((list.currency || 'NGN') !== currency) return false;
    const shops = list.shops || [],
      warehouses = list.warehouses || [];
    const scoped = shops.length > 0 || warehouses.length > 0;
    return scoped
      ? shops.includes(shop) || warehouses.includes(location)
      : list.isDefault || list.isSelectable;
  });
}
export function kioskInput(kiosk: Kiosk): KioskInput {
  const { name, internalId, slug, shopId, location, pricelist, currency, mode, enabled, settings } =
    kiosk;
  return { name, internalId, slug, shopId, location, pricelist, currency, mode, enabled, settings };
}
export function kioskUrl(
  slug: string,
  origin = typeof window !== 'undefined' ? window.location.origin : ''
) {
  return `${origin.replace(/\/$/, '')}/kiosk/price-checker/${encodeURIComponent(slug)}`;
}
