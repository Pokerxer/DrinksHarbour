type EntryShop = { _id: string; name: string; mode: 'retail' | 'wholesale'; active?: boolean };

export function resolveShopEntry(shopId: string, shops: EntryShop[]) {
  if (shopId === 'retail') return { shopId, mode: 'retail' as const, name: 'Retail' };
  const shop = shops.find(shop => shop._id === shopId && shop.active !== false);
  if (!shop) throw new Error('This shop is unavailable. Select an active shop from Point of Sale.');
  return { shopId: shop._id, mode: shop.mode, name: shop.name };
}

export function historyAccess(adminToken: string | null, posToken: string | null, activeShop: string) {
  return { token: adminToken || posToken, defaultShop: adminToken ? 'all' : activeShop };
}
