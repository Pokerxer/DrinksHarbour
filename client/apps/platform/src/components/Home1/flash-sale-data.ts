import type { ShoppingCoordinates } from '@/lib/shoppingRequest';
import type { SaleProduct } from './flash-sale-types';

// Share concurrent requests only. Completed prices/stock are never cached here.
const pending = new Map<string, Promise<SaleProduct[]>>();
export function fetchFlashSaleProducts(apiUrl: string, location: ShoppingCoordinates | null = null, flashOnly = true): Promise<SaleProduct[]> {
  const params = new URLSearchParams({ sortBy: location ? 'nearest' : 'discount', limit: flashOnly ? '20' : '100', fields: 'card' });
  if (flashOnly) params.set('saleType', 'flash_sale');
  else params.set('onSale', 'true');
  const url = `${apiUrl}/api/products?${params}`;
  const key = url + (location ? JSON.stringify(location) : '');
  const existing = pending.get(key);
  if (existing) return existing;
  const request = (async () => {
    const fetchPage = async (page: number) => {
      const pageParams = new URLSearchParams(params);
      if (page > 1) pageParams.set('page', String(page));
      const response = await fetch(`${apiUrl}/api/products?${pageParams}`, { cache: 'no-store', headers: location ? { 'x-shopping-location': JSON.stringify({ lat: location.lat, lon: location.lon }) } : {} });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const raw: SaleProduct[] = data?.data?.products ?? data?.products ?? (Array.isArray(data) ? data : []);
      const products = Array.isArray(raw) ? raw : [];
      return { products, totalPages: Number(data?.data?.pagination?.totalPages ?? data?.pagination?.totalPages ?? 1) };
    };
    const first = await fetchPage(1);
    if (flashOnly) return first.products;
    // General sale filtering can happen after API pagination. An empty first
    // page is not an empty sale catalogue. Stop once the carousel is filled.
    const products = [...first.products];
    for (let page = 2; page <= first.totalPages && products.length < 20; page += 3) {
      const pages = await Promise.all(Array.from({ length: Math.min(3, first.totalPages - page + 1) }, (_, offset) => fetchPage(page + offset)));
      products.push(...pages.flatMap(result => result.products));
    }
    return products.slice(0, 20);
  })();
  pending.set(key, request);
  void request.then(() => pending.delete(key), () => pending.delete(key));
  return request;
}
