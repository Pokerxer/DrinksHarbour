import type { Kiosk, KioskOptions } from './types';
export type KioskFilter = 'all' | 'enabled' | 'disabled';
export function kioskLabels(kiosk: Kiosk, options: KioskOptions | null) {
  return {
    shop: options?.shops.find((row) => row._id === kiosk.shopId)?.name || 'Store unavailable',
    location:
      options?.locations.find((row) => row._id === kiosk.location)?.name || 'Location unavailable',
    pricelist: kiosk.pricelist
      ? options?.pricelists.find((row) => row._id === kiosk.pricelist)?.name ||
        'Pricelist unavailable'
      : 'Automatic retail pricing',
  };
}
export function filterKiosks(
  items: Kiosk[],
  query: string,
  status: KioskFilter,
  options: KioskOptions | null
) {
  const needle = query.trim().toLocaleLowerCase();
  return items.filter((kiosk) => {
    if (status !== 'all' && kiosk.enabled !== (status === 'enabled')) return false;
    const labels = kioskLabels(kiosk, options);
    return [kiosk.name, kiosk.internalId, kiosk.slug, labels.shop, labels.location].some((value) =>
      value?.toLocaleLowerCase().includes(needle)
    );
  });
}
