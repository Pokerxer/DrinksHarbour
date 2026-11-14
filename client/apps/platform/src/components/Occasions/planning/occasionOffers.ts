import type { ProductType } from '@/types/product.types';
import { purchasableOffers, type Offer } from '@/components/Merchandising/offers';

export async function loadOccasionOffers(categories: readonly string[]) {
  const origin = process.env.NEXT_PUBLIC_API_URL;
  if (!origin) return [];
  const offers = await Promise.all(categories.map(async category => {
    const query = new URLSearchParams({
      category, fields: 'card', inStock: 'true', isGiftPackaging: 'false',
      limit: '6', searchMode: 'text', useEmbeddings: 'false',
    });
    try {
      const response = await fetch(`${origin}/api/products/search?${query}`, {
        next: { revalidate: 300 },
        signal: AbortSignal.timeout(3500),
      });
      if (!response.ok) return undefined;
      const body: { data?: { products?: ProductType[] } } = await response.json();
      const products = body.data?.products;
      if (!Array.isArray(products)) return undefined;
      return products.filter(product => !product.isGiftPackaging &&
        (category !== 'non-alcoholic' || (product.abv === 0 || (product.abv == null && product.isAlcoholic === false))))
        .flatMap(purchasableOffers)[0];
    } catch {
      return undefined;
    }
  }));
  const seen = new Set<string>();
  return offers.filter((offer): offer is Offer => {
    if (!offer || seen.has(offer.product.slug)) return false;
    seen.add(offer.product.slug);
    return true;
  });
}
