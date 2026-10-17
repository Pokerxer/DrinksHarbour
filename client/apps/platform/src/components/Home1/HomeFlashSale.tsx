import FlashSale from './FlashSale';
import { fetchFlashSaleProducts } from './flash-sale-data';

// Independent from blog/recommendation/featured requests. Render the full,
// sale seed on the server; a successful empty result is complete. Include all
// promotion types, not only offers explicitly tagged flash_sale.
export default async function HomeFlashSale() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) return null;
  try {
    const products = await fetchFlashSaleProducts(apiUrl, null, false);
    return <FlashSale initialProducts={products} initialProductsComplete flashOnly={false} showEmptyState />;
  } catch {
    return <FlashSale flashOnly={false} showEmptyState />;
  }
}
