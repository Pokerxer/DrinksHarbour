import { API_URL } from '@/lib/api';
import { fetchShoppingJson, type ShoppingCoordinates } from '@/lib/shoppingRequest';
import type { ProductType } from '@/types/product.types';

type Request = { location: ShoppingCoordinates | null; signal: AbortSignal };

async function fetchCatalogue<T>(url: string, request: Request) {
  request.signal.throwIfAborted();
  const controller = new AbortController();
  const cancel = () => controller.abort();
  const timeout = setTimeout(cancel, 9000);
  request.signal.addEventListener('abort', cancel, { once: true });
  try {
    return await fetchShoppingJson<T>(url, { location: request.location, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
    request.signal.removeEventListener('abort', cancel);
  }
}

export async function searchOffers(params: URLSearchParams, request: Request) {
  params.set('fields', 'card');
  params.set('inStock', 'true');
  params.set('limit', '8');
  params.set('searchMode', 'text');
  params.set('useEmbeddings', 'false');
  const response = await fetchCatalogue<{ data?: { products?: ProductType[] } }>(
    `${API_URL}/api/products/search?${params}`, request,
  );
  return (response.data?.products ?? []).filter(product => product.slug);
}

export async function readOfferProduct(slug: string, request: Request) {
  const response = await fetchCatalogue<{ data?: { product?: ProductType } }>(
    `${API_URL}/api/products/slug/${encodeURIComponent(slug)}`, request,
  );
  return response.data?.product ?? null;
}
