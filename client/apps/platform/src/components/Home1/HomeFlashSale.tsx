import FlashSale from './FlashSale';
import { fetchFlashSaleProducts } from './flash-sale-data';

// Independent from blog/recommendation/featured requests. Render the full,
// bounded flash-sale seed on the server; a successful empty result is complete.
export default async function HomeFlashSale() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) return null;
  try {
    const products = await fetchFlashSaleProducts(apiUrl);
    return <FlashSale initialProducts={products} initialProductsComplete flashOnly />;
  } catch {
    return <FlashSale flashOnly />;
  }
}
