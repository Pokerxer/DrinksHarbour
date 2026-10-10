import type { SaleProduct } from './flash-sale-types';

// Share concurrent requests only. Completed prices/stock are never cached here.
const pending = new Map<string, Promise<SaleProduct[]>>();
export function fetchFlashSaleProducts(apiUrl: string): Promise<SaleProduct[]> {
  const params = new URLSearchParams({ sortBy: 'discount', saleType: 'flash_sale', limit: '20', fields: 'card' });
  const url = `${apiUrl}/api/products?${params}`;
  const existing = pending.get(url);
  if (existing) return existing;
  const request = (async () => {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const products: SaleProduct[] = data?.data?.products ?? data?.products ?? (Array.isArray(data) ? data : []);
    return Array.isArray(products) ? products : [];
  })();
  pending.set(url, request);
  void request.then(() => pending.delete(url), () => pending.delete(url));
  return request;
}
