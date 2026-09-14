// Pure identity helpers shared by requests, persistence and offline replay.
export const shopStorageKey = (tenantId: string, shopId: string) =>
  `${encodeURIComponent(tenantId)}:${encodeURIComponent(shopId)}`;

export function readActiveShop(): string {
  if (typeof localStorage === 'undefined') return 'retail';
  try {
    const tenant = JSON.parse(localStorage.getItem('dh-pos-tenant') || 'null') as { _id?: string } | null;
    const selections = JSON.parse(localStorage.getItem('dh-pos-shops-by-tenant') || '{}') as Record<string, string>;
    return selections[tenant?._id || 'backoffice'] || 'retail';
  } catch { return 'retail'; }
}
export function scopePOSRequest(url: string, options?: RequestInit, selectedShop = readActiveShop()) {
  const target = new URL(url);
  if (!/^\/api\/pos\/(sessions(?:\/|$)|session-info$|orders(?:\/|$)|reports(?:\/|$)|dashboard$|tabs(?:\/|$)|tables\/[^/]+\/open-tab$)/.test(target.pathname)) return url;
  if (!target.searchParams.has('shopId')) {
    let bodyShop: string | undefined;
    if (typeof options?.body === 'string') {
      try {
        const body = JSON.parse(options.body) as { shopId?: unknown } | null;
        if (typeof body?.shopId === 'string') bodyShop = body.shopId;
      } catch { /* handled by API */ }
    }
    target.searchParams.set('shopId', bodyShop || selectedShop);
  }
  return target.toString();
}
